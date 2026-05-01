use sqlx::PgPool;
use uuid::Uuid;

use crate::types::{DepositSession, RegisterSessionRequest};

pub async fn init_db(pool: &PgPool) -> eyre::Result<()> {
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS sessions (
            id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            burner_address    TEXT NOT NULL,
            eip7702_auth      JSONB NOT NULL,
            dest_address      TEXT NOT NULL,
            dest_chain_id     INTEGER NOT NULL,
            status            TEXT NOT NULL DEFAULT 'pending',
            source_chain_id   INTEGER,
            detected_token    TEXT,
            detected_amount   TEXT,
            detected_tx       TEXT,
            sweep_tx          TEXT,
            swap_output_amount TEXT,
            fee_amount        TEXT,
            bridge_amount     TEXT,
            bridge_tx         TEXT,
            bridge_nonce      TEXT,
            dest_tx           TEXT,
            retry_count       INTEGER NOT NULL DEFAULT 0,
            next_retry_at     TIMESTAMPTZ,
            claimed_by        TEXT,
            claimed_at        TIMESTAMPTZ,
            error_message     TEXT
        )",
    )
    .execute(pool)
    .await?;

    // Migration: drop legacy CCTP column from older deployments. Bridging now
    // goes through Uniswap BRIDGE routing (Across), not Circle CCTP.
    sqlx::query("ALTER TABLE sessions DROP COLUMN IF EXISTS dest_cctp_domain")
        .execute(pool)
        .await?;

    // Add uniqueness constraint to prevent duplicate sessions for the same burner
sqlx::query(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_burner_unique ON sessions(burner_address) WHERE status IN ('pending', 'failed')",
        )
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_sessions_burner ON sessions(burner_address, status)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_sessions_retry ON sessions(status, next_retry_at) WHERE status = 'detected'",
    )
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn insert_session(
    pool: &PgPool,
    req: &RegisterSessionRequest,
) -> eyre::Result<DepositSession> {
    // Don't allow overwriting an active pending session — that would let a
    // second register call redirect the buyer's funds to a new dest_address.
    let existing_pending = sqlx::query_as::<_, DepositSession>(
        "SELECT * FROM sessions
         WHERE LOWER(burner_address) = LOWER($1) AND status = 'pending'",
    )
    .bind(&req.burner_address)
    .fetch_optional(pool)
    .await?;

    if existing_pending.is_some() {
        return Err(eyre::eyre!("a pending session already exists for this burner"));
    }

    let session = sqlx::query_as::<_, DepositSession>(
        "INSERT INTO sessions (burner_address, eip7702_auth, dest_address, dest_chain_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *",
    )
    .bind(&req.burner_address)
    .bind(&req.eip7702_auth)
    .bind(&req.destination_address)
    .bind(req.destination_chain)
    .fetch_one(pool)
    .await?;

    Ok(session)
}

pub async fn get_session(pool: &PgPool, id: Uuid) -> eyre::Result<Option<DepositSession>> {
    let session = sqlx::query_as::<_, DepositSession>("SELECT * FROM sessions WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?;

    Ok(session)
}

/// Get all burner addresses with pending sessions (for native gas balance polling).
/// First-chain-wins design: any chain may detect, advisory-locked claim resolves races.
pub async fn get_pending_burners(pool: &PgPool) -> eyre::Result<Vec<(uuid::Uuid, String)>> {
    let rows = sqlx::query_as::<_, (uuid::Uuid, String)>(
        "SELECT id, burner_address FROM sessions WHERE status IN ('pending', 'failed') AND created_at > now() - interval '30 minutes'",
    )
    .fetch_all(pool)
    .await?;

    Ok(rows)
}

pub async fn get_session_by_address(
    pool: &PgPool,
    burner_address: &str,
) -> eyre::Result<Option<DepositSession>> {
    let session = sqlx::query_as::<_, DepositSession>(
        "SELECT * FROM sessions WHERE LOWER(burner_address) = LOWER($1) AND status IN ('pending', 'failed') ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END LIMIT 1",
    )
    .bind(burner_address)
    .fetch_optional(pool)
    .await?;

    Ok(session)
}

/// Claim a session for detection using an advisory lock.
/// Returns true if this instance successfully claimed it.
pub async fn claim_for_detection(
    pool: &PgPool,
    session_id: Uuid,
    source_chain_id: i32,
    detected_token: &str,
    detected_amount: &str,
    detected_tx: &str,
) -> eyre::Result<bool> {
    let mut tx = pool.begin().await?;

    // Advisory lock on session ID
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text)::bigint)")
        .bind(session_id)
        .execute(&mut *tx)
        .await?;

    // First-chain-wins: any indexer that races to this row first sets source_chain_id.
    // Advisory lock above ensures no other chain can subsequently overwrite.
    let result = sqlx::query(
        "UPDATE sessions SET
            status = 'detected',
            source_chain_id = $2,
            detected_token = $3,
            detected_amount = $4,
            detected_tx = $5,
            retry_count = 0,
            next_retry_at = NULL,
            error_message = NULL,
            claimed_by = NULL,
            claimed_at = NULL,
            sweep_tx = NULL,
            updated_at = now()
         WHERE id = $1 AND status IN ('pending', 'failed')",
    )
    .bind(session_id)
    .bind(source_chain_id)
    .bind(detected_token)
    .bind(detected_amount)
    .bind(detected_tx)
    .execute(&mut *tx)
    .await?;

    if result.rows_affected() > 0 {
        // Notify listeners
        sqlx::query("SELECT pg_notify('session_updates', $1::text)")
            .bind(session_id)
            .execute(&mut *tx)
            .await?;
    }

    tx.commit().await?;
    Ok(result.rows_affected() > 0)
}

/// Claim a detected session for sweeping. Returns the session if claimed.
pub async fn claim_for_sweep(
    pool: &PgPool,
    source_chain_id: i32,
    instance_id: &str,
) -> eyre::Result<Option<DepositSession>> {
    let mut tx = pool.begin().await?;

    // Find a detected session on this chain that's ready for sweep
    let maybe_session = sqlx::query_as::<_, DepositSession>(
        "SELECT * FROM sessions
         WHERE status = 'detected'
           AND source_chain_id = $1
           AND (next_retry_at IS NULL OR next_retry_at <= now())
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED",
    )
    .bind(source_chain_id)
    .fetch_optional(&mut *tx)
    .await?;

    let session = match maybe_session {
        Some(s) => s,
        None => {
            tx.commit().await?;
            return Ok(None);
        }
    };

    // Advisory lock
    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text)::bigint)")
        .bind(session.id)
        .execute(&mut *tx)
        .await?;

    // Update to sweeping
    sqlx::query(
        "UPDATE sessions SET
            status = 'sweeping',
            claimed_by = $2,
            claimed_at = now(),
            updated_at = now()
         WHERE id = $1 AND status = 'detected'",
    )
    .bind(session.id)
    .bind(instance_id)
    .execute(&mut *tx)
    .await?;

    // Notify
    sqlx::query("SELECT pg_notify('session_updates', $1::text)")
        .bind(session.id)
        .execute(&mut *tx)
        .await?;

    tx.commit().await?;
    Ok(Some(session))
}

/// Mark a session as swept with all result data.
pub async fn mark_swept(
    pool: &PgPool,
    session_id: Uuid,
    sweep_tx: &str,
    swap_output_amount: &str,
    fee_amount: &str,
    bridge_amount: &str,
) -> eyre::Result<()> {
    sqlx::query(
        "UPDATE sessions SET
            status = 'swept',
            sweep_tx = $2,
            swap_output_amount = $3,
            fee_amount = $4,
            bridge_amount = $5,
            updated_at = now()
         WHERE id = $1",
    )
    .bind(session_id)
    .bind(sweep_tx)
    .bind(swap_output_amount)
    .bind(fee_amount)
    .bind(bridge_amount)
    .execute(pool)
    .await?;

    sqlx::query("SELECT pg_notify('session_updates', $1::text)")
        .bind(session_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Mark a session as bridging after the swap tx landed. Records the swap tx and USDC amount.
pub async fn mark_bridging(
    pool: &PgPool,
    session_id: Uuid,
    sweep_tx: &str,
    swap_output_amount: &str,
    fee_amount: &str,
    bridge_tx: &str,
    bridge_amount: &str,
) -> eyre::Result<()> {
    sqlx::query(
        "UPDATE sessions SET
            status = 'bridging',
            sweep_tx = $2,
            swap_output_amount = $3,
            fee_amount = $4,
            bridge_tx = $5,
            bridge_amount = $6,
            updated_at = now()
         WHERE id = $1",
    )
    .bind(session_id)
    .bind(sweep_tx)
    .bind(swap_output_amount)
    .bind(fee_amount)
    .bind(bridge_tx)
    .bind(bridge_amount)
    .execute(pool)
    .await?;

    sqlx::query("SELECT pg_notify('session_updates', $1::text)")
        .bind(session_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Mark a bridging session as fully swept (bridge confirmed on dest chain).
pub async fn mark_bridge_complete(
    pool: &PgPool,
    session_id: Uuid,
) -> eyre::Result<()> {
    sqlx::query(
        "UPDATE sessions SET
            status = 'swept',
            updated_at = now()
         WHERE id = $1 AND status = 'bridging'",
    )
    .bind(session_id)
    .execute(pool)
    .await?;

    sqlx::query("SELECT pg_notify('session_updates', $1::text)")
        .bind(session_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Mark a bridging session as terminally failed (bridge reported FAILED/EXPIRED).
pub async fn mark_bridge_failed(
    pool: &PgPool,
    session_id: Uuid,
    error_msg: &str,
) -> eyre::Result<()> {
    sqlx::query(
        "UPDATE sessions SET
            status = 'failed',
            error_message = $2,
            updated_at = now()
         WHERE id = $1 AND status = 'bridging'",
    )
    .bind(session_id)
    .bind(error_msg)
    .execute(pool)
    .await?;

    sqlx::query("SELECT pg_notify('session_updates', $1::text)")
        .bind(session_id)
        .execute(pool)
        .await?;

    Ok(())
}

/// Fetch all sessions currently in `bridging` state on a given source chain.
/// Used by the bridge-status poller to advance them to `swept` or `failed`.
pub async fn get_bridging_sessions(
    pool: &PgPool,
    source_chain_id: i32,
) -> eyre::Result<Vec<DepositSession>> {
    let rows = sqlx::query_as::<_, DepositSession>(
        "SELECT * FROM sessions
         WHERE status = 'bridging' AND source_chain_id = $1
         ORDER BY updated_at ASC",
    )
    .bind(source_chain_id)
    .fetch_all(pool)
    .await?;
    Ok(rows)
}

/// Mark a sweep as failed, increment retry count or mark as permanently failed.
pub async fn mark_sweep_error(
    pool: &PgPool,
    session_id: Uuid,
    error_msg: &str,
) -> eyre::Result<()> {
    // Back to detected with retry backoff, or failed after 3 retries
    sqlx::query(
        "UPDATE sessions SET
            status = CASE WHEN retry_count >= 3 THEN 'failed' ELSE 'detected' END,
            error_message = $2,
            retry_count = retry_count + 1,
            next_retry_at = CASE WHEN retry_count >= 3 THEN NULL
                ELSE now() + (interval '1 second' * power(2, retry_count + 1))
            END,
            claimed_by = NULL,
            claimed_at = NULL,
            updated_at = now()
         WHERE id = $1",
    )
    .bind(session_id)
    .bind(error_msg)
    .execute(pool)
    .await?;

    sqlx::query("SELECT pg_notify('session_updates', $1::text)")
        .bind(session_id)
        .execute(pool)
        .await?;

    Ok(())
}

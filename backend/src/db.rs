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
            dest_cctp_domain  INTEGER NOT NULL,
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
    dest_cctp_domain: u32,
) -> eyre::Result<DepositSession> {
    // If a pending session already exists for this burner, update it
    let existing = sqlx::query_as::<_, DepositSession>(
        "UPDATE sessions SET
            eip7702_auth = $2,
            dest_address = $3,
            dest_chain_id = $4,
            dest_cctp_domain = $5,
            updated_at = now()
         WHERE LOWER(burner_address) = LOWER($1) AND status = 'pending'
         RETURNING *",
    )
    .bind(&req.burner_address)
    .bind(&req.eip7702_auth)
    .bind(&req.destination_address)
    .bind(req.destination_chain)
    .bind(dest_cctp_domain as i32)
    .fetch_optional(pool)
    .await?;

    if let Some(session) = existing {
        return Ok(session);
    }

    let session = sqlx::query_as::<_, DepositSession>(
        "INSERT INTO sessions (burner_address, eip7702_auth, dest_address, dest_chain_id, dest_cctp_domain)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *",
    )
    .bind(&req.burner_address)
    .bind(&req.eip7702_auth)
    .bind(&req.destination_address)
    .bind(req.destination_chain)
    .bind(dest_cctp_domain as i32)
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

/// Get all burner addresses with pending sessions (for ETH balance polling).
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

    // Update if pending or failed (re-deposit to same burner)
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

/// Mark a bridging session as fully swept (bridge confirmed).
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

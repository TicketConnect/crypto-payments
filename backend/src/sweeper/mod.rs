use sqlx::PgPool;
use std::time::Duration;
use crate::chains;
use crate::config::Config;
use crate::uniswap::{self, SwapStatus};

mod executor;

pub async fn run(chain_id: u64, rpc_url: &str) -> eyre::Result<()> {
    let config = Config::from_env()?;
    let chain = chains::get_chain(chain_id)
        .ok_or_else(|| eyre::eyre!("unsupported chain: {chain_id}"))?;

    let pool = PgPool::connect(&config.database_url).await?;
    crate::db::init_db(&pool).await?;

    // Bridge-status poller: watches `bridging` rows for this chain and advances
    // them to `swept` once the bridge confirms delivery on the destination chain
    // (or `failed` on FAILED/EXPIRED). Runs concurrently with sweep workers.
    {
        let pool = pool.clone();
        let api_key = config.uniswap_api_key.clone();
        tokio::spawn(async move {
            bridge_status_poller(pool, chain_id, api_key).await;
        });
    }

    // Sweep worker pool: each task independently claims sessions via
    // `FOR UPDATE SKIP LOCKED`, so they can run without coordination.
    const NUM_WORKERS: usize = 5;
    for i in 0..NUM_WORKERS {
        let pool = pool.clone();
        let config = config.clone();
        let chain = chain.clone();
        let rpc_url = rpc_url.to_string();
        let instance_id = format!("sweeper-{chain_id}-{i}-{}", uuid::Uuid::new_v4().simple());

        tokio::spawn(async move {
            tracing::info!(chain_id, worker = %instance_id, "sweep worker started");
            loop {
                match crate::db::claim_for_sweep(&pool, chain_id as i32, &instance_id).await {
                    Ok(Some(session)) => {
                        tracing::info!(session_id = %session.id, worker = %instance_id, "claimed session for sweep");
                        if let Err(e) = executor::execute_sweep(
                            &pool, &config, &chain, &rpc_url, &session,
                        ).await {
                            tracing::error!(session_id = %session.id, "sweep failed: {e}");
                            let _ = crate::db::mark_sweep_error(&pool, session.id, &e.to_string()).await;
                        }
                    }
                    Ok(None) => {
                        tokio::time::sleep(Duration::from_secs(2)).await;
                    }
                    Err(e) => {
                        tracing::error!("claim error: {e}");
                        tokio::time::sleep(Duration::from_secs(5)).await;
                    }
                }
            }
        });
    }

    // Block forever — workers run in their own tasks.
    std::future::pending::<()>().await;
    Ok(())
}

/// Poll Uniswap's `/swaps` endpoint for every session in `bridging` state on
/// this chain. Advances them to `swept` (SUCCESS) or `failed` (FAILED/EXPIRED).
/// PENDING / NotFound entries stay in `bridging` and are re-checked next tick.
async fn bridge_status_poller(pool: PgPool, chain_id: u64, api_key: String) {
    const TICK: Duration = Duration::from_secs(15);
    tracing::info!(chain_id, "bridge-status poller started");

    loop {
        let sessions = match crate::db::get_bridging_sessions(&pool, chain_id as i32).await {
            Ok(s) => s,
            Err(e) => {
                tracing::error!("get_bridging_sessions failed: {e}");
                tokio::time::sleep(TICK).await;
                continue;
            }
        };

        for session in sessions {
            let bridge_tx = match session.bridge_tx.as_deref() {
                Some(tx) if !tx.is_empty() => tx,
                _ => {
                    tracing::warn!(session_id = %session.id, "bridging session has no bridge_tx; skipping");
                    continue;
                }
            };

            match uniswap::check_swap_status(&api_key, bridge_tx, chain_id).await {
                Ok(SwapStatus::Success) => {
                    if let Err(e) = crate::db::mark_bridge_complete(&pool, session.id).await {
                        tracing::error!(session_id = %session.id, "mark_bridge_complete failed: {e}");
                    } else {
                        tracing::info!(session_id = %session.id, tx = bridge_tx, "bridge delivered");
                    }
                }
                Ok(SwapStatus::Failed) => {
                    let _ = crate::db::mark_bridge_failed(&pool, session.id, "bridge reported FAILED").await;
                    tracing::warn!(session_id = %session.id, tx = bridge_tx, "bridge FAILED");
                }
                Ok(SwapStatus::Expired) => {
                    let _ = crate::db::mark_bridge_failed(&pool, session.id, "bridge reported EXPIRED").await;
                    tracing::warn!(session_id = %session.id, tx = bridge_tx, "bridge EXPIRED");
                }
                Ok(SwapStatus::Pending) | Ok(SwapStatus::NotFound) => {
                    // still in flight
                }
                Err(e) => {
                    tracing::warn!(session_id = %session.id, "bridge status check error: {e}");
                }
            }
        }

        tokio::time::sleep(TICK).await;
    }
}

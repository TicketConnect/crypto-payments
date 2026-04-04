use sqlx::PgPool;
use crate::chains;
use crate::config::Config;

mod executor;

pub async fn run(chain_id: u64, rpc_url: &str) -> eyre::Result<()> {
    let config = Config::from_env()?;
    let chain = chains::get_chain(chain_id)
        .ok_or_else(|| eyre::eyre!("unsupported chain: {chain_id}"))?;

    let pool = PgPool::connect(&config.database_url).await?;
    crate::db::init_db(&pool).await?;

    let instance_id = format!("sweeper-{chain_id}-{}", uuid::Uuid::new_v4().simple());
    tracing::info!(chain = chain.name, chain_id, instance = %instance_id, "sweeper starting");

    loop {
        // Poll for claimable sessions on this chain
        match crate::db::claim_for_sweep(&pool, chain_id as i32, &instance_id).await {
            Ok(Some(session)) => {
                tracing::info!(session_id = %session.id, "claimed session for sweep");
                if let Err(e) = executor::execute_sweep(
                    &pool, &config, chain, rpc_url, &session,
                ).await {
                    tracing::error!(session_id = %session.id, "sweep failed: {e}");
                    let _ = crate::db::mark_sweep_error(&pool, session.id, &e.to_string()).await;
                }
            }
            Ok(None) => {
                // No work, wait before polling again
                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
            }
            Err(e) => {
                tracing::error!("claim error: {e}");
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        }
    }
}

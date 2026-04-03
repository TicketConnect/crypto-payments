use sqlx::PgPool;
use crate::chains;
use crate::config::Config;

mod watcher;

pub async fn run(chain_id: u64, rpc_url: &str) -> eyre::Result<()> {
    let config = Config::from_env()?;
    let chain = chains::get_chain(chain_id)
        .ok_or_else(|| eyre::eyre!("unsupported chain: {chain_id}"))?;

    let pool = PgPool::connect(&config.database_url).await?;
    crate::db::init_db(&pool).await?;

    tracing::info!(chain = chain.name, chain_id, "indexer starting");

    loop {
        match watcher::watch(&pool, rpc_url, chain_id).await {
            Ok(()) => {
                tracing::warn!("watcher exited cleanly, restarting...");
            }
            Err(e) => {
                tracing::error!("watcher error: {e}, reconnecting in 5s...");
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;
            }
        }
    }
}

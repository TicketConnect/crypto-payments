use alloy::primitives::{Address, U256};
use alloy::providers::{Provider, ProviderBuilder, WsConnect};
use alloy::rpc::types::Filter;
use futures_util::StreamExt;
use sqlx::PgPool;
use std::time::Duration;

/// Follow the chain head via WS `newHeads`, fetch Transfer logs per block via HTTP.
/// Falls back to HTTP polling if the WS subscription drops.
pub async fn watch(pool: &PgPool, ws_url: &str, chain_id: u64) -> eyre::Result<()> {
    let http_url = ws_to_http(ws_url);
    let http_provider = ProviderBuilder::new().connect_http(http_url.parse()?);

    loop {
        // Try WS-driven block tracking first
        match watch_ws(pool, ws_url, &http_provider, chain_id).await {
            Ok(()) => {
                tracing::warn!("ws stream ended, reconnecting...");
            }
            Err(e) => {
                tracing::warn!("ws error: {e}, falling back to http polling");
            }
        }

        // Fallback: HTTP polling until WS reconnects
        if let Err(e) = poll_once(pool, &http_provider, chain_id).await {
            tracing::error!("poll error: {e}");
        }

        tokio::time::sleep(Duration::from_secs(2)).await;
    }
}

/// Subscribe to `newHeads` via WS, fetch logs for each new block via HTTP.
async fn watch_ws(
    pool: &PgPool,
    ws_url: &str,
    http_provider: &impl Provider,
    chain_id: u64,
) -> eyre::Result<()> {
    let ws = WsConnect::new(ws_url);
    let ws_provider = ProviderBuilder::new().connect_ws(ws).await?;

    let sub = ws_provider.subscribe_blocks().await?;
    let mut stream = sub.into_stream();

    tracing::info!("subscribed to newHeads on chain {chain_id}");

    while let Some(block) = stream.next().await {
        let block_number = block.number;
        tracing::debug!(block_number, "new block");

        if let Err(e) = process_block(pool, http_provider, chain_id, block_number).await {
            tracing::error!(block_number, "process_block error: {e}");
        }
    }

    Ok(())
}

/// HTTP poll: get latest block and process it.
async fn poll_once(
    pool: &PgPool,
    http_provider: &impl Provider,
    chain_id: u64,
) -> eyre::Result<()> {
    let block_number = http_provider.get_block_number().await?;
    process_block(pool, http_provider, chain_id, block_number).await
}

/// Fetch Transfer logs for a specific block and match against pending sessions.
async fn process_block(
    pool: &PgPool,
    provider: &impl Provider,
    chain_id: u64,
    block_number: u64,
) -> eyre::Result<()> {
    let filter = Filter::new()
        .event("Transfer(address,address,uint256)")
        .from_block(block_number)
        .to_block(block_number);

    let logs = provider.get_logs(&filter).await?;

    for log in logs {
        if log.topics().len() < 3 {
            continue;
        }

        let to_address = Address::from_word(log.topics()[2]);
        let to_hex = format!("{to_address:#x}");

        let session = match crate::db::get_session_by_address(pool, &to_hex).await {
            Ok(Some(s)) => s,
            Ok(None) => continue,
            Err(e) => {
                tracing::error!("db error: {e}");
                continue;
            }
        };

        let amount = if log.data().data.len() >= 32 {
            U256::from_be_slice(&log.data().data[..32])
        } else {
            U256::ZERO
        };

        let token_address = format!("{:#x}", log.address());
        let tx_hash = log
            .transaction_hash
            .map(|h| format!("{h:#x}"))
            .unwrap_or_default();

        tracing::info!(
            session_id = %session.id,
            token = %token_address,
            amount = %amount,
            tx = %tx_hash,
            "deposit detected"
        );

        match crate::db::claim_for_detection(
            pool,
            session.id,
            chain_id as i32,
            &token_address,
            &amount.to_string(),
            &tx_hash,
        )
        .await
        {
            Ok(true) => tracing::info!(session_id = %session.id, "claimed for detection"),
            Ok(false) => {
                tracing::debug!(session_id = %session.id, "already claimed by another instance")
            }
            Err(e) => tracing::error!(session_id = %session.id, "claim error: {e}"),
        }
    }

    // ── Check ETH balances for pending burners ───────────────────────────
    check_eth_balances(pool, provider, chain_id).await;

    Ok(())
}

/// Poll ETH balances for pending sessions. If a burner has ETH, claim it
/// using the WETH address as detected_token (the sweeper will wrap it).
async fn check_eth_balances(
    pool: &PgPool,
    provider: &impl Provider,
    chain_id: u64,
) {
    let burners = match crate::db::get_pending_burners(pool).await {
        Ok(b) => b,
        Err(e) => {
            tracing::error!("get_pending_burners error: {e}");
            return;
        }
    };

    for (session_id, burner_address) in burners {
        let addr: Address = match burner_address.parse() {
            Ok(a) => a,
            Err(_) => continue,
        };

        let balance = match provider.get_balance(addr).await {
            Ok(b) => b,
            Err(_) => continue,
        };

        if balance.is_zero() {
            continue;
        }

        // Use WETH address as detected_token — sweeper will wrap ETH first
        let weth = "0x4200000000000000000000000000000000000006";

        tracing::info!(
            session_id = %session_id,
            balance = %balance,
            "native ETH deposit detected"
        );

        match crate::db::claim_for_detection(
            pool,
            session_id,
            chain_id as i32,
            weth,
            &balance.to_string(),
            "",
        )
        .await
        {
            Ok(true) => tracing::info!(session_id = %session_id, "claimed ETH for detection"),
            Ok(false) => {}
            Err(e) => tracing::error!(session_id = %session_id, "ETH claim error: {e}"),
        }
    }
}

/// Convert a WS URL to an HTTP URL for log fetching.
fn ws_to_http(ws_url: &str) -> String {
    ws_url
        .replace("wss://", "https://")
        .replace("ws://", "http://")
}

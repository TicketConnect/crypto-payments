use alloy::primitives::{Address, U256};
use alloy::providers::{Provider, ProviderBuilder, WsConnect};
use alloy::rpc::types::Filter;
use alloy::sol;
use futures_util::StreamExt;
use sqlx::PgPool;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Duration;

sol! {
    #[sol(rpc)]
    interface IERC20 {
        function balanceOf(address account) external view returns (uint256);
    }
}

/// Follow the chain head via WS `newHeads`, fetch Transfer logs per block via HTTP.
/// Falls back to HTTP polling if the WS subscription drops.
pub async fn watch(pool: &PgPool, ws_url: &str, chain_id: u64) -> eyre::Result<()> {
    let http_url = ws_to_http(ws_url);
    let http_provider = ProviderBuilder::new().connect_http(http_url.parse()?);
    
    // Track last processed block to handle WS outages and catch up
    let mut last_processed_block: u64 = 0;

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
        if let Err(e) = poll_once(pool, &http_provider, chain_id, &mut last_processed_block).await {
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
    last_processed_block: &mut u64,
) -> eyre::Result<()> {
    let block_number = http_provider.get_block_number().await?;
    
    // If we haven't processed any blocks yet, start from the latest
    if *last_processed_block == 0 {
        *last_processed_block = block_number;
    }
    
    // Process any missed blocks
    if block_number > *last_processed_block {
        for n in *last_processed_block + 1..=block_number {
            if let Err(e) = process_block(pool, http_provider, chain_id, n).await {
                tracing::error!(block_number = n, "process_block error: {e}");
            }
        }
        *last_processed_block = block_number;
    }
    
    Ok(())
}

/// Fetch Transfer logs for a specific block and match against pending sessions.
async fn process_block(
    pool: &PgPool,
    provider: &impl Provider,
    chain_id: u64,
    block_number: u64,
) -> eyre::Result<()> {
    // Reorg protection: only process blocks that are at least CONFIRMATION_DEPTH blocks old
    const CONFIRMATION_DEPTH: u64 = 5; // Base chain confirmation depth
    
    let current_block = provider.get_block_number().await?;
    if block_number + CONFIRMATION_DEPTH > current_block {
        // Skip blocks that aren't deep enough to avoid reorgs
        return Ok(());
    }

    // Build in-memory set of burner addresses for efficient filtering
    let burners = match crate::db::get_pending_burners(pool).await {
        Ok(burners) => {
            let set: HashSet<String> = burners.into_iter().map(|(_, addr)| addr.to_lowercase()).collect();
            Arc::new(set)
        }
        Err(e) => {
            tracing::error!("Failed to get pending burners: {e}");
            Arc::new(HashSet::new())
        }
    };

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
        let to_hex = format!("{to_address:#x}").to_lowercase();
        
        // Pre-check against in-memory burner set before hitting Postgres
        if !burners.contains(&to_hex) {
            continue;
        }

        let session = match crate::db::get_session_by_address(pool, &to_hex).await {
            Ok(Some(s)) => s,
            Ok(None) => continue,
            Err(e) => {
                tracing::error!("db error: {e}");
                continue;
            }
        };

        // Read the raw log amount first.
        let log_amount = if log.data().data.len() >= 32 {
            U256::from_be_slice(&log.data().data[..32])
        } else {
            U256::ZERO
        };

        // Re-read the actual burner balance via balanceOf to handle
        // fee-on-transfer (FoT) tokens. FoT tokens deduct a fee during
        // transfer, so the amount that actually arrives at the burner is
        // less than what the Transfer log reports. Using the log amount
        // would cause the sweeper to request more tokens than exist,
        // failing the Uniswap swap.
        let actual_amount = match IERC20::new(log.address(), provider)
            .balanceOf(to_address)
            .call()
            .await
        {
            Ok(bal) => bal,
            Err(e) => {
                tracing::warn!(
                    session_id = %session.id,
                    "balanceOf call failed, falling back to log amount: {e}"
                );
                log_amount
            }
        };

        if actual_amount != log_amount {
            tracing::warn!(
                session_id = %session.id,
                log_amount = %log_amount,
                actual_balance = %actual_amount,
                "fee-on-transfer token: log amount differs from balanceOf; using actual balance"
            );
        }

        let token_address = format!("{:#x}", log.address());
        let tx_hash = log
            .transaction_hash
            .map(|h| format!("{h:#x}"))
            .unwrap_or_default();

        tracing::info!(
            session_id = %session.id,
            token = %token_address,
            log_amount = %log_amount,
            actual_amount = %actual_amount,
            tx = %tx_hash,
            "deposit detected"
        );

        match crate::db::claim_for_detection(
            pool,
            session.id,
            chain_id as i32,
            &token_address,
            &actual_amount.to_string(),  // store real balance, not log amount
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

/// Poll native gas balances for pending sessions on THIS chain only.
/// If a burner has a balance, claim it using the chain's wrapped_native address
/// as the synthetic detected_token (the sweeper will wrap it before swap).
async fn check_eth_balances(
    pool: &PgPool,
    provider: &impl Provider,
    chain_id: u64,
) {
    let chain = match crate::chains::get_chain(chain_id) {
        Some(c) => c,
        None => {
            tracing::error!(chain_id, "unsupported chain in indexer");
            return;
        }
    };

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

        let wrapped = format!("{:#x}", chain.wrapped_native);

        tracing::info!(
            session_id = %session_id,
            balance = %balance,
            chain = chain.name,
            "native gas deposit detected"
        );

        match crate::db::claim_for_detection(
            pool,
            session_id,
            chain_id as i32,
            &wrapped,
            &balance.to_string(),
            "",
        )
        .await
        {
            Ok(true) => tracing::info!(session_id = %session_id, "claimed native deposit for detection"),
            Ok(false) => {}
            Err(e) => tracing::error!(session_id = %session_id, "native claim error: {e}"),
        }
    }
}

/// Convert a WS URL to an HTTP URL for log fetching.
fn ws_to_http(ws_url: &str) -> String {
    ws_url
        .replace("wss://", "https://")
        .replace("ws://", "http://")
}

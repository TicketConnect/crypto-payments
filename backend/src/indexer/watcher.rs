use alloy::primitives::{Address, U256};
use alloy::providers::{Provider, ProviderBuilder, WsConnect};
use alloy::rpc::types::Filter;
use futures_util::StreamExt;
use sqlx::PgPool;

pub async fn watch(pool: &PgPool, ws_url: &str, chain_id: u64) -> eyre::Result<()> {
    let ws = WsConnect::new(ws_url);
    let provider = ProviderBuilder::new().connect_ws(ws).await?;

    // Transfer(address indexed from, address indexed to, uint256 value)
    let filter = Filter::new().event("Transfer(address,address,uint256)");

    let sub = provider.subscribe_logs(&filter).await?;
    let mut stream = sub.into_stream();

    tracing::info!("subscribed to Transfer events on chain {chain_id}");

    while let Some(log) = stream.next().await {
        if log.topics().len() < 3 {
            continue;
        }

        let to_address = Address::from_word(log.topics()[2]);
        let to_hex = format!("{to_address:#x}");

        // Check if any pending session is watching this address
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

    Ok(())
}

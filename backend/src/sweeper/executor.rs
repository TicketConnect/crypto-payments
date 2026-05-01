use alloy::eips::eip7702::SignedAuthorization;
use alloy::network::{TransactionBuilder, TransactionBuilder7702};
use alloy::primitives::{Address, Bytes, FixedBytes, U256};
use alloy::providers::{Provider, ProviderBuilder};
use alloy::rpc::types::{TransactionReceipt, TransactionRequest};
use alloy::signers::local::PrivateKeySigner;
use alloy::sol;
use alloy::sol_types::SolCall;
use sqlx::PgPool;

use crate::auth::reconstruct_auth;
use crate::chains::ChainConfig;
use crate::config::Config;
use crate::types::DepositSession;
use crate::uniswap::{self, QuoteParams};

/// Estimate gas for a transaction and apply a buffer percentage
async fn estimate_gas_with_buffer(
    provider: &impl Provider,
    tx: TransactionRequest,
    buffer_percent: u64,
) -> eyre::Result<u64> {
    let estimated = provider.estimate_gas(tx).await?;
    // Apply buffer: estimated * (100 + buffer_percent) / 100
    let buffered = estimated * (100 + buffer_percent) / 100;
    Ok(buffered)
}

sol! {
    #[sol(rpc)]
    interface IERC20 {
        function approve(address spender, uint256 amount) external returns (bool);
        function transfer(address to, uint256 amount) external returns (bool);
        function balanceOf(address account) external view returns (uint256);
    }

    interface IERC7821 {
        function execute(bytes32 mode, bytes calldata executionData) external payable;
    }

    interface IDepositoorDelegate {
        function sweep(address token, address to) external;
    }

    interface IWETH {
        function deposit() external payable;
    }
}

// ── Call builders ────────────────────────────────────────────────────────────

type Call = (Address, U256, Bytes);

fn sweep_call(burner: Address, token: Address, to: Address) -> Call {
    let data = IDepositoorDelegate::sweepCall { token, to }.abi_encode();
    (burner, U256::ZERO, data.into())
}

/// WETH.deposit{value: amount}() — wrap native ETH to WETH
fn weth_deposit_call(weth: Address, amount: U256) -> Call {
    let data = IWETH::depositCall {}.abi_encode();
    (weth, amount, data.into())
}

fn approve_call(token: Address, spender: Address, amount: U256) -> Call {
    let data = IERC20::approveCall { spender, amount }.abi_encode();
    (token, U256::ZERO, data.into())
}

fn transfer_call(token: Address, to: Address, amount: U256) -> Call {
    let data = IERC20::transferCall { to, amount }.abi_encode();
    (token, U256::ZERO, data.into())
}

/// Get Uniswap swap calls: [approve token → proxy, swap].
/// `recipient` controls where output tokens land (swapper trick).
async fn swap_calls(
    config: &Config,
    chain: &ChainConfig,
    token_in: Address,
    amount: U256,
    recipient: Address,
) -> eyre::Result<Vec<Call>> {
    let quote = uniswap::get_quote(
        &config.uniswap_api_key,
        QuoteParams {
            swapper: format!("{recipient:#x}"),
            token_in: format!("{token_in:#x}"),
            token_out: format!("{:#x}", chain.usdc_address),
            token_in_chain_id: chain.chain_id.to_string(),
            token_out_chain_id: chain.chain_id.to_string(),
            amount: amount.to_string(),
            quote_type: "EXACT_INPUT".into(),
            slippage_tolerance: config.slippage_tolerance,
            routing_preference: "BEST_PRICE".into(),
        },
        false,
    )
    .await?;

    // Check price impact - abort if it exceeds threshold
    if let Some(price_impact) = uniswap::get_price_impact_percent(&quote) {
        if price_impact > config.max_price_impact_percent {
            return Err(eyre::eyre!("price impact too high: {}%", price_impact));
        }
    }

    let tx = uniswap::get_swap_calldata(&config.uniswap_api_key, quote, false).await?;
    let router: Address = tx.to.parse()?;
    let data = Bytes::from(hex::decode(tx.data.trim_start_matches("0x"))?);
    let value = parse_value(&tx.value);

    Ok(vec![approve_call(token_in, router, amount), (router, value, data)])
}

/// Get Uniswap BRIDGE calls: [approve USDC → bridge proxy, bridge call].
/// `recipient` controls where USDC lands on dest chain (swapper trick).
async fn bridge_calls(
    config: &Config,
    chain: &ChainConfig,
    dest_chain_id: u64,
    amount: U256,
    recipient: Address,
) -> eyre::Result<Vec<Call>> {
    let dest_chain = crate::chains::get_chain(dest_chain_id)
        .ok_or_else(|| eyre::eyre!("unsupported dest chain: {dest_chain_id}"))?;

    let quote = uniswap::get_bridge_quote(
        &config.uniswap_api_key,
        &format!("{recipient:#x}"),
        &format!("{:#x}", chain.usdc_address),
        &format!("{:#x}", dest_chain.usdc_address),
        chain.chain_id,
        dest_chain_id,
        &amount.to_string(),
        config.slippage_tolerance,
        config.max_price_impact_percent,
    )
    .await?;

    let tx = uniswap::get_bridge_calldata(&config.uniswap_api_key, quote).await?;
    let bridge: Address = tx.to.parse()?;
    let data = Bytes::from(hex::decode(tx.data.trim_start_matches("0x"))?);
    let value = parse_value(&tx.value);

    Ok(vec![approve_call(chain.usdc_address, bridge, amount), (bridge, value, data)])
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn encode_execute(calls: Vec<Call>) -> Bytes {
    let mut mode = [0u8; 32];
    mode[0] = 0x01;
    let execution_data = alloy::sol_types::SolValue::abi_encode(&calls);
    Bytes::from(
        IERC7821::executeCall {
            mode: FixedBytes::from(mode),
            executionData: execution_data.into(),
        }
        .abi_encode(),
    )
}
 
fn parse_hex_u256(s: &str) -> U256 {
    U256::from_str_radix(s.trim_start_matches("0x"), 16).unwrap_or(U256::ZERO)
}
 
fn parse_value(s: &str) -> U256 {
    if s.starts_with("0x") || s.starts_with("0X") {
        parse_hex_u256(s)
    } else {
        U256::from_str_radix(s, 10).unwrap_or(U256::ZERO)
    }
}

fn require_success(receipt: &TransactionReceipt, label: &str) -> eyre::Result<()> {
    if !receipt.status() {
        return Err(eyre::eyre!("{label} reverted: {:#x}", receipt.transaction_hash));
    }
    Ok(())
}

fn apply_fee_bps(amount: U256, fee_bps: u64) -> (U256, U256) {
    let fee = amount * U256::from(fee_bps) / U256::from(10_000u64);
    (fee, amount - fee)
}

// ── Main entry point ─────────────────────────────────────────────────────────

/// Execute a deposit sweep.
///
/// | Source token | Destination | Flow                                                        |
/// |-------------|-------------|-------------------------------------------------------------|
/// | USDC        | same chain  | single tx: `sweep(USDC, dest)` or fee-split transfers       |
/// | non-USDC    | same chain  | single tx: `approve + swap` (output → dest)                 |
/// | USDC        | cross-chain | TX1: fee transfer + bridge via Uniswap                      |
/// | non-USDC    | cross-chain | TX1: swap to USDC (output → burner), TX2: fee + bridge      |
pub async fn execute_sweep(
    pool: &PgPool,
    config: &Config,
    chain: &ChainConfig,
    rpc_url: &str,
    session: &DepositSession,
) -> eyre::Result<()> {
    let detected_token: Address = session.detected_token.as_ref()
        .ok_or_else(|| eyre::eyre!("no detected token"))?.parse()?;
    let burner: Address = session.burner_address.parse()?;
    let dest: Address = session.dest_address.parse()?;
    let signed_auth = reconstruct_auth(&session.eip7702_auth)?;

    let signer: PrivateKeySigner = config.relayer_private_key.parse()?;
    let provider = ProviderBuilder::new().wallet(signer).connect_http(rpc_url.parse()?);

    // Check if this is a native gas deposit (detected_token == wrapped_native but balance is native)
    let weth_address: Address = chain.wrapped_native;
    let is_native_eth = detected_token == weth_address;
    let eth_balance = provider.get_balance(burner).await?;
    let has_native_eth = is_native_eth && !eth_balance.is_zero();

    let amount = if has_native_eth {
        eth_balance
    } else {
        IERC20::new(detected_token, &provider).balanceOf(burner).call().await?
    };

    if amount.is_zero() {
        return Err(eyre::eyre!("zero token balance at burner"));
    }

    let fee_bps = u64::from(config.fee_bps);
    let treasury = config.treasury_address;
    let apply_fee = fee_bps > 0 && treasury.is_some();
    let (fee_amount, dest_amount) = if apply_fee {
        apply_fee_bps(amount, fee_bps)
    } else {
        (U256::ZERO, amount)
    };

    let is_usdc = detected_token == chain.usdc_address;
    let same_chain = session.source_chain_id == Some(session.dest_chain_id);

    tracing::info!(
        session_id = %session.id,
        token = %format!("{detected_token:#x}"),
        amount = %amount,
        fee_bps,
        fee_amount = %fee_amount,
        dest_amount = %dest_amount,
        is_usdc,
        same_chain,
        native_eth = has_native_eth,
        "executing sweep"
    );

    match (same_chain, is_usdc) {
        // ── Same-chain USDC ─────────────────────────────────────────
        (true, true) => {
            let calls = if apply_fee {
                let t = treasury.unwrap();
                vec![
                    transfer_call(chain.usdc_address, t, fee_amount),
                    transfer_call(chain.usdc_address, dest, dest_amount),
                ]
            } else {
                vec![sweep_call(burner, chain.usdc_address, dest)]
            };
            let receipt = send_7702_batch(&provider, config, burner, vec![signed_auth], calls).await?;
            let tx_hash = format!("{:#x}", receipt.transaction_hash);
            tracing::info!(session_id = %session.id, tx = %tx_hash, "same-chain USDC sweep confirmed");
            crate::db::mark_swept(pool, session.id, &tx_hash, &amount.to_string(), &fee_amount.to_string(), &dest_amount.to_string()).await?;
        }

        // ── Same-chain swap ─────────────────────────────────────────
        (true, false) => {
            // When fee applies, swap to burner so we can split the actual post-slippage
            // USDC afterwards. Otherwise swap output goes directly to dest.
            let swap_recipient = if apply_fee { burner } else { dest };
            let mut calls = vec![];
            if has_native_eth {
                calls.push(weth_deposit_call(weth_address, amount));
            }
            calls.extend(swap_calls(config, chain, detected_token, amount, swap_recipient).await?);
            let receipt = send_7702_batch(&provider, config, burner, vec![signed_auth], calls).await?;
            let tx_hash = format!("{:#x}", receipt.transaction_hash);
            tracing::info!(session_id = %session.id, tx = %tx_hash, "same-chain swap confirmed");

            if apply_fee {
                let t = treasury.unwrap();
                // Read actual USDC received (slippage means we can't predict exact amount).
                let usdc_balance = IERC20::new(chain.usdc_address, &provider)
                    .balanceOf(burner).call().await?;
                let (fee_usdc, dest_usdc) = apply_fee_bps(usdc_balance, fee_bps);

                // Split from burner — delegation persists, no auth needed.
                let split_calls = vec![
                    transfer_call(chain.usdc_address, t, fee_usdc),
                    transfer_call(chain.usdc_address, dest, dest_usdc),
                ];
                let split_tx = TransactionRequest::default()
                    .with_to(burner)
                    .with_input(encode_execute(split_calls));
                let split_tx = split_tx.clone().with_gas_limit(
                    estimate_gas_with_buffer(&provider, split_tx, config.gas_limit_buffer).await?,
                );
                let split_receipt = provider.send_transaction(split_tx).await?.get_receipt().await?;
                require_success(&split_receipt, "fee split tx")?;
                tracing::info!(session_id = %session.id, fee = %fee_usdc, dest = %dest_usdc, "fee split confirmed");
                crate::db::mark_swept(pool, session.id, &tx_hash, &amount.to_string(), &fee_usdc.to_string(), &dest_usdc.to_string()).await?;
            } else {
                crate::db::mark_swept(pool, session.id, &tx_hash, &amount.to_string(), "0", &amount.to_string()).await?;
            }
        }

        // ── Cross-chain USDC ────────────────────────────────────────
        (false, true) => {
            // Fee transfer happens on source chain; bridge sends dest_amount to dest chain.
            let mut calls = vec![];
            if apply_fee {
                calls.push(transfer_call(chain.usdc_address, treasury.unwrap(), fee_amount));
            }
            calls.extend(bridge_calls(config, chain, session.dest_chain_id as u64, dest_amount, dest).await?);
            let receipt = send_7702_batch(&provider, config, burner, vec![signed_auth], calls).await?;
            let tx_hash = format!("{:#x}", receipt.transaction_hash);
            tracing::info!(session_id = %session.id, tx = %tx_hash, "cross-chain USDC bridge submitted");
            // Source-chain tx confirmed; the bridge poller will transition this
            // to `swept` once Across delivers USDC on the destination chain.
            crate::db::mark_bridging(
                pool,
                session.id,
                &tx_hash,
                &amount.to_string(),
                &fee_amount.to_string(),
                &tx_hash,
                &dest_amount.to_string(),
            ).await?;
        }

        // ── Cross-chain swap ───────────────────────────────────────
        (false, false) => {
            // TX1: swap to USDC (stays at burner)
            let mut swap = vec![];
            if has_native_eth {
                swap.push(weth_deposit_call(weth_address, amount));
            }
            swap.extend(swap_calls(config, chain, detected_token, amount, burner).await?);
            let receipt1 = send_7702_batch(&provider, config, burner, vec![signed_auth], swap).await?;
            let tx1_hash = format!("{:#x}", receipt1.transaction_hash);
            tracing::info!(session_id = %session.id, tx = %tx1_hash, "TX1: swap to USDC confirmed");

            // Poll USDC balance until non-zero (RPC may lag a block)
            let usdc = IERC20::new(chain.usdc_address, &provider);
            let mut usdc_balance = U256::ZERO;
            for _ in 0..10 {
                usdc_balance = usdc.balanceOf(burner).call().await?;
                if !usdc_balance.is_zero() { break; }
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
            }
            if usdc_balance.is_zero() {
                return Err(eyre::eyre!("zero USDC after swap (polled 10s)"));
            }
            tracing::info!(session_id = %session.id, usdc = %usdc_balance, "post-swap USDC at burner");

            // Compute fee on actual USDC received
            let (fee_usdc, bridge_amount) = if apply_fee {
                apply_fee_bps(usdc_balance, fee_bps)
            } else {
                (U256::ZERO, usdc_balance)
            };

            // TX2: optionally send fee to treasury, then bridge remainder (delegation persists)
            let mut bridge = vec![];
            if apply_fee {
                bridge.push(transfer_call(chain.usdc_address, treasury.unwrap(), fee_usdc));
            }
            bridge.extend(bridge_calls(config, chain, session.dest_chain_id as u64, bridge_amount, dest).await?);
            let tx2 = TransactionRequest::default()
                .with_to(burner)
                .with_input(encode_execute(bridge));
            let tx2_gas = estimate_gas_with_buffer(&provider, tx2.clone(), config.gas_limit_buffer).await?;
            let tx2 = tx2.with_gas_limit(tx2_gas);
            let receipt2 = provider.send_transaction(tx2).await?.get_receipt().await?;
            require_success(&receipt2, "bridge tx")?;
            let tx2_hash = format!("{:#x}", receipt2.transaction_hash);
            tracing::info!(session_id = %session.id, tx = %tx2_hash, "TX2: bridge submitted");

            // TX2 (the bridge) confirmed on source chain. Poller will mark
            // `swept` once Across delivers on dest. Record TX1 as `sweep_tx`,
            // TX2 as `bridge_tx` — that's the tx the poller checks status on.
            crate::db::mark_bridging(
                pool,
                session.id,
                &tx1_hash,
                &usdc_balance.to_string(),
                &fee_usdc.to_string(),
                &tx2_hash,
                &bridge_amount.to_string(),
            ).await?;
        }
    }

    Ok(())
}

/// Send an EIP-7702 batched transaction and wait for receipt.
async fn send_7702_batch(
    provider: &impl Provider,
    config: &Config,
    to: Address,
    auth_list: Vec<SignedAuthorization>,
    calls: Vec<Call>,
) -> eyre::Result<TransactionReceipt> {
     let tx = TransactionRequest::default()
         .with_to(to)
         .with_authorization_list(auth_list)
         .with_input(encode_execute(calls));
     let tx_gas_limit = estimate_gas_with_buffer(&provider, tx.clone(), config.gas_limit_buffer).await?;
     let tx = tx.with_gas_limit(tx_gas_limit);

    let receipt = provider.send_transaction(tx).await?.get_receipt().await?;
    require_success(&receipt, "7702 batch tx")?;
    Ok(receipt)
}

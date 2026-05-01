use alloy::network::{TransactionBuilder, TransactionBuilder7702};
use alloy::primitives::{Address, Bytes, FixedBytes, Signature, U256};
use alloy::providers::{Provider, ProviderBuilder};
use alloy::rpc::types::TransactionRequest;
use alloy::signers::local::PrivateKeySigner;
use alloy::sol;
use alloy::sol_types::SolCall;
use axum::extract::{Json, Path, State};
use serde::Deserialize;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::reconstruct_auth;

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

use crate::chains;
use crate::error::AppError;
use crate::types::{RegisterSessionRequest, RegisterSessionResponse, SessionStatus};

sol! {
    interface IDepositoorDelegate {
        function sweep(address token, address to) external;
    }

    interface IERC7821 {
        function execute(bytes32 mode, bytes calldata executionData) external payable;
    }
}

pub async fn register(
    State(state): State<Arc<super::AppState>>,
    Json(req): Json<RegisterSessionRequest>,
) -> Result<Json<RegisterSessionResponse>, AppError> {
    if chains::get_chain(req.destination_chain as u64).is_none() {
        return Err(AppError::BadRequest(format!(
            "unsupported destination chain: {}",
            req.destination_chain
        )));
    }

    let session = crate::db::insert_session(&state.pool, &req).await?;

    // TTL: 30 minutes from now
    let expires_at = (chrono::Utc::now() + chrono::Duration::minutes(30)).timestamp();

    Ok(Json(RegisterSessionResponse {
        id: session.id,
        status: SessionStatus::Pending,
        expires_at,
    }))
}

pub async fn get_session(
    State(state): State<Arc<super::AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<crate::types::DepositSession>, AppError> {
    let session = crate::db::get_session(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("session {id} not found")))?;

    Ok(Json(session))
}

#[derive(Debug, Deserialize)]
pub struct RefundRequest {
    pub refund_address: String,
    /// Unix seconds; signature is rejected if `now > deadline`.
    pub deadline: u64,
    /// EIP-191 personal_sign signature from the burner private key over
    /// `refund_message(session_id, refund_address, deadline)` (see below).
    /// 0x-prefixed hex.
    pub signature: String,
}

/// Canonical message a burner must sign to authorize a refund. Includes the
/// session id, destination, and a deadline so a leaked signature can't be
/// replayed forever or redirected to a different recipient.
fn refund_message(session_id: Uuid, refund_address: &Address, deadline: u64) -> String {
    format!(
        "depositoor refund\nsession: {session_id}\nto: {refund_address:#x}\ndeadline: {deadline}"
    )
}

pub async fn refund(
    State(state): State<Arc<super::AppState>>,
    Path(id): Path<Uuid>,
    Json(req): Json<RefundRequest>,
) -> Result<Json<serde_json::Value>, AppError> {
    let session = crate::db::get_session(&state.pool, id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("session {id} not found")))?;

    let detected_token: Address = session
        .detected_token
        .as_ref()
        .ok_or_else(|| AppError::BadRequest("no detected token".into()))?
        .parse()
        .map_err(|_| AppError::BadRequest("invalid token address".into()))?;

    let burner: Address = session.burner_address.parse()
        .map_err(|_| AppError::BadRequest("invalid burner address".into()))?;
    let refund_to: Address = req.refund_address.parse()
        .map_err(|_| AppError::BadRequest("invalid refund address".into()))?;

    // ── AuthZ: deadline + signature must recover to the burner ─────────────
    let now = chrono::Utc::now().timestamp() as u64;
    if req.deadline <= now {
        return Err(AppError::BadRequest("refund authorization expired".into()));
    }

    let signature = Signature::from_str(req.signature.trim_start_matches("0x"))
        .map_err(|_| AppError::BadRequest("invalid signature".into()))?;
    let message = refund_message(id, &refund_to, req.deadline);
    let recovered = signature
        .recover_address_from_msg(message.as_bytes())
        .map_err(|_| AppError::BadRequest("signature recovery failed".into()))?;
    if recovered != burner {
        return Err(AppError::BadRequest("signature does not match burner".into()));
    }

    // ── Pick server-trusted RPC for this session's source chain ────────────
    let source_chain_id = session.source_chain_id
        .ok_or_else(|| AppError::BadRequest("session has no source chain".into()))? as u64;
    let rpc_url = state.config.rpc_urls.get(&source_chain_id)
        .ok_or_else(|| AppError::Internal(
            format!("no RPC configured for chain {source_chain_id}; set RPC_URL_{source_chain_id}")
        ))?;

     // Reconstruct EIP-7702 auth
     let auth = reconstruct_auth(&session.eip7702_auth)
         .map_err(|_| AppError::BadRequest("invalid auth".into()))?;

    // Build sweep call
    let sweep_call = IDepositoorDelegate::sweepCall { token: detected_token, to: refund_to };

    // ERC-7821 batch mode
    let mut mode_bytes = [0u8; 32];
    mode_bytes[0] = 0x01;
    let execute_call = IERC7821::executeCall {
        mode: FixedBytes::from(mode_bytes),
        executionData: alloy::sol_types::SolValue::abi_encode(
            &vec![(burner, U256::ZERO, Bytes::from(sweep_call.abi_encode()))]
        ).into(),
    };

    let signer: PrivateKeySigner = state.config.relayer_private_key.parse()
        .map_err(|_| AppError::Internal("bad relayer key".into()))?;
    let provider = ProviderBuilder::new()
        .wallet(signer)
        .connect_http(rpc_url.parse()
            .map_err(|_| AppError::Internal("invalid configured rpc_url".into()))?);

    let tx = TransactionRequest::default()
        .with_to(burner)
        .with_authorization_list(vec![auth])
        .with_input(Bytes::from(execute_call.abi_encode()));
     let tx = tx.clone().with_gas_limit(estimate_gas_with_buffer(&provider, tx, state.config.gas_limit_buffer).await?);

    let receipt = provider.send_transaction(tx).await
        .map_err(|e| AppError::Internal(format!("send tx failed: {e}")))?
        .get_receipt().await
        .map_err(|e| AppError::Internal(format!("receipt failed: {e}")))?;

    let tx_hash = format!("{:#x}", receipt.transaction_hash);

    if !receipt.status() {
        return Err(AppError::Internal(format!("refund tx reverted: {tx_hash}")));
    }

    tracing::info!(session_id = %id, tx = %tx_hash, refund_to = %req.refund_address, "refund sent");

    Ok(Json(serde_json::json!({
        "tx_hash": tx_hash,
        "refund_address": req.refund_address,
        "token": session.detected_token,
    })))
}

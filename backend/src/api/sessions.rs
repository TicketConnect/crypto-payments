use axum::extract::{Json, Path, State};
use std::sync::Arc;
use uuid::Uuid;

use crate::chains;
use crate::error::AppError;
use crate::types::{RegisterSessionRequest, RegisterSessionResponse, SessionStatus};

pub async fn register(
    State(state): State<Arc<super::AppState>>,
    Json(req): Json<RegisterSessionRequest>,
) -> Result<Json<RegisterSessionResponse>, AppError> {
    let cctp_domain = chains::chain_id_to_cctp_domain(req.destination_chain as u64)
        .ok_or_else(|| AppError::BadRequest(format!(
            "unsupported destination chain: {}",
            req.destination_chain
        )))?;

    let session = crate::db::insert_session(&state.pool, &req, cctp_domain).await?;

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

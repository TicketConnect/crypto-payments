use axum::{routing::{get, post}, Router};
use sqlx::PgPool;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use crate::config::Config;

mod sessions;
mod sse;

pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
}

pub async fn run() -> eyre::Result<()> {
    let config = Config::from_env()?;
    let pool = PgPool::connect(&config.database_url).await?;
    crate::db::init_db(&pool).await?;

    let state = Arc::new(AppState { pool, config: config.clone() });

    let app = Router::new()
        .route("/sessions", post(sessions::register))
        .route("/sessions/{id}", get(sessions::get_session))
        .route("/sessions/{id}/events", get(sse::session_events))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!("api listening on {}", config.listen_addr);
    axum::serve(listener, app).await?;
    Ok(())
}

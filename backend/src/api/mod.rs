use axum::{routing::{get, post}, Router};
use sqlx::PgPool;
use std::sync::Arc;
use tower::ServiceBuilder;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
use tower_governor::GovernorLayer;
use tower_governor::governor::GovernorConfigBuilder;
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

    // Configure CORS with restrictive settings for production
    let cors = CorsLayer::new()
        .allow_origin(Any) // In production, replace with specific origins
        .allow_methods(Any)
        .allow_headers(Any);

    // Rate limit: replenish 1 token every 6s (= 10 / minute), burst of 10.
    // The previous `per_second(10/60)` integer-divided to 0 and effectively
    // blocked all traffic; use `period` to express sub-second rates correctly.
    let governor_conf = GovernorConfigBuilder::default()
        .period(Duration::from_secs(6))
        .burst_size(10)
        .key_extractor(tower_governor::key_extractor::PeerIpKeyExtractor)
        .finish()
        .unwrap();
    
    let app = Router::new()
        .route("/sessions", post(sessions::register))
        .route("/sessions/{id}", get(sessions::get_session))
        .route("/sessions/{id}/refund", post(sessions::refund))
        .route("/sessions/{id}/events", get(sse::session_events))
        .layer(cors)
        .layer(ServiceBuilder::new().layer(GovernorLayer::new(Arc::new(governor_conf))))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&config.listen_addr).await?;
    tracing::info!("api listening on {}", config.listen_addr);
    axum::serve(listener, app).await?;
    Ok(())
}

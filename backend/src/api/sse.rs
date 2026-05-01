use axum::extract::{Path, State};
use axum::response::sse::{Event, Sse};
use futures_util::stream::Stream;
use sqlx::PgPool;
use sqlx::postgres::PgListener;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::OnceCell;
use tokio::sync::broadcast::{self, Sender};
use tokio::sync::broadcast::error::RecvError;
use uuid::Uuid;

/// Global broadcast sender, initialized exactly once on the first SSE
/// connection. A single Postgres LISTEN connection fans out to all
/// subscribers via tokio's broadcast channel — avoids opening a dedicated
/// DB connection per SSE client.
static SSE_TX: OnceCell<Sender<String>> = OnceCell::const_new();

async fn get_sse_tx(pool: &PgPool) -> &'static Sender<String> {
    SSE_TX
        .get_or_init(|| async {
            let (tx, _) = broadcast::channel::<String>(256);

            // Spawn the single listener task. It owns one Postgres connection
            // and forwards every notification to the broadcast channel.
            let pool = pool.clone();
            let tx_clone = tx.clone();
            tokio::spawn(async move {
                loop {
                    let mut listener = match PgListener::connect_with(&pool).await {
                        Ok(l) => l,
                        Err(e) => {
                            tracing::error!("PgListener connect failed: {e}; retrying in 5s");
                            tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                            continue;
                        }
                    };
                    if let Err(e) = listener.listen("session_updates").await {
                        tracing::error!("LISTEN session_updates failed: {e}; retrying");
                        tokio::time::sleep(std::time::Duration::from_secs(5)).await;
                        continue;
                    }
                    loop {
                        match listener.recv().await {
                            Ok(notification) => {
                                // Best-effort send; ok if there are no receivers yet.
                                let _ = tx_clone.send(notification.payload().to_string());
                            }
                            Err(e) => {
                                tracing::warn!("PgListener recv error: {e}; reconnecting");
                                break;
                            }
                        }
                    }
                }
            });

            tx
        })
        .await
}

pub async fn session_events(
    State(state): State<Arc<super::AppState>>,
    Path(id): Path<Uuid>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let id_str = id.to_string();

    // Lazily initialize the shared listener exactly once, then subscribe.
    let tx = get_sse_tx(&state.pool).await;
    let rx = tx.subscribe();

    let stream = async_stream::stream! {
        // Send current state immediately
        if let Ok(Some(session)) = crate::db::get_session(&state.pool, id).await {
            let data = serde_json::to_string(&session).unwrap_or_default();
            yield Ok(Event::default().event("status").data(data));
        }

        let mut rx = rx;
        loop {
            match rx.recv().await {
                Ok(notification_id) => {
                    if notification_id == id_str {
                        if let Ok(Some(session)) = crate::db::get_session(&state.pool, id).await {
                            let data = serde_json::to_string(&session).unwrap_or_default();
                            yield Ok(Event::default().event("status").data(data));
                        }
                    }
                }
                Err(RecvError::Lagged(_)) => continue,
                Err(RecvError::Closed) => break,
            }
        }
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(std::time::Duration::from_secs(15))
    )
}
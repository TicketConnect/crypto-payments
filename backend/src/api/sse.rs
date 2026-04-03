use axum::extract::{Path, State};
use axum::response::sse::{Event, Sse};
use futures_util::stream::Stream;
use sqlx::postgres::PgListener;
use std::convert::Infallible;
use std::sync::Arc;
use uuid::Uuid;

pub async fn session_events(
    State(state): State<Arc<super::AppState>>,
    Path(id): Path<Uuid>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let pool = state.pool.clone();
    let id_str = id.to_string();

    let stream = async_stream::stream! {
        // Send current state immediately
        if let Ok(Some(session)) = crate::db::get_session(&pool, id).await {
            let data = serde_json::to_string(&session).unwrap_or_default();
            yield Ok(Event::default().event("status").data(data));
        }

        // Listen for updates
        let mut listener = match PgListener::connect_with(&pool).await {
            Ok(l) => l,
            Err(_) => return,
        };
        if listener.listen("session_updates").await.is_err() {
            return;
        }

        loop {
            match listener.recv().await {
                Ok(notification) => {
                    if notification.payload() == id_str {
                        if let Ok(Some(session)) = crate::db::get_session(&pool, id).await {
                            let data = serde_json::to_string(&session).unwrap_or_default();
                            yield Ok(Event::default().event("status").data(data));
                        }
                    }
                }
                Err(_) => break,
            }
        }
    };

    Sse::new(stream).keep_alive(
        axum::response::sse::KeepAlive::new()
            .interval(std::time::Duration::from_secs(15))
    )
}

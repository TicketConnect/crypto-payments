use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SessionStatus {
    Pending,
    Detected,
    Sweeping,
    Bridging,
    Swept,
    Failed,
}

impl std::fmt::Display for SessionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Detected => write!(f, "detected"),
            Self::Sweeping => write!(f, "sweeping"),
            Self::Bridging => write!(f, "bridging"),
            Self::Swept => write!(f, "swept"),
            Self::Failed => write!(f, "failed"),
        }
    }
}

impl std::str::FromStr for SessionStatus {
    type Err = eyre::Report;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "pending" => Ok(Self::Pending),
            "detected" => Ok(Self::Detected),
            "sweeping" => Ok(Self::Sweeping),
            "bridging" => Ok(Self::Bridging),
            "swept" => Ok(Self::Swept),
            "failed" => Ok(Self::Failed),
            _ => Err(eyre::eyre!("unknown status: {s}")),
        }
    }
}

// sqlx traits for TEXT <-> SessionStatus mapping
impl sqlx::Type<sqlx::Postgres> for SessionStatus {
    fn type_info() -> sqlx::postgres::PgTypeInfo {
        <String as sqlx::Type<sqlx::Postgres>>::type_info()
    }
}

impl<'r> sqlx::Decode<'r, sqlx::Postgres> for SessionStatus {
    fn decode(
        value: sqlx::postgres::PgValueRef<'r>,
    ) -> Result<Self, Box<dyn std::error::Error + Send + Sync>> {
        let s = <String as sqlx::Decode<sqlx::Postgres>>::decode(value)?;
        match s.as_str() {
            "pending" => Ok(Self::Pending),
            "detected" => Ok(Self::Detected),
            "sweeping" => Ok(Self::Sweeping),
            "bridging" => Ok(Self::Bridging),
            "swept" => Ok(Self::Swept),
            "failed" => Ok(Self::Failed),
            other => Err(format!("unknown session status: {other}").into()),
        }
    }
}

impl sqlx::Encode<'_, sqlx::Postgres> for SessionStatus {
    fn encode_by_ref(
        &self,
        buf: &mut sqlx::postgres::PgArgumentBuffer,
    ) -> Result<sqlx::encode::IsNull, Box<dyn std::error::Error + Send + Sync>> {
        <String as sqlx::Encode<sqlx::Postgres>>::encode_by_ref(&self.to_string(), buf)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct DepositSession {
    pub id: Uuid,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub burner_address: String,
    pub eip7702_auth: serde_json::Value,
    pub dest_address: String,
    pub dest_chain_id: i32,
    pub status: SessionStatus,
    pub source_chain_id: Option<i32>,
    pub detected_token: Option<String>,
    pub detected_amount: Option<String>,
    pub detected_tx: Option<String>,
    pub sweep_tx: Option<String>,
    pub swap_output_amount: Option<String>,
    pub fee_amount: Option<String>,
    pub bridge_amount: Option<String>,
    pub bridge_tx: Option<String>,
    pub bridge_nonce: Option<String>,
    pub dest_tx: Option<String>,
    pub retry_count: i32,
    pub next_retry_at: Option<chrono::DateTime<chrono::Utc>>,
    pub claimed_by: Option<String>,
    pub claimed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub error_message: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterSessionRequest {
    pub burner_address: String,
    pub eip7702_auth: serde_json::Value,
    pub destination_address: String,
    pub destination_chain: i32,
}

#[derive(Debug, Serialize)]
pub struct RegisterSessionResponse {
    pub id: Uuid,
    pub status: SessionStatus,
    pub expires_at: i64,
}

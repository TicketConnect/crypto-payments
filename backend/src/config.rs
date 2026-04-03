#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub relayer_private_key: String,
    pub implementation_address: String,
    pub fee_bps: u16,
    pub listen_addr: String,
}

impl Config {
    pub fn from_env() -> eyre::Result<Self> {
        Ok(Self {
            database_url: std::env::var("DATABASE_URL")?,
            relayer_private_key: std::env::var("RELAYER_PRIVATE_KEY")?,
            implementation_address: std::env::var("IMPLEMENTATION_ADDRESS")?,
            fee_bps: std::env::var("FEE_BPS")
                .unwrap_or_else(|_| "50".into())
                .parse()?,
            listen_addr: std::env::var("LISTEN_ADDR")
                .unwrap_or_else(|_| "0.0.0.0:3001".into()),
        })
    }
}

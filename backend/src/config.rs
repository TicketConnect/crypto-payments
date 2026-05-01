use alloy::primitives::Address;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub relayer_private_key: String,
    pub fee_bps: u16,
    pub treasury_address: Option<Address>,
    pub listen_addr: String,
    pub uniswap_api_key: String,
    /// Slippage tolerance for Uniswap swaps (0.0-1.0)
    pub slippage_tolerance: f64,
    /// Maximum price impact percent allowed for swaps
    pub max_price_impact_percent: f64,
    /// Gas limit buffer percentage for transaction estimation (e.g., 20 for 20%)
    pub gas_limit_buffer: u64,
    /// Per-chain RPC URLs for server-initiated transactions (e.g. refund).
    /// Keyed by chain_id, populated from `RPC_URL_<chain_id>` env vars.
    /// Refund must use a server-trusted RPC, never one supplied in the
    /// request body — otherwise an attacker could direct the relayer's
    /// signed tx to a malicious node.
    pub rpc_urls: HashMap<u64, String>,
}

impl Config {
    pub fn from_env() -> eyre::Result<Self> {
        let mut rpc_urls = HashMap::new();
        for (k, v) in std::env::vars() {
            if let Some(rest) = k.strip_prefix("RPC_URL_") {
                if let Ok(chain_id) = rest.parse::<u64>() {
                    if !v.is_empty() {
                        rpc_urls.insert(chain_id, v);
                    }
                }
            }
        }

        Ok(Self {
            database_url: std::env::var("DATABASE_URL")?,
            relayer_private_key: std::env::var("RELAYER_PRIVATE_KEY")?,
            fee_bps: std::env::var("FEE_BPS")
                .unwrap_or_else(|_| "0".into())
                .parse()?,
            treasury_address: std::env::var("TREASURY_ADDRESS")
                .ok()
                .filter(|s| !s.is_empty())
                .map(|s| s.parse::<Address>())
                .transpose()?,
            listen_addr: std::env::var("LISTEN_ADDR").unwrap_or_else(|_| "0.0.0.0:3001".into()),
            uniswap_api_key: std::env::var("UNISWAP_API_KEY")?,
            slippage_tolerance: std::env::var("SLIPPAGE_TOLERANCE")
                .unwrap_or_else(|_| "0.005".into()) // 0.5% default
                .parse()?,
            max_price_impact_percent: std::env::var("MAX_PRICE_IMPACT_PERCENT")
                .unwrap_or_else(|_| "5.0".into()) // 5% default
                .parse()?,
            gas_limit_buffer: std::env::var("GAS_LIMIT_BUFFER")
                .unwrap_or_else(|_| "20".into()) // 20% default
                .parse()?,
            rpc_urls,
        })
    }
}

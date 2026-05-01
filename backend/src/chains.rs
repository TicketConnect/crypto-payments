use alloy::primitives::{address, Address};

#[derive(Debug, Clone)]
pub struct ChainConfig {
    pub chain_id: u64,
    pub name: &'static str,
    pub usdc_address: Address,
    /// Wrapped native token (WETH on most chains, WPOL on Polygon).
    /// The sweeper wraps native gas before swapping; the indexer uses this
    /// as the synthetic `detected_token` for native deposits.
    pub wrapped_native: Address,
}

/// Look up chain config by chain_id. Returns None for unsupported chains.
pub fn get_chain(chain_id: u64) -> Option<&'static ChainConfig> {
    CHAINS.iter().find(|c| c.chain_id == chain_id)
}

static CHAINS: &[ChainConfig] = &[
    ChainConfig {
        chain_id: 1,
        name: "Ethereum",
        usdc_address: address!("A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
        wrapped_native: address!("C02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"), // WETH
    },
    ChainConfig {
        chain_id: 42161,
        name: "Arbitrum",
        usdc_address: address!("af88d065e77c8cC2239327C5EDb3A432268e5831"),
        wrapped_native: address!("82aF49447D8a07e3bd95BD0d56f35241523fBab1"), // WETH
    },
    ChainConfig {
        chain_id: 8453,
        name: "Base",
        usdc_address: address!("833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
        wrapped_native: address!("4200000000000000000000000000000000000006"), // WETH (OP-Stack predeploy)
    },
    ChainConfig {
        chain_id: 10,
        name: "Optimism",
        usdc_address: address!("0b2C639c533813f4Aa9D7837CAf62653d097Ff85"),
        wrapped_native: address!("4200000000000000000000000000000000000006"), // WETH (OP-Stack predeploy)
    },
    ChainConfig {
        chain_id: 137,
        name: "Polygon",
        usdc_address: address!("3c499c542cEF5E3811e1192ce70d8cC03d5c3359"),
        wrapped_native: address!("0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270"), // WPOL (formerly WMATIC)
    },
];

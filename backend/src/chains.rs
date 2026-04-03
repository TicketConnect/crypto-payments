use alloy::primitives::{address, Address};

#[derive(Debug, Clone)]
pub struct ChainConfig {
    pub chain_id: u64,
    pub name: &'static str,
    pub cctp_domain: u32,
    pub usdc_address: Address,
    pub token_messenger: Address,
    pub defillama_slug: &'static str,
}

/// Look up chain config by chain_id. Returns None for unsupported chains.
pub fn get_chain(chain_id: u64) -> Option<&'static ChainConfig> {
    CHAINS.iter().find(|c| c.chain_id == chain_id)
}

/// Map chain_id to CCTP domain. Returns None for unsupported chains.
pub fn chain_id_to_cctp_domain(chain_id: u64) -> Option<u32> {
    get_chain(chain_id).map(|c| c.cctp_domain)
}

// Placeholder addresses — fill with real mainnet addresses before deployment.
// USDC and TokenMessenger addresses vary per chain.
static CHAINS: &[ChainConfig] = &[
    ChainConfig {
        chain_id: 1,
        name: "Ethereum",
        cctp_domain: 0,
        usdc_address: address!("A0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"),
        token_messenger: address!("BD3fa81B58Ba92a82136038B25aDec7066af3155"),
        defillama_slug: "ethereum",
    },
    ChainConfig {
        chain_id: 42161,
        name: "Arbitrum",
        cctp_domain: 3,
        usdc_address: address!("af88d065e77c8cC2239327C5EDb3A432268e5831"),
        token_messenger: address!("19330d10D9Cc8751218eaf51E8885D058642E08A"),
        defillama_slug: "arbitrum",
    },
    ChainConfig {
        chain_id: 8453,
        name: "Base",
        cctp_domain: 6,
        usdc_address: address!("833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"),
        token_messenger: address!("1682Ae6375C4E4A97e4B583BC394c861A46D8962"),
        defillama_slug: "base",
    },
    ChainConfig {
        chain_id: 10,
        name: "Optimism",
        cctp_domain: 2,
        usdc_address: address!("0b2C639c533813f4Aa9D7837CAf62653d097Ff85"),
        token_messenger: address!("2B4069517957735bE00ceE0fadAE88a26365528f"),
        defillama_slug: "optimism",
    },
    ChainConfig {
        chain_id: 137,
        name: "Polygon",
        cctp_domain: 7,
        usdc_address: address!("3c499c542cEF5E3811e1192ce70d8cC03d5c3359"),
        token_messenger: address!("9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE"),
        defillama_slug: "polygon",
    },
    // BSC, Monad, HyperEVM — addresses TBD, add when available
];

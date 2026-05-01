use alloy::eips::eip7702::{Authorization, SignedAuthorization};
use alloy::primitives::{Address, U256};
use eyre::Result;

/// Parse a hex string into a U256, returning zero on failure.
fn parse_hex_u256(s: &str) -> U256 {
    U256::from_str_radix(s.trim_start_matches("0x"), 16).unwrap_or(U256::ZERO)
}

/// Reconstruct an EIP-7702 authorization from a JSON value.
/// Returns an error if any required field is missing or invalid.
pub fn reconstruct_auth(json: &serde_json::Value) -> Result<SignedAuthorization> {
    let addr_str = json["address"]
        .as_str()
        .ok_or_else(|| eyre::eyre!("missing or invalid address field in auth"))?;
    let addr: Address = addr_str
        .parse()
        .map_err(|_| eyre::eyre!("invalid address format in auth"))?;

    let chain_id = json["chainId"]
        .as_u64()
        .ok_or_else(|| eyre::eyre!("missing or invalid chainId field in auth"))?;

    let nonce = json["nonce"]
        .as_u64()
        .ok_or_else(|| eyre::eyre!("missing or invalid nonce field in auth"))?;

    let y = json["yParity"]
        .as_u64()
        .ok_or_else(|| eyre::eyre!("missing or invalid yParity field in auth"))? as u8;

    let r_str = json["r"]
        .as_str()
        .ok_or_else(|| eyre::eyre!("missing or invalid r field in auth"))?;
    let r = parse_hex_u256(r_str);

    let s_str = json["s"]
        .as_str()
        .ok_or_else(|| eyre::eyre!("missing or invalid s field in auth"))?;
    let s = parse_hex_u256(s_str);

    Ok(SignedAuthorization::new_unchecked(
        Authorization {
            chain_id: U256::from(chain_id),
            address: addr,
            nonce,
        },
        y,
        r,
        s,
    ))
}

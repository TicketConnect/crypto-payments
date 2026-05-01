use serde::{Deserialize, Serialize};

const BASE_URL: &str = "https://trade-api.gateway.uniswap.org/v1";

/// A transaction returned by the Uniswap API (approval or swap).
#[derive(Debug, Clone, Deserialize)]
pub struct ApiTx {
    pub to: String,
    pub data: String,
    pub value: String,
}

/// Raw quote response from POST /quote — kept as serde_json::Value so we
/// can spread it directly into the /swap request body without field-mapping.
pub type QuoteResponse = serde_json::Value;

/// Extract price impact percent from a quote response
pub fn get_price_impact_percent(quote: &QuoteResponse) -> Option<f64> {
    quote.get("priceImpact")
        .and_then(|v| v.as_str())
        .and_then(|s| s.trim_end_matches('%').parse().ok())
}

/// Status of a cross-chain swap/bridge as reported by Uniswap's `/swaps`
/// endpoint. Used by the bridge-status poller to transition cross-chain
/// sessions from `bridging` → `swept` (or to a terminal failure).
#[derive(Debug, Clone, PartialEq)]
pub enum SwapStatus {
    Pending,
    Success,
    Failed,
    NotFound,
    Expired,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuoteParams {
    pub swapper: String,
    pub token_in: String,
    pub token_out: String,
    /// Must be a string per Uniswap API requirements
    pub token_in_chain_id: String,
    /// Must be a string per Uniswap API requirements
    pub token_out_chain_id: String,
    pub amount: String,
    #[serde(rename = "type")]
    pub quote_type: String,
    pub slippage_tolerance: f64,
    pub routing_preference: String,
}

#[derive(Debug, Deserialize)]
struct SwapResponse {
    swap: ApiTx,
}

fn build_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .unwrap()
}

fn headers(api_key: &str, cross_chain: bool) -> reqwest::header::HeaderMap {
    let mut map = reqwest::header::HeaderMap::new();
    map.insert("Content-Type", "application/json".parse().unwrap());
    map.insert("x-api-key", api_key.parse().unwrap());
    map.insert("x-universal-router-version", "2.0".parse().unwrap());
    map.insert("x-permit2-disabled", "true".parse().unwrap());
    if cross_chain {
        map.insert("x-chained-actions-enabled", "true".parse().unwrap());
    }
    map
}

/// Get a quote from the Uniswap Trading API.
/// Set cross_chain=true when tokenInChainId != tokenOutChainId.
pub async fn get_quote(
    api_key: &str,
    params: QuoteParams,
    cross_chain: bool,
) -> eyre::Result<QuoteResponse> {
    let resp: QuoteResponse = build_client()
        .post(format!("{BASE_URL}/quote"))
        .headers(headers(api_key, cross_chain))
        .json(&params)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    Ok(resp)
}

/// Get executable swap calldata from a quote.
/// Strips permitData since we use x-permit2-disabled (direct approval flow).
pub async fn get_swap_calldata(
    api_key: &str,
    quote: QuoteResponse,
    cross_chain: bool,
) -> eyre::Result<ApiTx> {
    let body = match quote {
        serde_json::Value::Object(mut map) => {
            map.remove("permitData");
            map.remove("permitTransaction");
            serde_json::Value::Object(map)
        }
        other => other,
    };

    let resp: SwapResponse = build_client()
        .post(format!("{BASE_URL}/swap"))
        .headers(headers(api_key, cross_chain))
        .json(&body)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    if resp.swap.data.is_empty() || resp.swap.data == "0x" {
        return Err(eyre::eyre!("swap.data is empty — quote may have expired"));
    }

    Ok(resp.swap)
}

/// Get a BRIDGE quote for USDC → USDC cross-chain.
/// `slippage_tolerance` and `max_price_impact_percent` come from app config so
/// thresholds stay consistent with same-chain swaps.
pub async fn get_bridge_quote(
    api_key: &str,
    swapper: &str,
    usdc_in: &str,
    usdc_out: &str,
    source_chain_id: u64,
    dest_chain_id: u64,
    amount: &str,
    slippage_tolerance: f64,
    max_price_impact_percent: f64,
) -> eyre::Result<QuoteResponse> {
    let params = QuoteParams {
        swapper: swapper.to_string(),
        token_in: usdc_in.to_string(),
        token_out: usdc_out.to_string(),
        token_in_chain_id: source_chain_id.to_string(),
        token_out_chain_id: dest_chain_id.to_string(),
        amount: amount.to_string(),
        quote_type: "EXACT_INPUT".into(),
        slippage_tolerance,
        routing_preference: "BEST_PRICE".into(),
    };

    let resp = get_quote(api_key, params, true).await?;

    if let Some(price_impact) = get_price_impact_percent(&resp) {
        if price_impact > max_price_impact_percent {
            return Err(eyre::eyre!("price impact too high: {}%", price_impact));
        }
    }

    let routing = resp["routing"].as_str().unwrap_or("");
    if routing != "BRIDGE" {
        return Err(eyre::eyre!("expected BRIDGE routing, got: {routing}"));
    }

    Ok(resp)
}

/// Get executable bridge tx calldata from a bridge quote.
/// Returns (ApiTx for the bridge tx on source chain).
pub async fn get_bridge_calldata(
    api_key: &str,
    quote_response: QuoteResponse,
) -> eyre::Result<ApiTx> {
    get_swap_calldata(api_key, quote_response, true).await
}

/// Poll the status of a swap/bridge tx.
/// GET /swaps?txHashes=0x...&chainId=N
pub async fn check_swap_status(
    api_key: &str,
    tx_hash: &str,
    chain_id: u64,
) -> eyre::Result<SwapStatus> {
    #[derive(Deserialize)]
    struct SwapEntry {
        status: String,
    }
    #[derive(Deserialize)]
    struct SwapsResponse {
        swaps: Vec<SwapEntry>,
    }

    let resp: SwapsResponse = build_client()
        .get(format!(
            "{BASE_URL}/swaps?txHashes={tx_hash}&chainId={chain_id}"
        ))
        .headers(headers(api_key, false))
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let status = resp
        .swaps
        .first()
        .map(|s| match s.status.as_str() {
            "PENDING" => SwapStatus::Pending,
            "SUCCESS" => SwapStatus::Success,
            "FAILED" => SwapStatus::Failed,
            "EXPIRED" => SwapStatus::Expired,
            _ => SwapStatus::NotFound,
        })
        .unwrap_or(SwapStatus::NotFound);

    Ok(status)
}

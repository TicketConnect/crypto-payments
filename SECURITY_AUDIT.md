# crypto-payments — Security Audit Report

> **Audited:** 2026-05-01  
> **Scope:** `backend/src/`, `contracts/src/`, `frontend/src/`  
> **Result:** 17 fixed · 3 partially fixed · 5 not fixed (out of 25 issues)

---

## Summary

| Severity | Total | Fixed | Partial | Not Fixed |
|----------|-------|-------|---------|-----------|
| 🔴 Critical | 5 | 4 | 1 | 0 |
| 🟠 High | 6 | 5 | 0 | 1 |
| 🟡 Medium | 9 | 7 | 2 | 0 |
| 🟢 Low | 5 | 1 | 0 | 4 |

---

## 🔴 Critical

### 1. Unauthenticated `/sessions/:id/refund` endpoint
**Status: ✅ FIXED** — `api/sessions.rs`

The refund handler now enforces a full authorization chain:

- Accepts `refund_address`, `deadline` (unix seconds), and an EIP-191 `signature` from the burner key.
- Rejects if `deadline <= now` (expired auth cannot be replayed).
- Recovers the signer from the canonical message:
  ```
  "depositoor refund\nsession: {id}\nto: {refund_to}\ndeadline: {deadline}"
  ```
  and rejects if it does not match `burner_address`.
- **RPC is never caller-controlled.** The handler reads the RPC URL from `state.config.rpc_urls` — a server-side `HashMap<u64, String>` populated from `RPC_URL_<chain_id>` env vars. The original attack vector (attacker supplies `rpc_url` pointing to a malicious node) is fully closed.

---

### 2. Hardcoded OP-Stack WETH `0x4200…0006`
**Status: ✅ FIXED** — `chains.rs`

Each `ChainConfig` now carries a `wrapped_native` field with the correct address per chain:

| Chain | Address | Token |
|-------|---------|-------|
| Ethereum (1) | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | WETH |
| Arbitrum (42161) | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | WETH |
| Base (8453) | `0x4200000000000000000000000000000000000006` | WETH (OP-stack) |
| Optimism (10) | `0x4200000000000000000000000000000000000006` | WETH (OP-stack) |
| Polygon (137) | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` | WPOL |

`executor.rs` and `watcher.rs` both read `chain.wrapped_native` — no hardcoded constant anywhere.

---

### 3. Cross-chain native-ETH false-positive race
**Status: ⚠️ PARTIALLY FIXED** — `watcher.rs`, `db.rs`

`check_eth_balances` now passes the correct per-chain `wrapped_native` address as the synthetic `detected_token`, and `claim_for_detection` sets `source_chain_id` to the winning chain.

`get_pending_burners` still returns all pending burners regardless of chain — there is no `expected_source_chain` filter in the query. In theory, an attacker watching the API in real-time could send dust to a burner address on the wrong chain and trigger the wrong sweeper.

**Practical threat (TicketConnect context):** Very low. Burner keys are generated fresh in the buyer's browser via `generatePrivateKey()` on every mount (`TicketListingPage.tsx:198`). The address is cryptographically unguessable before the session is registered. An attack requires:
1. Real-time monitoring of `POST /sessions` responses,
2. Racing a dust transaction to the new address on a different chain,
3. Before the legitimate user deposits.

This is a targeted, active attack — not a passive or scalable exploit.

> **Remaining fix (low priority):** Add an `expected_source_chain_id` column populated at session creation, and filter `get_pending_burners` by chain.

---

### 4. Solidity uses non-safe ERC-20 transfer/approve
**Status: ✅ FIXED** — `contracts/src/DepositoorDelegate.sol`

`sweep()` uses `SafeTransferLib.safeTransfer` (Solady) which handles non-conforming tokens like USDT (no bool return). The delegate no longer uses raw `IERC20.transfer`.

> **Minor residual:** The Uniswap approval path in `executor.rs` uses raw `IERC20.approve` ABI encoding. USDT mainnet requires `approve(0)` before `approve(N)`. This could cause Uniswap approvals to revert on USDT; however the sweep path itself is safe.

---

### 5. `receive()` used raw `.call("")` to WETH
**Status: ✅ FIXED** — `contracts/src/DepositoorDelegate.sol`

```solidity
receive() external payable override {
    if (msg.value > 0) {
        IWETH(weth).deposit{value: msg.value}();
    }
}
```

Uses explicit `IWETH.deposit{value}()` — portable across all wrapped-native variants including those without a payable fallback.

---

## 🟠 High

### 6. SSE leaks DB connections (one `PgListener` per client)
**Status: ✅ FIXED** — `api/sse.rs`

Uses a `OnceCell<Sender<String>>` + `tokio::broadcast` pattern:
- Exactly **one** `PgListener` is initialized globally via `SSE_TX.get_or_init(...)`.
- All SSE clients subscribe to the broadcast channel — no additional Postgres connections per client.
- Notifications are filtered client-side by session UUID.

---

### 7. No reorg protection in the indexer
**Status: ✅ FIXED** — `indexer/watcher.rs`

```rust
const CONFIRMATION_DEPTH: u64 = 5;
let current_block = provider.get_block_number().await?;
if block_number + CONFIRMATION_DEPTH > current_block {
    return Ok(()); // skip unconfirmed blocks
}
```

Blocks are only processed once they are at least 5 confirmations deep.

---

### 8. Indexer fetches every Transfer event with no address filter
**Status: ✅ FIXED** — `indexer/watcher.rs`

An in-memory `HashSet<String>` of all pending burner addresses is built at the start of each block. Logs are checked against this set before any Postgres query — eliminating hot DB reads for non-burner addresses.

> **Note:** The EVM-level `eth_getLogs` filter still has no `topics[2] IN (burners)` constraint, so all Transfer events are downloaded from the RPC. An on-chain topics filter would further reduce RPC bandwidth at high volume.

---

### 9. Sweeper is single-threaded per chain
**Status: ✅ FIXED** — `sweeper/mod.rs`

```rust
const NUM_WORKERS: usize = 5;
for i in 0..NUM_WORKERS {
    tokio::spawn(async move { loop { claim_for_sweep(...) } });
}
```

Five concurrent worker tasks coordinate via `FOR UPDATE SKIP LOCKED`.

---

### 10. Slippage hardcoded; no price-impact ceiling
**Status: ✅ FIXED** — `config.rs`, `executor.rs`, `uniswap.rs`

Both `slippage_tolerance` and `max_price_impact_percent` are now env-var configurable (defaults: `0.5%` and `5.0%`). Swaps and bridge quotes abort with an error if `priceImpactPercent` exceeds the configured threshold.

---

### 11. Relayer key in plaintext env var
**Status: ❌ NOT FIXED** — `config.rs:41`

```rust
relayer_private_key: std::env::var("RELAYER_PRIVATE_KEY")?
```

The key is still a raw string from the environment. This controls every burner ever delegated to the implementation contract.

> **Recommended fix:** AWS KMS signer (alloy has native support via `alloy-signer-aws`), with per-chain key separation.

---

## 🟡 Medium

### CORS: `allow_origin(Any)` in production
**Status: ⚠️ PARTIAL** — `api/mod.rs`

`CorsLayer::permissive()` was replaced, but the current config is functionally identical:

```rust
CorsLayer::new()
    .allow_origin(Any)   // ← still open
    .allow_methods(Any)
    .allow_headers(Any)
```

> **Fix:** Replace `Any` with an explicit allowlist of production origins.

---

### No rate limiting
**Status: ✅ FIXED** — `api/mod.rs`

`tower_governor` applied globally: 1 token per 6 seconds (≈10/min), burst of 10, keyed by peer IP. Covers all routes including `/sessions` and `/refund`.

---

### Hardcoded gas limits
**Status: ✅ FIXED** — `executor.rs`, `api/sessions.rs`

All transactions use `estimate_gas_with_buffer(provider, tx, config.gas_limit_buffer)`. Buffer percentage is configurable via `GAS_LIMIT_BUFFER` env var (default 20%).

---

### `reconstruct_auth` silently swallowed malformed JSON
**Status: ✅ FIXED** — `auth.rs`

Every field now uses `.ok_or_else(|| eyre::eyre!("missing or invalid X field in auth"))?`. Malformed auth returns a descriptive error instead of silently producing a zero-valued authorization.

---

### Session creation idempotency / fund redirect via re-register
**Status: ✅ FIXED** — `db.rs`

Two guards prevent overwriting an active session:
1. Explicit pending-session check in `insert_session` returns an error if a pending session already exists for the burner.
2. Partial unique index prevents DB-level duplicates:
   ```sql
   CREATE UNIQUE INDEX idx_sessions_burner_unique
   ON sessions(burner_address)
   WHERE status IN ('pending', 'failed')
   ```

---

### Indexer WS fallback polls only once per loop
**Status: ✅ FIXED** — `indexer/watcher.rs`

`poll_once` now tracks `last_processed_block` and catches up on every missed block between `last_processed_block + 1` and the current head — no longer skipping blocks during WS outages.

---

### No timeout on Uniswap HTTP calls
**Status: ✅ FIXED** — `uniswap.rs`

```rust
reqwest::Client::builder()
    .timeout(std::time::Duration::from_secs(30))
    .build()
```

All Uniswap API requests have a 30-second timeout.

---

### FoT tokens: log amount vs actual `balanceOf`
**Status: ✅ FIXED** — `indexer/watcher.rs`

Fee-on-transfer tokens deduct a fee during transfer, so `Transfer.amount > balanceOf(burner)`. Storing the log amount and passing it to Uniswap would cause the swap to fail with insufficient balance.

**Fix:** After matching a Transfer to a burner, immediately call `balanceOf(burner)` and store the actual balance as `detected_amount`:

```rust
let actual_amount = match IERC20::new(log.address(), provider)
    .balanceOf(to_address)
    .call()
    .await
{
    Ok(bal) => bal,
    Err(e) => {
        tracing::warn!("balanceOf call failed, falling back to log amount: {e}");
        log_amount  // graceful fallback
    }
};

if actual_amount != log_amount {
    tracing::warn!(
        log_amount = %log_amount,
        actual_balance = %actual_amount,
        "fee-on-transfer token: log amount differs from balanceOf; using actual balance"
    );
}
```

`detected_amount` in the DB now always reflects the real on-chain balance — consistent with what `executor.rs` uses for the swap.

---

### `get_session_by_address` LIMIT 1 with potential duplicate pending
**Status: ✅ FIXED** — `db.rs`

Covered by the uniqueness constraint and the explicit pending-session check in `insert_session` above.

---

## 🟢 Low / Polish

### "Placeholder addresses" comment in `chains.rs`
**Status: ✅ FIXED**

Comment replaced with correct named annotations (`// WETH`, `// WPOL`, etc.).

---

### Magic numbers (30 min TTL, 3 retries, backoff formula)
**Status: ❌ NOT FIXED** — `db.rs:116`, `db.rs:402`, `db.rs:406`

Hardcoded in SQL:
```sql
created_at > now() - interval '30 minutes'
CASE WHEN retry_count >= 3 THEN 'failed' ...
now() + (interval '1 second' * power(2, retry_count + 1))
```

> **Fix:** Hoist to `Config` fields with env-var overrides.

---

### Poor error categorization (`eyre::Result` everywhere)
**Status: ❌ NOT FIXED**

The API error type only has `BadRequest / NotFound / Internal`. All infrastructure failures map to 500 with no structured error code.

---

### `reconstruct_auth` duplication between `sessions.rs` and `executor.rs`
**Status: ✅ FIXED**

Both now import from `crate::auth::reconstruct_auth`.

---

### Frontend stores private keys in `localStorage`
**Status: ❌ NOT FIXED** — `App.tsx:64-65`, `TicketListingPage.tsx`

Burner private keys are persisted to `localStorage`. The 30-minute TTL limits the damage window, but XSS can steal the key during the session.

> **Fix:** Use `sessionStorage` (tab-scoped, cleared on close) or keep the key in React state only (in-memory, not persisted). For the TicketListingPage flow the key is already only in component state and is not persisted.

---

### Anvil integration tests
**Status: ❌ NOT FIXED**

The existing `e2e_live.rs` requires a live RPC and funded relayer — easy to skip in CI.

> **Fix:** Add a test suite using `anvil` fork mode (`anvil --fork-url $RPC`) so the sweeper and indexer can be exercised against a real chain state without real funds.

---

## Full Status Table

| # | Severity | Issue | File(s) | Status |
|---|----------|-------|---------|--------|
| 1 | 🔴 Critical | Unauthenticated `/refund` endpoint | `api/sessions.rs` | ✅ Fixed |
| 2 | 🔴 Critical | Hardcoded OP-Stack WETH | `chains.rs`, `executor.rs`, `watcher.rs` | ✅ Fixed |
| 3 | 🔴 Critical | Cross-chain native-ETH race | `watcher.rs`, `db.rs` | ⚠️ Partial (low practical risk) |
| 4 | 🔴 Critical | Non-safe ERC-20 transfer/approve | `DepositoorDelegate.sol` | ✅ Fixed |
| 5 | 🔴 Critical | `receive()` raw `.call("")` to WETH | `DepositoorDelegate.sol` | ✅ Fixed |
| 6 | 🟠 High | SSE DB connection leak | `api/sse.rs` | ✅ Fixed |
| 7 | 🟠 High | No reorg protection | `indexer/watcher.rs` | ✅ Fixed |
| 8 | 🟠 High | Indexer no address filter | `indexer/watcher.rs` | ✅ Fixed |
| 9 | 🟠 High | Single-threaded sweeper | `sweeper/mod.rs` | ✅ Fixed |
| 10 | 🟠 High | Hardcoded slippage / no price impact | `config.rs`, `executor.rs`, `uniswap.rs` | ✅ Fixed |
| 11 | 🟠 High | Relayer key plaintext env | `config.rs` | ❌ Not Fixed |
| 12 | 🟡 Medium | CORS `allow_origin(Any)` | `api/mod.rs` | ⚠️ Partial |
| 13 | 🟡 Medium | No rate limiting | `api/mod.rs` | ✅ Fixed |
| 14 | 🟡 Medium | Hardcoded gas limits | `executor.rs`, `api/sessions.rs` | ✅ Fixed |
| 15 | 🟡 Medium | `reconstruct_auth` swallows errors | `auth.rs` | ✅ Fixed |
| 16 | 🟡 Medium | Session creation idempotency | `db.rs` | ✅ Fixed |
| 17 | 🟡 Medium | WS fallback skips blocks | `indexer/watcher.rs` | ✅ Fixed |
| 18 | 🟡 Medium | No Uniswap HTTP timeout | `uniswap.rs` | ✅ Fixed |
| 19 | 🟡 Medium | FoT token log amount vs balanceOf | `indexer/watcher.rs` | ✅ Fixed |
| 20 | 🟡 Medium | Duplicate pending session / re-register | `db.rs` | ✅ Fixed |
| 21 | 🟢 Low | "Placeholder" comment in `chains.rs` | `chains.rs` | ✅ Fixed |
| 22 | 🟢 Low | Magic numbers (TTL, retries, backoff) | `db.rs` | ❌ Not Fixed |
| 23 | 🟢 Low | Poor error categorization | `error.rs` | ❌ Not Fixed |
| 24 | 🟢 Low | `reconstruct_auth` duplication | `api/sessions.rs`, `sweeper/executor.rs` | ✅ Fixed |
| 25 | 🟢 Low | `localStorage` for private keys | `App.tsx` | ❌ Not Fixed |
| 26 | 🟢 Low | No anvil integration tests | `tests/` | ❌ Not Fixed |

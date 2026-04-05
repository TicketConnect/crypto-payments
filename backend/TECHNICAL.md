# Backend Technical Documentation

## Process model

The backend is a single Rust binary with three subcommands:

```
depositoor api          # HTTP API server (one instance)
depositoor indexer      # Chain head follower (one per chain)
depositoor sweeper      # Sweep executor (one per chain)
```

All processes share a PostgreSQL database for coordination. Multiple indexer/sweeper instances can run safely — they use PostgreSQL advisory locks for mutual exclusion.

## API server (`src/api/`)

Axum web server on port 3001 (configurable via `LISTEN_ADDR`).

### Endpoints

```
POST   /sessions              Register a deposit session
GET    /sessions/:id           Get session by ID
GET    /sessions/:id/events    SSE stream for real-time status
POST   /sessions/:id/refund    Refund tokens from failed session
```

### Session registration

Accepts burner address, EIP-7702 authorization, destination address, and destination chain. Validates the destination chain is supported and maps it to a CCTP domain. Returns session ID, status, and expiry timestamp.

### SSE

Uses PostgreSQL `LISTEN/NOTIFY` on the `session_updates` channel. When any process updates a session, it calls `pg_notify('session_updates', session_id)`. The SSE handler listens on this channel and pushes the full session JSON to the connected client.

Initial connection sends the current session state immediately, then streams updates.

### Refund

Takes a refund address and RPC URL. Reconstructs the EIP-7702 authorization from the session, builds an ERC-7821 batch with `sweep(token, refund_address)`, and submits via the relayer. Used when a swap fails (unsupported token, no liquidity).

## Indexer (`src/indexer/`)

One indexer runs per chain. Follows the chain head and detects deposits.

### Chain head tracking

`watcher.rs` uses a hybrid WebSocket + HTTP approach:

1. Subscribe to `newHeads` via WebSocket for block notifications
2. For each new block, fetch Transfer logs via HTTP `eth_getLogs`
3. If WS disconnects, fall back to HTTP polling until reconnected

This is more reliable than pure WS log subscriptions, which silently drop under load.

### ERC-20 detection

For each block:
1. Fetch all `Transfer(address,address,uint256)` logs
2. Extract `to` address from `topic[2]`
3. Query DB: `SELECT * FROM sessions WHERE LOWER(burner_address) = LOWER($1) AND status IN ('pending', 'failed')`
4. If match found, call `claim_for_detection` (advisory lock + atomic status update)

### Native ETH detection

After processing Transfer logs, the indexer polls `eth_getBalance` for all pending burner addresses (sessions created within the last 30 minutes). Non-zero ETH balances are claimed with `detected_token = WETH`.

### Claim atomics

`claim_for_detection` uses `pg_advisory_xact_lock` to prevent double-claiming across multiple indexer instances. It atomically sets:
- `status = 'detected'`
- `source_chain_id`, `detected_token`, `detected_amount`, `detected_tx`
- Resets `retry_count` and `error_message` (handles re-deposits to failed sessions)

## Sweeper (`src/sweeper/`)

One sweeper runs per chain. Polls for detected sessions and executes sweeps.

### Session claiming

`claim_for_sweep` finds the oldest `detected` session on its chain, acquires an advisory lock, and sets `status = 'sweeping'`. Uses `FOR UPDATE SKIP LOCKED` for contention-free multi-instance operation.

### Executor (`executor.rs`)

The executor reads the actual token balance on-chain (not the event amount — handles multiple deposits to the same burner). Then branches:

| Detected token | Destination | Execution |
|---|---|---|
| USDC | same chain | `sweep(USDC, dest)` |
| non-USDC | same chain | `approve + Uniswap swap` (swapper=dest trick) |
| USDC | cross-chain | `approve + Uniswap BRIDGE` |
| non-USDC | cross-chain | TX1: `approve + swap`, TX2: `approve + bridge` |
| native ETH | any | prepend `WETH.deposit{value}()`, then as above |

All calls are batched into ERC-7821 `execute(mode, executionData)` and submitted as EIP-7702 type 4 transactions.

### EIP-7702 batch construction

```rust
fn encode_execute(calls: Vec<(Address, U256, Bytes)>) -> Bytes
```

Encodes a list of `(target, value, calldata)` tuples as an ERC-7821 batch with mode `0x01` (revert all on failure). The EIP-7702 authorization list is attached to set the delegation on the burner EOA.

### Uniswap integration

`uniswap.rs` wraps the Uniswap Trading API:

- `get_quote(params)` — POST `/quote` with token pair, amount, and `routingPreference: BEST_PRICE`
- `get_swap_calldata(quote)` — POST `/swap` with the quote spread into the body, `permitData` stripped
- `get_bridge_quote(params)` — same as quote but with `x-chained-actions-enabled: true` and cross-chain token pair
- `get_bridge_calldata(quote)` — same as swap calldata

All requests include `x-permit2-disabled: true` for the proxy approval flow. The proxy contract (`0x02E5be68...`) pulls tokens via `transferFrom(msg.sender)`, so the burner just needs a standard ERC-20 approve in the batch.

### Swapper trick

For same-chain swaps, we set `swapper = dest` in the Uniswap quote. The proxy pulls tokens from `msg.sender` (burner) but the swap output is encoded to go to `swapper` (dest). This delivers tokens directly to the destination in a single transaction.

### Receipt validation

Every transaction receipt is checked for `status == 1`. Reverted transactions are caught immediately instead of proceeding with stale state.

### Cross-chain balance polling

For the cross-chain non-USDC flow, TX1 (swap) and TX2 (bridge) are separate transactions. Between them, the executor polls `balanceOf(burner)` up to 10 times (1 second apart) to get the post-swap USDC amount, handling RPC lag.

## Database (`src/db.rs`)

PostgreSQL with auto-migration on first startup. Single `sessions` table.

### Schema

```sql
sessions (
    id                UUID PRIMARY KEY,
    created_at        TIMESTAMPTZ,
    updated_at        TIMESTAMPTZ,
    burner_address    TEXT,
    eip7702_auth      JSONB,
    dest_address      TEXT,
    dest_chain_id     INTEGER,
    dest_cctp_domain  INTEGER,
    status            TEXT,           -- pending|detected|sweeping|swept|failed
    source_chain_id   INTEGER,
    detected_token    TEXT,
    detected_amount   TEXT,
    detected_tx       TEXT,
    sweep_tx          TEXT,
    bridge_tx         TEXT,
    swap_output_amount TEXT,
    fee_amount        TEXT,
    bridge_amount     TEXT,
    retry_count       INTEGER,
    next_retry_at     TIMESTAMPTZ,
    claimed_by        TEXT,
    claimed_at        TIMESTAMPTZ,
    error_message     TEXT
)
```

### Indexes

- `(burner_address, status)` — indexer address lookup
- `(status)` — sweeper session polling
- `(status, next_retry_at) WHERE status = 'detected'` — retry scheduling

### Retry logic

Failed sweeps increment `retry_count` and set `next_retry_at` with exponential backoff (`2^(retry_count+1)` seconds). After 4 retries, status moves to `failed`. Failed sessions can be re-activated by a new deposit.

## Configuration (`src/config.rs`)

Environment variables (loaded from `.env` via dotenvy):

```
DATABASE_URL           Postgres connection string
RELAYER_PRIVATE_KEY    Hot wallet for gas (must be funded on all chains)
IMPLEMENTATION_ADDRESS DepositoorDelegate contract address
FEE_BPS                Fee in basis points (default: 50)
LISTEN_ADDR            API bind address (default: 0.0.0.0:3001)
UNISWAP_API_KEY        Uniswap Trading API key
```

## Chain configuration (`src/chains.rs`)

Static chain registry with:
- Chain ID, name
- CCTP domain
- USDC address
- Token Messenger address (CCTP, currently unused — bridging via Uniswap)

Supported: Ethereum (1), Arbitrum (42161), Base (8453), Optimism (10), Polygon (137).

## Error handling (`src/error.rs`)

`AppError` enum maps to HTTP status codes:
- `NotFound` → 404
- `BadRequest` → 400
- `Internal` → 500

`sqlx::Error` and `eyre::Report` auto-convert to `Internal`.

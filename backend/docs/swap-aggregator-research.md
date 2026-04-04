# DEX Aggregator Research for Depositoor Backend

Research based on full source code analysis of LlamaSwap/interface
(https://github.com/LlamaSwap/interface) — the open source meta-aggregator
at swap.defillama.com.

## Key Finding

LlamaSwap has NO backend. It is a frontend-only meta-aggregator that calls
individual DEX aggregator APIs directly from the browser. The endpoint
`https://swap.defillama.com/{chain}?...` used in the original swap.rs does
not exist — it was hallucinated.

## Aggregator Selection for Backend Use

For our use case (server-side swap from a burner EOA via EIP-7702), we need
aggregators that:
1. Return a ready-to-send transaction (`{ to, data, value }`)
2. Don't require browser wallets or EIP-712 signatures
3. Ideally don't require API keys
4. Support our chains: Ethereum, Arbitrum, Base, Optimism, Polygon

### Viable Options (returns on-chain tx, no API key needed)

#### Odos (PRIMARY — selected)
- 2-step: quote → assemble
- No API key required
- Returns `{ transaction: { to, data, value } }`
- Supports all our chains
- Router addresses are per-chain (returned in response)

#### ParaSwap (FALLBACK)
- 2-step: price → build transaction
- No API key required
- Returns `{ to, data, value }`
- Supports all our chains

#### KyberSwap (BACKUP)
- 2-step: get route → build route
- No API key required
- Returns `{ routerAddress, data }`
- Supports all our chains

### Not viable for backend

- 0x v1/v2: requires API key (0x-api-key header)
- 1inch: requires API key (Bearer token)
- CowSwap: off-chain order signing, no direct on-chain tx
- 0x Gasless: relay-based, requires EIP-712 signatures

---

## Odos API (Primary Integration)

### Step 1: Quote

```
POST https://api.odos.xyz/sor/quote/v2
Content-Type: application/json

{
  "chainId": 42161,
  "inputTokens": [
    { "tokenAddress": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", "amount": "1000000" }
  ],
  "outputTokens": [
    { "tokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "proportion": 1 }
  ],
  "userAddr": "0x1234...",
  "slippageLimitPercent": 0.5,
  "referralCode": 0,
  "disableRFQs": true,
  "compact": true
}
```

Response (relevant fields):
```json
{
  "pathId": "abc123...",
  "inAmounts": ["1000000"],
  "outAmounts": ["999500"],
  "gasEstimate": 150000,
  "outValues": [0.9995]
}
```

### Step 2: Assemble

```
POST https://api.odos.xyz/sor/assemble
Content-Type: application/json

{
  "userAddr": "0x1234...",
  "pathId": "abc123..."
}
```

Response (relevant fields):
```json
{
  "transaction": {
    "to": "0xa669e7a0d4b3e4fa48af2de86bd4cd7126be4e13",
    "data": "0x83bd37f9...",
    "value": "0",
    "gas": 350000,
    "gasPrice": 100000000
  },
  "inputTokens": [...],
  "outputTokens": [{ "tokenAddress": "...", "amount": "999500" }]
}
```

### Odos Router Addresses (per chain)

| Chain    | chain_id | Router Address                               |
|----------|----------|----------------------------------------------|
| Ethereum | 1        | 0xcf5540fffcdc3d510b18bfca6d2b9987b0772559   |
| Arbitrum | 42161    | 0xa669e7a0d4b3e4fa48af2de86bd4cd7126be4e13   |
| Optimism | 10       | 0xca423977156bb05b13a2ba3b76bc5419e2fe9680   |
| Base     | 8453     | 0x19ceead7105607cd444f5ad10dd51356436095a1   |
| Polygon  | 137      | 0x4e3288c9ca110bcc82bf38f09a7b425c095d92bf   |

### Native Token Handling

Odos accepts `0x0000000000000000000000000000000000000000` for native tokens
(unlike some aggregators that use the 0xEeee... sentinel). However, in our
use case we're only swapping ERC-20 deposits to USDC, so native token
handling is not needed in the initial implementation.

---

## ParaSwap API (Fallback Integration)

### Step 1: Price Quote

```
GET https://apiv5.paraswap.io/prices/?srcToken=0x...&destToken=0x...&amount=1000000&srcDecimals=6&destDecimals=6&side=SELL&network=42161&version=6.2
```

Response: contains `priceRoute` object with routing info.

### Step 2: Build Transaction

```
POST https://apiv5.paraswap.io/transactions/42161?ignoreChecks=true
Content-Type: application/json

{
  "srcToken": "0x...",
  "srcDecimals": 6,
  "destToken": "0x...",
  "destDecimals": 6,
  "slippage": 50,
  "userAddress": "0x...",
  "priceRoute": { ... },
  "srcAmount": "1000000"
}
```

Response:
```json
{
  "from": "0x...",
  "to": "0x216b4b4ba9f3e719726886d34a177484278bfcae",
  "data": "0x...",
  "value": "0",
  "gasPrice": "...",
  "gas": "..."
}
```

### ParaSwap Approval Address

`0x216b4b4ba9f3e719726886d34a177484278bfcae` (Augustus V6.2, same for all
chains). This is the `tokenTransferProxy` — the address that needs ERC20
approval.

---

## KyberSwap API (Backup)

### Step 1: Get Route

```
GET https://aggregator-api.kyberswap.com/arbitrum/api/v1/routes?tokenIn=0x...&tokenOut=0x...&amountIn=1000000&gasInclude=true
Headers: { "x-client-id": "depositoor" }
```

### Step 2: Build Route

```
POST https://aggregator-api.kyberswap.com/arbitrum/api/v1/route/build
Headers: { "x-client-id": "depositoor" }
Content-Type: application/json

{
  "routeSummary": { ... },
  "sender": "0x...",
  "recipient": "0x...",
  "slippageTolerance": 50,
  "source": "depositoor"
}
```

### KyberSwap Chain Slugs

ethereum, arbitrum, optimism, base, polygon, bsc, avalanche, fantom, linea,
scroll, sonic, unichain, hyperevm, monad

### KyberSwap Router

`0x6131b5fae19ea4f9d964eac0408e4408b66337b5` (universal, all chains except
zkSync)

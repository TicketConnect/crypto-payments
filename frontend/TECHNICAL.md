# Frontend Technical Documentation

## Entry point

`main.tsx` renders `LandingPage` wrapped in `WalletProvider`. The landing page embeds the `App` component (the deposit widget) alongside the marketing copy.

```
main.tsx → WalletProvider → LandingPage → App (deposit widget)
```

## Application state machine

`App.tsx` manages the deposit flow as a view-based state machine:

```
methods → crypto     → (QR code, user sends tokens)
        → wallet-connect → wallet-tokens → wallet-deposit → wallet-confirm → wallet-status
        → peer       → peer-install (if ZKP2P not available)
```

Each view is a component rendered inside a shared card shell (`.main-card`). Navigation is controlled by `setView()` — no router, no URL changes.

## Burner wallet lifecycle

On deposit initiation, `App` generates a fresh burner:

```typescript
const privateKey = generatePrivateKey()
const account = privateKeyToAccount(privateKey)
const signedAuth = await account.signAuthorization({
  contractAddress: IMPL_ADDRESS,
  chainId: 0,       // chainId 0 = valid on any chain
  nonce: 0,
})
```

The burner keypair + EIP-7702 auth are stored in `localStorage` under `depositoor_wallets`. This persists across page reloads so the user can return to check status.

**Critical constraint:** Never send a transaction FROM the burner EOA. This increments its nonce and invalidates the EIP-7702 authorization. The burner is a receive-only address.

## Session management

`hooks/useSession.ts` handles the backend session lifecycle:

1. **Register** — POST to `/sessions` with burner address, EIP-7702 auth, destination address, destination chain.
2. **SSE** — Opens an `EventSource` to `/sessions/{id}/events` for real-time status updates.
3. **Expiry** — Sessions TTL is 30 minutes. The hook auto-renews by re-registering when `expires_at` is reached.
4. **Terminal states** — SSE connection closes on `swept` or `failed`.

Status flow:
```
idle → registering → pending → detected → sweeping → swept
                                                       ↓
                                                    failed
```

## Wallet discovery

### EIP-6963 (injected wallets)

`lib/wallets.ts` discovers browser-injected wallets using the EIP-6963 provider announcement protocol:

```typescript
window.addEventListener('eip6963:announceProvider', handler)
window.dispatchEvent(new Event('eip6963:requestProvider'))
```

Each announced provider is wrapped into a `WalletProviderDetail` with a standardized interface.

### Smart wallets

`lib/smart-wallets.ts` creates provider adapters for:

- **Porto** — Ithaca's EIP-7702 smart wallet. Initialized with `Porto.create()`, supports Ethereum + L2s.
- **Coinbase Smart Wallet** — Created via `createCoinbaseWalletSDK()` with `smartWalletOnly` preference.
- **WalletConnect** — QR code bridge for mobile wallets. Uses `EthereumProvider.init()` with project ID. The `.connect()` call is deferred to the first `eth_requestAccounts` to show the QR modal on demand.

All three are normalized to the same `EIP1193Provider` interface via `toEIP1193()` wrapper.

### Solana wallets

`lib/solana-wallets.ts` uses the Wallet Standard (`@wallet-standard/app`) to discover Solana wallets. These are exposed alongside EVM wallets with `ecosystem: 'solana'`.

## Wallet context

`components/WalletProvider.tsx` is a React context that:

- Runs EIP-6963 discovery on mount
- Registers Porto + Coinbase Smart Wallet adapters
- Lazily initializes WalletConnect on first use
- Discovers Solana wallets via Wallet Standard
- Deduplicates multi-ecosystem wallets (e.g., Phantom appears once with `ecosystems: ['evm', 'solana']`)
- Exposes `wallets`, `connect()`, `disconnect()`, and connection state

## Token balance fetching

`lib/dune.ts` queries Dune's SIM API for connected wallet balances across all supported chains:

```
GET https://api.sim.dune.com/v1/evm/balances/{address}?chain_ids=1,42161,8453,10,137
```

Returns balances sorted by USD value. Used in the "Pay from Wallet" flow to show the user which tokens they have available.

## Component map

### Deposit methods

| Component | Purpose |
|-----------|---------|
| `DepositMethods` | Method picker: Send Crypto, Pay from Wallet, Pay by Cash |
| `QRContent` | QR code with burner address + chain icons |
| `DepositStatus` | Status tracker (detected → sweeping → swept) |

### Wallet connect flow

| Component | Purpose |
|-----------|---------|
| `ConnectWallet` | Wallet picker grid (injected + smart + WC) |
| `TokenList` | Balance list from Dune SIM for connected wallet |
| `DepositForm` | Amount input + chain selection |
| `DepositConfirm` | Transaction preview before signing |

### Peer-to-peer flow

| Component | Purpose |
|-----------|---------|
| `PeerInProgress` | ZKP2P onramp progress tracker |
| `PeerInstall` | Fallback when ZKP2P SDK not available |
| `PeerOnrampButton` | P2P method selection (Venmo, Revolut, etc.) |

### Shared

| Component | Purpose |
|-----------|---------|
| `WalletDropdown` | Active wallet display + disconnect |
| `WalletLogo` | Wallet icon renderer with auto background detection |
| `ChainLogo` | Chain icon with colored background |
| `PeerMethodLogo` | Payment method icon renderer |
| `DestinationPanel` | Bottom panel showing destination address + chain |
| `SupportedAssets` | Token/chain compatibility table |

## Landing page

`LandingPage.tsx` is a single-page marketing wrapper. Sections:

1. **Header** — Sticky nav with logo + GitHub link
2. **Hero** — Headline + SDK code block + embedded `App` widget
3. **Chain logos** — Supported chain icons row
4. **Pipeline** — Monospace flow diagram
5. **How it works** — Three-step explanation
6. **Footer** — Built with EIP-7702 + ETHGlobal 2026

The widget is rendered live inside the hero — it's the actual `App` component, not a screenshot.

## Configuration

`lib/constants.ts` defines:

```typescript
IMPL_ADDRESS        // DepositoorDelegate contract (same on all chains)
API_URL             // Backend endpoint (VITE_API_URL env var)
SUPPORTED_CHAINS    // Chain configs with IDs, colors, logos, USDC addresses
PEER_METHODS        // P2P payment methods (Venmo, Revolut, etc.)
SUPPORTED_TOKENS    // Token configs with per-chain addresses
```

`IMPL_ADDRESS` is `0x33333393A5EdE0c5E257b836034b8ab48078f53c` on all chains. `API_URL` defaults to `http://localhost:3001` and is overridden via `VITE_API_URL` at build time.

## Build

```bash
npm install
npm run dev          # Vite dev server
npm run build        # Production build → dist/
```

Dependencies: React 19, Viem, Wagmi, Porto, Coinbase Wallet SDK, WalletConnect, ZKP2P SDK, cuer (QR codes).

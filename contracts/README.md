# Depositoor Contracts

Minimal, auditable smart contracts powering the Depositoor universal deposit protocol. Built on [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) with a `chainId = 0` authorization — one signature turns any EOA into a programmable deposit endpoint across every EVM chain.

## Architecture

```
User sends any token on any chain
         │
         ▼
┌───────────────────┐
│   Ephemeral EOA   │  ◄── EIP-7702 delegate set via chainId=0 auth
│   (QR address)    │
└───────────────────┘
         │
         ▼
┌───────────────────┐
│DepositoorDelegate │  ◄── Deployed at the EOA's address on the detected chain
│  · receive()      │  Auto-wraps ETH → WETH
│  · sweep()        │  Transfers tokens to recipient
│  · execute()      │  ERC-7821 batched calls (swap + bridge)
└───────────────────┘
         │
         ▼
  Swap (Uniswap) ──► Bridge (Uniswap X-Chain) ──► Destination wallet
```

## Contracts

### DepositoorDelegate

The core contract. Deployed via CREATE3 to the **same address on all chains**. When an EIP-7702 authorization is applied, it transforms any EOA into a smart deposit endpoint.

| Function | Description |
|----------|-------------|
| `receive()` | Auto-wraps incoming ETH to WETH via the canonical WETH contract |
| `sweep(token, to)` | Transfers the full balance of any ERC-20 to a recipient |
| `execute(mode, executionData)` | ERC-7821 batch execution — atomic swap + bridge sequences |

**Access control:** All state-changing functions are restricted to the `keeper` (backend relayer) or `address(this)` (self-calls within a batch).

### Create3Factory

Minimal CREATE3 factory for deterministic cross-chain deployments. Deployed via Nick's deterministic deployment proxy (`0x4e59b44847b379578588920cA78FbF26c0B4956C`) so it lives at the same address on every chain.

## Deployments

DepositoorDelegate is deployed at **`0x33333A781cbe9aC82Ba510BfF7b26c47a8FDecD4`** on all chains.

| Chain | Chain ID | WETH | Explorer |
|-------|----------|------|----------|
| Ethereum | 1 | `0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2` | [etherscan](https://etherscan.io/address/0x33333A781cbe9aC82Ba510BfF7b26c47a8FDecD4) |
| Arbitrum | 42161 | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` | [arbiscan](https://arbiscan.io/address/0x33333A781cbe9aC82Ba510BfF7b26c47a8FDecD4) |
| Base | 8453 | `0x4200000000000000000000000000000000000006` | [basescan](https://basescan.org/address/0x33333A781cbe9aC82Ba510BfF7b26c47a8FDecD4) |
| Optimism | 10 | `0x4200000000000000000000000000000000000006` | [optimistic](https://optimistic.etherscan.io/address/0x33333A781cbe9aC82Ba510BfF7b26c47a8FDecD4) |
| Polygon | 137 | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` | [polygonscan](https://polygonscan.com/address/0x33333A781cbe9aC82Ba510BfF7b26c47a8FDecD4) |

Create3Factory: `0xDc83FD2a9567c8B2e7Efd2328580c824ad0ab62D` (all chains)

## Getting Started

```bash
forge build
forge test -vvv
```

## Deployment

### 1. Mine a vanity salt

```bash
PRIVATE_KEY=0x... KEEPER=0x... ./script/mine-vanity.sh [prefix]
```

Or directly with Forge:

```bash
forge script script/MineSalt.s.sol \
  --sig "mine(string,uint256)" "d0" 2000000
```

### 2. Deploy to a single chain

```bash
PRIVATE_KEY=0x... KEEPER=0x... SALT=0x... \
  forge script script/Deploy.s.sol --rpc-url <rpc_url> --broadcast --verify
```

### 3. Deploy to all chains

```bash
PRIVATE_KEY=0x... KEEPER=0x... SALT=0x... \
  ./script/deploy-all.sh
```

The script is idempotent — it skips chains where the contract is already deployed.

## Design Principles

- **One address, all chains.** CREATE3 deployment ensures the same contract address regardless of constructor args.
- **No storage, no upgrades.** All config is in immutables. The delegate is stateless by design.
- **Idempotent recovery.** If any step fails, funds remain at the EOA and can be re-swept.
- **Minimal surface area.** ~50 lines of core Solidity. Easy to audit, hard to exploit.

## Project Structure

```
contracts/
├── src/
│   ├── DepositoorDelegate.sol   # Core delegate contract
│   ├── Create3Factory.sol       # Deterministic cross-chain deployer
│   └── mocks/
│       ├── MockERC20.sol
│       └── MockWETH.sol
├── script/
│   ├── Deploy.s.sol             # CREATE3 deployment script
│   ├── MineSalt.s.sol           # Vanity address miner
│   ├── deploy-all.sh            # Multi-chain deployment
│   └── mine-vanity.sh           # Vanity mining wrapper
├── foundry.toml
└── README.md
```

## Security

- The delegate is intentionally minimal. Swap routing and bridge calls are composed off-chain and executed via `ERC7821.execute()` as batched calls.
- EIP-7702 authorizations are ephemeral — each deposit session generates a fresh keypair. No long-lived keys are exposed.
- All funds are recoverable. If the backend is unavailable, the user's signed 7702 auth can sweep funds manually.
- The keeper is a single trusted relayer. In production, this should be a multisig or threshold key.

## Dependencies

- [Solady](https://github.com/Vectorized/solady) — Gas-optimized ERC-7821 and CREATE3
- [forge-std](https://github.com/foundry-rs/forge-std) — Foundry testing and scripting

## License

MIT

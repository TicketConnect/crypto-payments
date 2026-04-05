# @depositoor/react

Drop-in deposit widget. Any ERC-20 on any chain -> USDC at your destination.

## Install

```bash
npm install @depositoor/react
```

## Quick Start

```tsx
import { DepositoorProvider, DepositWidget } from '@depositoor/react'
import '@depositoor/react/styles.css'

function App() {
  return (
    <DepositoorProvider
      apiUrl="https://depositoor.xyz/api"
      implementationAddress="0x33333A781cbe9aC82Ba510BfF7b26c47a8FDecD4"
    >
      <DepositWidget
        destinationAddress="0xYourAddress"
        destinationChainId={8453}
        onComplete={(id) => console.log('Done:', id)}
      />
    </DepositoorProvider>
  )
}
```

## `<DepositoorProvider>` Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `apiUrl` | `string` | Yes | Depositoor API endpoint |
| `implementationAddress` | `` `0x${string}` `` | Yes | EIP-7702 delegate contract (same on all chains) |

## `<DepositWidget>` Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `destinationAddress` | `string` | Yes | | Where USDC lands |
| `destinationChainId` | `number` | Yes | | Target chain ID |
| `chains` | `number[]` | No | All 5 | Limit source chains shown |
| `theme` | `"light" \| "dark"` | No | `"light"` | Color theme |
| `onStatusChange` | `(status) => void` | No | | Status callback |
| `onComplete` | `(sessionId) => void` | No | | Fires when USDC arrives |
| `className` | `string` | No | | CSS class passthrough |

## Supported Chains

Ethereum (1), Arbitrum (42161), Base (8453), Optimism (10), Polygon (137)

## Theming

Override CSS custom properties on `.depositoor-widget`:

```css
.depositoor-widget {
  --depositoor-accent: #8b5cf6;
  --depositoor-radius: 8px;
  --depositoor-bg: #1a1a2e;
}
```

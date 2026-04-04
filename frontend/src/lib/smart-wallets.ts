import { Porto, Chains } from 'porto'
import { createCoinbaseWalletSDK } from '@coinbase/wallet-sdk'
import EthereumProvider from '@walletconnect/ethereum-provider'
import type { WalletProviderDetail, EIP1193Provider } from './wallets'

// ---------------------------------------------------------------------------
// Wallet icon config (SVGs in /wallet-logos/, styled like chain icons)
// ---------------------------------------------------------------------------

const PORTO_ICON = { icon: '/wallet-logos/porto.svg', logoBg: '#000000', logoScale: 0.55 }
const COINBASE_ICON = { icon: '/wallet-logos/coinbase.svg', logoBg: '#0000FF' }
const WALLETCONNECT_ICON = { icon: '/wallet-logos/walletconnect.svg', logoBg: '#3396FF', logoScale: 1.0 }

// ---------------------------------------------------------------------------
// Adapter: wrap any object with request/on/removeListener into our minimal
// EIP1193Provider interface so TypeScript is happy without pulling in heavy
// generics from each SDK.
// ---------------------------------------------------------------------------

function toEIP1193(raw: unknown): EIP1193Provider {
  const p = raw as {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>
    on(event: string, handler: (...args: unknown[]) => void): void
    removeListener(event: string, handler: (...args: unknown[]) => void): void
  }
  return {
    request: (args) => p.request(args),
    on: (event, handler) => p.on(event, handler),
    removeListener: (event, handler) => p.removeListener(event, handler),
  }
}

// ---------------------------------------------------------------------------
// Porto Smart Wallet
// ---------------------------------------------------------------------------

export function createPortoProvider(): WalletProviderDetail {
  const porto = Porto.create({
    announceProvider: false,
    chains: [
      Chains.mainnet,
      Chains.base,
      Chains.arbitrum,
      Chains.optimism,
      Chains.polygon,
      Chains.bsc,
    ],
  })

  return {
    info: {
      uuid: 'porto-smart-wallet',
      name: 'Porto',
      icon: PORTO_ICON.icon,
      rdns: 'xyz.ithaca.porto',
      logoBg: PORTO_ICON.logoBg,
      logoScale: PORTO_ICON.logoScale,
    },
    ecosystems: ['evm'],
    provider: toEIP1193(porto.provider),
    source: 'porto',
  }
}

// ---------------------------------------------------------------------------
// Coinbase Smart Wallet
// ---------------------------------------------------------------------------

export function createCoinbaseSmartWalletProvider(): WalletProviderDetail {
  const sdk = createCoinbaseWalletSDK({
    appName: 'Depositoor',
    appChainIds: [8453, 1, 42161, 10, 137, 56],
    preference: { options: 'smartWalletOnly' },
  })

  return {
    info: {
      uuid: 'coinbase-smart-wallet',
      name: 'Coinbase Smart Wallet',
      icon: COINBASE_ICON.icon,
      rdns: 'com.coinbase.wallet',
      logoBg: COINBASE_ICON.logoBg,
    },
    ecosystems: ['evm'],
    provider: toEIP1193(sdk.getProvider()),
    source: 'coinbase-smart-wallet',
  }
}

// ---------------------------------------------------------------------------
// WalletConnect (QR code for mobile wallets)
// ---------------------------------------------------------------------------

export async function createWalletConnectProvider(): Promise<WalletProviderDetail> {
  const wc = await EthereumProvider.init({
    projectId: '3a3386956c401ac0a1923e32a6610ae8',
    chains: [1],
    optionalChains: [42161, 8453, 10, 137, 56],
    showQrModal: true,
    disableProviderPing: true,
  })

  // WalletConnect requires .connect() before any .request() call.
  // Intercept eth_requestAccounts to call .connect() first (shows QR modal).
  const provider: EIP1193Provider = {
    request: async (args) => {
      if (args.method === 'eth_requestAccounts') {
        await wc.connect()
        return wc.accounts
      }
      return wc.request(args as Parameters<typeof wc.request>[0])
    },
    on: (event, handler) => wc.on(event as never, handler),
    removeListener: (event, handler) => wc.removeListener(event as never, handler),
  }

  return {
    info: {
      uuid: 'walletconnect',
      name: 'WalletConnect',
      icon: WALLETCONNECT_ICON.icon,
      rdns: 'com.walletconnect',
      logoBg: WALLETCONNECT_ICON.logoBg,
      logoScale: WALLETCONNECT_ICON.logoScale,
    },
    ecosystems: ['evm'],
    provider,
    source: 'walletconnect',
  }
}

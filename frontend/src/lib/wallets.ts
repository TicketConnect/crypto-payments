import type { Wallet as StandardWallet } from '@wallet-standard/base'

// Ecosystem discriminator
export type Ecosystem = 'evm' | 'solana'

// Wallet source discriminator
export type WalletSource = 'eip6963' | 'porto' | 'coinbase-smart-wallet' | 'walletconnect' | 'wallet-standard'

// Re-export for consumers
export type { StandardWallet }

// Provider metadata
export interface WalletProviderInfo {
  uuid: string
  name: string
  icon: string        // data URI or URL
  rdns: string        // reverse DNS identifier
  logoBg?: string     // background color behind icon (like ChainLogo)
  logoScale?: number  // 0-1+ scale of icon inside square (default 0.75 when logoBg set)
}

// EIP-1193 provider interface
export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on(event: string, handler: (...args: unknown[]) => void): void
  removeListener(event: string, handler: (...args: unknown[]) => void): void
}

// Generalized wallet provider detail
export interface WalletProviderDetail {
  info: WalletProviderInfo
  ecosystems: Ecosystem[]
  provider?: EIP1193Provider          // present when ecosystems includes 'evm'
  solanaWallet?: StandardWallet       // present when ecosystems includes 'solana'
  source: WalletSource
}

// Internal EIP-6963 event types (used only by discoverProviders)
interface EIP6963AnnounceDetail {
  info: WalletProviderInfo
  provider: EIP1193Provider
}

declare global {
  interface WindowEventMap {
    'eip6963:announceProvider': CustomEvent<EIP6963AnnounceDetail>
  }
}

/** Discover all injected EIP-6963 wallet providers. */
export function discoverProviders(
  onProvider: (detail: WalletProviderDetail) => void
): () => void {
  const handler = (event: CustomEvent<EIP6963AnnounceDetail>) => {
    onProvider({
      info: event.detail.info,
      provider: event.detail.provider,
      ecosystems: ['evm'],
      source: 'eip6963',
    })
  }

  window.addEventListener('eip6963:announceProvider', handler)
  window.dispatchEvent(new Event('eip6963:requestProvider'))

  return () => window.removeEventListener('eip6963:announceProvider', handler)
}

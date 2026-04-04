import { getWallets } from '@wallet-standard/app'
import type { Wallet as StandardWallet } from '@wallet-standard/base'

/** Check if a Wallet Standard wallet supports Solana mainnet and connect. */
function isSolanaWallet(wallet: StandardWallet): boolean {
  return (
    wallet.chains.some((c) => c === 'solana:mainnet') &&
    'standard:connect' in wallet.features
  )
}

/**
 * Discover Solana wallets via the Wallet Standard.
 * Calls onWallet for each discovered wallet and returns a cleanup function.
 */
export function discoverSolanaWallets(
  onWallet: (wallet: StandardWallet) => void
): () => void {
  const { get, on } = getWallets()

  // Emit already-registered wallets
  for (const wallet of get()) {
    if (isSolanaWallet(wallet)) onWallet(wallet)
  }

  // Listen for newly registered wallets
  const cleanup = on('register', (wallet) => {
    if (isSolanaWallet(wallet)) onWallet(wallet)
  })

  return cleanup
}

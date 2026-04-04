import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  discoverProviders,
  type WalletProviderDetail,
  type EIP1193Provider,
  type Ecosystem,
} from '../lib/wallets'
import { createPortoProvider, createCoinbaseSmartWalletProvider, createWalletConnectProvider } from '../lib/smart-wallets'
import { discoverSolanaWallets } from '../lib/solana-wallets'

// Maps EIP-6963 rdns → Wallet Standard name for known multi-chain wallets
const MULTICHAIN_WALLETS: Record<string, string> = {
  'app.phantom': 'Phantom',
  'com.trustwallet.app': 'Trust',
  'app.backpack': 'Backpack',
  'io.metamask': 'MetaMask',
}

// Reverse: Wallet Standard name → EIP-6963 rdns
const SOLANA_TO_EVM_RDNS = Object.fromEntries(
  Object.entries(MULTICHAIN_WALLETS).map(([rdns, name]) => [name, rdns])
)

interface WalletState {
  address: string | null
  chainId: number | null
  ecosystem: Ecosystem | null
  provider: EIP1193Provider | null
  providers: WalletProviderDetail[]
  connect: (detail: WalletProviderDetail, ecosystem?: Ecosystem) => Promise<void>
  disconnect: () => void
  switchChain: (chainId: number) => Promise<void>
}

const WalletContext = createContext<WalletState | null>(null)

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [providers, setProviders] = useState<WalletProviderDetail[]>([])
  const [provider, setProvider] = useState<EIP1193Provider | null>(null)
  const [address, setAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [ecosystem, setEcosystem] = useState<Ecosystem | null>(null)

  // Discover wallet providers on mount
  useEffect(() => {
    // Initialize with static smart wallet providers
    const smartWallets = [
      createPortoProvider(),
      createCoinbaseSmartWalletProvider(),
    ]
    setProviders(smartWallets)

    // Initialize WalletConnect (async) and append when ready
    let stale = false
    createWalletConnectProvider().then((wc) => {
      if (!stale) setProviders((prev) => [...prev, wc])
    })

    // rdns of providers we manage via SDKs — skip if discovered via EIP-6963
    const sdkRdns = new Set(['xyz.ithaca.porto', 'com.coinbase.wallet', 'com.walletconnect'])

    // Discover browser extension providers via EIP-6963
    const cleanupDiscovery = discoverProviders((detail) => {
      if (sdkRdns.has(detail.info.rdns)) return

      setProviders((prev) => {
        if (prev.some((p) => p.info.uuid === detail.info.uuid)) return prev

        // Check if this EVM wallet should merge with an existing Solana wallet
        const solanaName = MULTICHAIN_WALLETS[detail.info.rdns]
        if (solanaName) {
          const idx = prev.findIndex((p) => p.info.name === solanaName && p.ecosystems.includes('solana'))
          if (idx !== -1) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              info: detail.info, // prefer EIP-6963 metadata (has rdns, better icon)
              ecosystems: [...new Set([...updated[idx].ecosystems, 'evm' as const])],
              provider: detail.provider,
              source: detail.source,
            }
            return updated
          }
        }

        return [...prev, detail]
      })
    })

    // Discover Solana wallets via Wallet Standard
    const cleanupSolana = discoverSolanaWallets((wallet) => {
      const matchingRdns = SOLANA_TO_EVM_RDNS[wallet.name]

      setProviders((prev) => {
        // Try to merge with an existing EVM wallet
        if (matchingRdns) {
          const idx = prev.findIndex((p) => p.info.rdns === matchingRdns)
          if (idx !== -1) {
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx],
              ecosystems: [...new Set([...updated[idx].ecosystems, 'solana' as const])],
              solanaWallet: wallet,
            }
            return updated
          }
        }

        // No match — add as standalone Solana wallet
        return [...prev, {
          info: {
            uuid: `solana-${wallet.name}`,
            name: wallet.name,
            icon: wallet.icon as string,
            rdns: '',
          },
          ecosystems: ['solana'],
          solanaWallet: wallet,
          source: 'wallet-standard',
        }]
      })
    })

    return () => {
      stale = true
      cleanupDiscovery()
      cleanupSolana()
    }
  }, [])

  // Listen for chain/account changes on the active provider
  useEffect(() => {
    if (!provider) return

    const onChainChanged = (raw: unknown) => {
      setChainId(Number(raw as string))
    }
    const onAccountsChanged = (raw: unknown) => {
      const accounts = raw as string[]
      if (accounts.length === 0) {
        setAddress(null)
        setProvider(null)
        setChainId(null)
      } else {
        setAddress(accounts[0])
      }
    }

    provider.on('chainChanged', onChainChanged)
    provider.on('accountsChanged', onAccountsChanged)
    return () => {
      provider.removeListener('chainChanged', onChainChanged)
      provider.removeListener('accountsChanged', onAccountsChanged)
    }
  }, [provider])

  const connect = useCallback(async (detail: WalletProviderDetail, eco: Ecosystem = 'evm') => {
    if (eco === 'evm') {
      if (!detail.provider) return
      const accounts = (await detail.provider.request({
        method: 'eth_requestAccounts',
      })) as string[]
      const chain = (await detail.provider.request({
        method: 'eth_chainId',
      })) as string

      setProvider(detail.provider)
      setAddress(accounts[0])
      setChainId(Number(chain))
      setEcosystem('evm')
      return
    }

    // Solana connection
    if (!detail.solanaWallet) return
    const connectFeature = detail.solanaWallet.features['standard:connect'] as {
      connect(): Promise<{ accounts: ReadonlyArray<{ address: string }> }>
    }
    const { accounts } = await connectFeature.connect()
    if (accounts.length === 0) return
    setAddress(accounts[0].address)
    setChainId(null)
    setProvider(null)
    setEcosystem('solana')
  }, [])

  const disconnect = useCallback(() => {
    setProvider(null)
    setAddress(null)
    setChainId(null)
    setEcosystem(null)
  }, [])

  const switchChain = useCallback(
    async (targetChainId: number) => {
      if (!provider) return
      await provider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x' + targetChainId.toString(16) }],
      })
    },
    [provider]
  )

  return (
    <WalletContext.Provider
      value={{ address, chainId, ecosystem, provider, providers, connect, disconnect, switchChain }}
    >
      {children}
    </WalletContext.Provider>
  )
}

import { useState, useEffect } from 'react'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import './App.css'
import { WalletDropdown } from './components/WalletDropdown'
import { QRContent } from './components/QRContent'
import { Settings } from './components/Settings'
import { DepositMethods } from './components/DepositMethods'
import { SupportedAssets } from './components/SupportedAssets'
import { IMPL_ADDRESS, SUPPORTED_CHAINS } from './lib/constants'
import type { Chain } from './lib/constants'
import { useSession } from './hooks/useSession'

type View = 'methods' | 'crypto' | 'settings' | 'assets'

export type SignedAuthJson = {
  address: string
  chainId: number
  nonce: number
  r: string
  s: string
  yParity: number
}

export type StoredWallet = {
  id: string
  address: string
  privateKey: `0x${string}`
  createdAt: number
  destinationAddress: string
  destinationChainId: number
  signedAuth: SignedAuthJson
}

const STORAGE_KEY = 'depositoor_wallets'

function loadWallets(): StoredWallet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveWallets(wallets: StoredWallet[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets))
}

async function createWalletData(destinationAddress: string, destinationChainId: number): Promise<StoredWallet> {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  const signedAuth = await account.signAuthorization({
    contractAddress: IMPL_ADDRESS,
    chainId: 0,
    nonce: 0,
  })
  return {
    id: crypto.randomUUID(),
    address: account.address,
    privateKey,
    createdAt: Date.now(),
    destinationAddress,
    destinationChainId,
    signedAuth: {
      address: signedAuth.address,
      chainId: signedAuth.chainId,
      nonce: signedAuth.nonce,
      r: signedAuth.r,
      s: signedAuth.s,
      yParity: signedAuth.yParity,
    },
  }
}

function App() {
  const [wallets, setWallets] = useState<StoredWallet[]>(() => loadWallets())
  const [activeWalletId, setActiveWalletId] = useState<string | null>(() => {
    const loaded = loadWallets()
    return loaded.length > 0 ? loaded[0].id : null
  })
  const [view, setView] = useState<View>('methods')
  const [assetsChainId, setAssetsChainId] = useState<number | undefined>()

  // Create first wallet if none exist
  useEffect(() => {
    if (wallets.length > 0) return
    createWalletData('', SUPPORTED_CHAINS[0].id).then(wallet => {
      const updated = [wallet]
      setWallets(updated)
      saveWallets(updated)
      setActiveWalletId(wallet.id)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeWallet = wallets.find(w => w.id === activeWalletId)

  const { session, error: sessionError } = useSession(
    activeWallet?.address ?? null,
    activeWallet?.signedAuth ?? null,
    activeWallet?.destinationAddress ?? '',
    activeWallet?.destinationChainId ?? SUPPORTED_CHAINS[0].id,
  )

  async function handleNewAddress() {
    const destChainId = activeWallet?.destinationChainId ?? SUPPORTED_CHAINS[0].id
    const wallet = await createWalletData(activeWallet?.destinationAddress ?? '', destChainId)
    const updated = [wallet, ...wallets]
    setWallets(updated)
    saveWallets(updated)
    setActiveWalletId(wallet.id)
  }

  function handleSaveSettings(destinationAddress: string, chain: Chain) {
    const updated = wallets.map(w =>
      w.id === activeWalletId
        ? { ...w, destinationAddress, destinationChainId: chain.id }
        : w
    )
    setWallets(updated)
    saveWallets(updated)
    setView('crypto')
  }

  function handleDelete(id: string) {
    if (wallets.length <= 1) return
    const updated = wallets.filter(w => w.id !== id)
    setWallets(updated)
    saveWallets(updated)
    if (id === activeWalletId) {
      setActiveWalletId(updated[0].id)
    }
  }

  function handleSelect(id: string) {
    setActiveWalletId(id)
    setView('crypto')
  }

  if (!activeWallet) {
    return (
      <div className="app">
        <div className="main-card">
          <div className="qr-status">
            <span className="status-pulse" />
            <span>Generating wallet...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="main-card">
        <div className="card-header">
          {view === 'methods' ? (
            <span className="card-title">Deposit</span>
          ) : view === 'crypto' ? (
            <>
              <button className="back-btn" onClick={() => setView('methods')} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <WalletDropdown
                wallets={wallets}
                activeId={activeWalletId!}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onNewAddress={handleNewAddress}
              />
              <button
                className="settings-btn"
                onClick={() => setView('settings')}
                type="button"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </>
          ) : view === 'settings' ? (
            <>
              <button className="back-btn" onClick={() => setView('crypto')} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <span className="card-title">Settings</span>
              <div style={{ width: 40 }} />
            </>
          ) : (
            <>
              <button className="back-btn" onClick={() => setView('crypto')} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
              </button>
              <span className="card-title">Supported Assets</span>
              <div style={{ width: 40 }} />
            </>
          )}
        </div>

        {view === 'settings' ? (
          <Settings
            wallet={activeWallet}
            chains={SUPPORTED_CHAINS.filter(c => !c.comingSoon)}
            onSave={handleSaveSettings}
          />
        ) : view === 'crypto' ? (
          <QRContent wallet={activeWallet} session={session} onShowAssets={(chainId) => { setAssetsChainId(chainId); setView('assets') }} />
        ) : view === 'assets' ? (
          <SupportedAssets initialChainId={assetsChainId} />
        ) : (
          <DepositMethods onSelectCrypto={() => setView('crypto')} />
        )}
      </div>
    </div>
  )
}

export default App

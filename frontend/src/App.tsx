import { useState } from 'react'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import './App.css'
import { WalletDropdown } from './components/WalletDropdown'
import { QRContent } from './components/QRContent'
import { Settings } from './components/Settings'

export type Chain = {
  id: number
  name: string
  color: string
}

export const CHAINS: Chain[] = [
  { id: 42161, name: 'Arbitrum', color: '#12AAFF' },
  { id: 8453, name: 'Base', color: '#0052FF' },
  { id: 10, name: 'Optimism', color: '#FF0420' },
]

export type StoredWallet = {
  id: string
  address: string
  privateKey: string
  createdAt: number
  chainId: number
  chainName: string
  chainColor: string
  destinationAddress: string
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

function createWalletData(destinationAddress: string, chain: Chain): StoredWallet {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)
  return {
    id: crypto.randomUUID(),
    address: account.address,
    privateKey,
    createdAt: Date.now(),
    chainId: chain.id,
    chainName: chain.name,
    chainColor: chain.color,
    destinationAddress,
  }
}

function App() {
  const [wallets, setWallets] = useState<StoredWallet[]>(() => {
    const loaded = loadWallets()
    if (loaded.length > 0) return loaded
    const first = createWalletData('', CHAINS[0])
    saveWallets([first])
    return [first]
  })

  const [activeWalletId, setActiveWalletId] = useState(() => wallets[0].id)
  const [showSettings, setShowSettings] = useState(false)

  const activeWallet = wallets.find(w => w.id === activeWalletId)!

  function handleNewAddress() {
    const wallet = createWalletData(activeWallet.destinationAddress, {
      id: activeWallet.chainId,
      name: activeWallet.chainName,
      color: activeWallet.chainColor,
    })
    const updated = [wallet, ...wallets]
    setWallets(updated)
    saveWallets(updated)
    setActiveWalletId(wallet.id)
  }

  function handleSaveSettings(destinationAddress: string, chain: Chain) {
    const updated = wallets.map(w =>
      w.id === activeWalletId
        ? { ...w, destinationAddress, chainId: chain.id, chainName: chain.name, chainColor: chain.color }
        : w
    )
    setWallets(updated)
    saveWallets(updated)
    setShowSettings(false)
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
    setShowSettings(false)
  }

  return (
    <div className="app">
      <div className="main-card">
        <div className="card-header">
          <WalletDropdown
            wallets={wallets}
            activeId={activeWalletId}
            onSelect={handleSelect}
            onDelete={handleDelete}
            onNewAddress={handleNewAddress}
          />
          <button
            className={`settings-btn ${showSettings ? 'active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>

        {showSettings ? (
          <Settings
            wallet={activeWallet}
            chains={CHAINS}
            onSave={handleSaveSettings}
          />
        ) : (
          <QRContent wallet={activeWallet} />
        )}
      </div>
    </div>
  )
}

export default App

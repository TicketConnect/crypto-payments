import { useState, useEffect, useCallback } from 'react'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import './App.css'
import { WalletDropdown } from './components/WalletDropdown'
import { QRContent } from './components/QRContent'
import { DestinationPanel } from './components/DestinationPanel'
import { DepositMethods } from './components/DepositMethods'
import { SupportedAssets } from './components/SupportedAssets'
import { PeerInProgress } from './components/PeerInProgress'
import { PeerInstall } from './components/PeerInstall'
import { ConnectWallet } from './components/ConnectWallet'
import { TokenList } from './components/TokenList'
import { DepositForm } from './components/DepositForm'
import { DepositConfirm } from './components/DepositConfirm'
import { DepositStatus } from './components/DepositStatus'
import { useWallet } from './components/WalletProvider'
import { fetchQuote, submitSession, type QuoteResponse } from './lib/quote'
import type { TokenBalance } from './lib/dune'
import { IMPL_ADDRESS, SUPPORTED_CHAINS } from './lib/constants'
import { useSession } from './hooks/useSession'

type View =
  | 'methods'
  | 'crypto'
  | 'assets'
  | 'peer'
  | 'peer-install'
  | 'wallet-connect'
  | 'wallet-tokens'
  | 'wallet-deposit'
  | 'wallet-confirm'
  | 'wallet-status'

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
      yParity: signedAuth.yParity ?? 0,
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

  // Wallet flow state
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null)
  const [quote, setQuote] = useState<QuoteResponse | null>(null)
  const [walletTxHash, setWalletTxHash] = useState<string | null>(null)
  const [walletSessionId, setWalletSessionId] = useState<string | null>(null)
  const [signing, setSigning] = useState(false)

  const wallet = useWallet()

  // When wallet connects while on wallet-connect view, advance to token list
  useEffect(() => {
    if (view === 'wallet-connect' && wallet.address) {
      setView('wallet-tokens')
    }
  }, [view, wallet.address])

  // Create first wallet if none exist
  useEffect(() => {
    if (wallets.length > 0) return
    createWalletData('', SUPPORTED_CHAINS[0].id).then(w => {
      const updated = [w]
      setWallets(updated)
      saveWallets(updated)
      setActiveWalletId(w.id)
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeWallet = wallets.find(w => w.id === activeWalletId)

  const { session } = useSession(
    activeWallet?.address ?? null,
    activeWallet?.signedAuth ?? null,
    activeWallet?.destinationAddress ?? '',
    activeWallet?.destinationChainId ?? SUPPORTED_CHAINS[0].id,
  )

  async function handleNewAddress() {
    const destChainId = activeWallet?.destinationChainId ?? SUPPORTED_CHAINS[0].id
    const w = await createWalletData(activeWallet?.destinationAddress ?? '', destChainId)
    const updated = [w, ...wallets]
    setWallets(updated)
    saveWallets(updated)
    setActiveWalletId(w.id)
  }

  function handleChainChange(chainId: number) {
    const updated = wallets.map(w =>
      w.id === activeWalletId ? { ...w, destinationChainId: chainId } : w
    )
    setWallets(updated)
    saveWallets(updated)
  }

  function handleAddressChange(address: string) {
    const updated = wallets.map(w =>
      w.id === activeWalletId ? { ...w, destinationAddress: address } : w
    )
    setWallets(updated)
    saveWallets(updated)
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

  // Wallet flow handlers
  function handleSelectWallet() {
    if (wallet.address) {
      setView('wallet-tokens')
    } else {
      setView('wallet-connect')
    }
  }

  function handleTokenSelect(token: TokenBalance) {
    setSelectedToken(token)
    setView('wallet-deposit')
  }

  const handleDepositSubmit = useCallback(async (amount: string, destChainId: number) => {
    if (!wallet.address || !selectedToken) return
    try {
      const rawAmount = BigInt(Math.floor(Number(amount) * 10 ** selectedToken.decimals)).toString()
      const q = await fetchQuote({
        wallet: wallet.address,
        src_chain_id: selectedToken.chain_id,
        token: selectedToken.address,
        amount: rawAmount,
        dest_chain_id: destChainId,
      })
      setQuote(q)
      setView('wallet-confirm')
    } catch (e) {
      console.error('Quote error:', e)
    }
  }, [wallet.address, selectedToken])

  const handleConfirm = useCallback(async () => {
    if (!quote || !wallet.provider) return
    setSigning(true)
    try {
      const txHash = (await wallet.provider.request({
        method: 'eth_sendTransaction',
        params: [quote.tx],
      })) as string
      setWalletTxHash(txHash)

      await submitSession(quote.quote_id, txHash)
      setWalletSessionId(quote.quote_id)
      setView('wallet-status')
    } catch (e) {
      console.error('Transaction error:', e)
    } finally {
      setSigning(false)
    }
  }, [quote, wallet.provider])

  function handleWalletDone() {
    setSelectedToken(null)
    setQuote(null)
    setWalletTxHash(null)
    setWalletSessionId(null)
    setView('methods')
  }

  function walletBackTo(target: View) {
    return () => setView(target)
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

  const backIcon = (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )

  const walletViewTitles: Partial<Record<View, string>> = {
    'wallet-connect': 'Connect Wallet',
    'wallet-tokens': 'Select Token',
    'wallet-deposit': 'Deposit',
    'wallet-confirm': 'Confirm',
    'wallet-status': 'Status',
  }

  const walletBackTargets: Partial<Record<View, View>> = {
    'wallet-connect': 'methods',
    'wallet-tokens': 'methods',
    'wallet-deposit': 'wallet-tokens',
    'wallet-confirm': 'wallet-deposit',
  }

  const isWalletView = view.startsWith('wallet-')

  return (
    <div className="app">
      <div className={`main-card${view === 'methods' ? ' main-card--compact' : ''}`}>
        <div className="card-header">
          {view === 'methods' ? (
            <span className="card-title">Deposit</span>
          ) : view === 'crypto' ? (
            <>
              <button className="back-btn" onClick={() => setView('methods')} type="button">
                {backIcon}
              </button>
              <WalletDropdown
                wallets={wallets}
                activeId={activeWalletId!}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onNewAddress={handleNewAddress}
              />
              <div style={{ width: 40 }} />
            </>
          ) : view === 'peer' || view === 'peer-install' ? (
            <>
              <button className="back-btn" onClick={() => setView('methods')} type="button">
                {backIcon}
              </button>
              <span className="card-title">{view === 'peer-install' ? 'Install Peer' : 'Peer-to-peer'}</span>
              <div style={{ width: 40 }} />
            </>
          ) : view === 'assets' ? (
            <>
              <button className="back-btn" onClick={() => setView('crypto')} type="button">
                {backIcon}
              </button>
              <span className="card-title">Supported Assets</span>
              <div style={{ width: 40 }} />
            </>
          ) : isWalletView ? (
            <>
              {walletBackTargets[view] ? (
                <button className="back-btn" onClick={walletBackTo(walletBackTargets[view]!)} type="button">
                  {backIcon}
                </button>
              ) : (
                <div style={{ width: 40 }} />
              )}
              <span className="card-title">{walletViewTitles[view]}</span>
              {wallet.address && view === 'wallet-tokens' ? (
                <button className="settings-btn" onClick={() => { wallet.disconnect(); setView('methods') }} type="button">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                </button>
              ) : (
                <div style={{ width: 40 }} />
              )}
            </>
          ) : null}
        </div>

        <div className="card-body">
          {view === 'crypto' ? (
            <QRContent wallet={activeWallet} session={session} onShowAssets={(chainId) => { setAssetsChainId(chainId); setView('assets') }} />
          ) : view === 'assets' ? (
            <SupportedAssets initialChainId={assetsChainId} />
          ) : view === 'peer' ? (
            <PeerInProgress
              destinationChainId={activeWallet.destinationChainId}
              destinationAddress={activeWallet.destinationAddress || undefined}
            />
          ) : view === 'peer-install' ? (
            <PeerInstall />
          ) : view === 'wallet-connect' ? (
            <ConnectWallet />
          ) : view === 'wallet-tokens' && wallet.address ? (
            <TokenList walletAddress={wallet.address} onSelect={handleTokenSelect} />
          ) : view === 'wallet-deposit' && selectedToken ? (
            <DepositForm token={selectedToken} onSubmit={handleDepositSubmit} onBack={walletBackTo('wallet-tokens')} />
          ) : view === 'wallet-confirm' && quote ? (
            <DepositConfirm quote={quote} onConfirm={handleConfirm} onCancel={walletBackTo('wallet-deposit')} signing={signing} />
          ) : view === 'wallet-status' && walletTxHash && walletSessionId ? (
            <DepositStatus txHash={walletTxHash} sessionId={walletSessionId} onDone={handleWalletDone} />
          ) : (
            <DepositMethods
              onSelectCrypto={() => setView('crypto')}
              onSelectWallet={handleSelectWallet}
              onPeerStarted={() => setView('peer')}
              onNeedsInstall={() => setView('peer-install')}
              destinationChainId={activeWallet.destinationChainId}
              destinationAddress={activeWallet.destinationAddress || undefined}
            />
          )}
        </div>
      </div>

      <DestinationPanel
        destinationChainId={activeWallet.destinationChainId}
        destinationAddress={activeWallet.destinationAddress}
        onChainChange={handleChainChange}
        onAddressChange={handleAddressChange}
      />
    </div>
  )
}

export default App

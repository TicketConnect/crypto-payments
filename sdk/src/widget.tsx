import React, { useState, useEffect, useRef, useCallback } from 'react'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Cuer } from 'cuer'
import { useDepositoor } from './hooks/useDepositoor'
import { registerSession, connectSSE } from './api'
import { SUPPORTED_CHAINS, SUPPORTED_TOKENS, PEER_METHODS } from './constants'
import type { SessionStatus, Session, SignedAuth, DepositWidgetProps, Chain, PeerMethod, Token } from './types'

// ── Internal types ──

type View = 'methods' | 'crypto' | 'assets'

type StoredWallet = {
  id: string
  address: string
  privateKey: `0x${string}`
  signedAuth: SignedAuth
}

// ── Inline SVGs for chain logos ──

const CHAIN_SVGS: Record<number, React.ReactElement> = {
  1: (
    <svg viewBox="0 0 24 24" fill="none">
      <path fill="#fff" d="M12 3v6.651l5.625 2.516z" />
      <path fill="#fff" d="m12 3-5.625 9.166L12 9.653z" />
      <path fill="#fff" d="m12 15.43 5.625-3.263L12 9.652z" />
      <path fill="#fff" d="M6.375 12.167 12 15.43V9.652z" />
      <path fill="#fff" d="M12 17V21l5.625-7.784z" />
      <path fill="#fff" d="M12 21v-4l-5.625-3.784z" />
    </svg>
  ),
  42161: (
    <svg viewBox="0 0 24 24" fill="none">
      <path fill="#213147" d="M4.515 8.471v7.056c0 .45.245.867.64 1.092l6.205 3.529a1.3 1.3 0 0 0 1.28 0l6.203-3.53c.396-.224.64-.64.64-1.09V8.47c0-.45-.244-.867-.64-1.091L12.64 3.85a1.3 1.3 0 0 0-1.28 0L5.155 7.38a1.25 1.25 0 0 0-.639 1.091" />
      <path fill="#12AAFF" d="m13.353 13.368-.885 2.39a.3.3 0 0 0 0 .205l1.523 4.112 1.76-1.001-2.113-5.706a.152.152 0 0 0-.285 0m1.774-4.019a.152.152 0 0 0-.285 0l-.885 2.39a.3.3 0 0 0 0 .205l2.494 6.732 1.761-1.001z" />
      <path fill="#9DCCED" d="M11.998 4.115a.3.3 0 0 1 .126.033l6.715 3.818a.25.25 0 0 1 .126.214v7.635c0 .089-.048.17-.126.214l-6.715 3.819a.25.25 0 0 1-.126.032.3.3 0 0 1-.125-.032l-6.715-3.815a.25.25 0 0 1-.126-.215V8.182c0-.089.048-.17.126-.215l6.715-3.818a.26.26 0 0 1 .125-.034" />
      <path fill="#213147" d="m7.559 18.685.617-1.666 1.244 1.018-1.163 1.046z" />
      <path fill="#fff" d="M11.433 7.635H9.731a.3.3 0 0 0-.285.197l-3.649 9.852 1.761 1.001 4.018-10.849a.15.15 0 0 0-.143-.2m2.979-.001h-1.703a.3.3 0 0 0-.284.197l-4.167 11.25 1.761 1 4.535-12.246a.15.15 0 0 0-.142-.2" />
    </svg>
  ),
  8453: (
    <svg viewBox="0 0 24 24" fill="none">
      <path fill="#00F" d="M3 4.706c0-.585 0-.877.11-1.101.106-.215.28-.39.496-.495C3.83 3 4.122 3 4.706 3h14.588c.585 0 .876 0 1.101.11.215.105.389.28.494.495.111.225.111.517.111 1.101v14.588c0 .585 0 .876-.11 1.101-.106.215-.28.389-.495.494-.225.111-.517.111-1.101.111H4.706c-.585 0-.876 0-1.101-.11a1.08 1.08 0 0 1-.494-.495C3 20.17 3 19.878 3 19.294z" />
    </svg>
  ),
  10: (
    <svg viewBox="0 0 1024 1024" fill="none">
      <path fill="#FF0421" d="M0 0h1024v1024H0z" />
      <path fill="#FAFAF9" d="M512.337 60c196.772 0 356.337 159.564 356.337 356.336 0 196.774-159.565 356.34-356.337 356.34v191.296C315.563 963.972 156 804.406 156 607.635c0-196.774 159.563-356.337 356.337-356.337V60Zm-1.651 275.693c-38.71 77.719-96.924 135.931-174.643 174.641v3.303c77.719 38.709 135.933 96.921 174.643 174.64h3.302c38.707-77.719 96.922-135.931 174.641-174.64v-3.303c-77.719-38.71-135.934-96.922-174.641-174.641h-3.302Z" />
    </svg>
  ),
  137: (
    <svg viewBox="0 0 360 360" fill="none">
      <rect width="360" height="360" rx="30" fill="#6C00F6" />
      <path d="M218.804 99.5819L168.572 128.432V218.473L140.856 234.539L112.97 218.46V186.313L140.856 170.39L158.786 180.788V154.779L140.699 144.511L90.4795 173.687V231.399L140.869 260.418L191.088 231.399V141.371L218.974 125.291L246.846 141.371V173.374L218.974 189.597L200.887 179.107V204.986L218.804 215.319L269.519 186.47V128.432L218.804 99.5819Z" fill="white" />
    </svg>
  ),
}

// ── ChainLogo helper ──

function ChainLogo({ chain, size }: { chain: Chain; size: number }) {
  const r = Math.round(size * 0.22)
  const svg = CHAIN_SVGS[chain.id]

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: chain.logoBg ?? chain.color,
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {svg ? (
        <div style={{ width: Math.round(size * (chain.logoScale ?? 0.75)), height: Math.round(size * (chain.logoScale ?? 0.75)), display: 'flex' }}>
          {svg}
        </div>
      ) : (
        <span style={{ color: '#fff', fontSize: Math.round(size * 0.5), fontWeight: 700, lineHeight: 1 }}>
          {chain.name[0]}
        </span>
      )}
    </div>
  )
}

// ── PeerMethodLogo helper ──

function PeerMethodLogo({ method, size }: { method: PeerMethod; size: number }) {
  const r = Math.round(size * 0.22)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: method.color,
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          color: method.color === '#ffffff' || method.color === '#9FE870' ? '#000' : '#fff',
          fontSize: 7,
          fontWeight: 700,
          lineHeight: 1,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {method.name[0]}
      </span>
    </div>
  )
}

// ── SVG icons ──

const backIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
)

const copyIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
)

const checkIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const chevronRight = (
  <svg className="depositoor-accepted-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

const qrCodeIcon = (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <rect x="0.5" y="0.5" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <rect x="2.25" y="2.25" width="2.5" height="2.5" rx="0.5" />
    <rect x="9.5" y="0.5" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <rect x="11.25" y="2.25" width="2.5" height="2.5" rx="0.5" />
    <rect x="0.5" y="9.5" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
    <rect x="2.25" y="11.25" width="2.5" height="2.5" rx="0.5" />
    <circle cx="9.8" cy="9.8" r="0.55" />
    <circle cx="11.5" cy="9.8" r="0.55" />
    <circle cx="15" cy="9.8" r="0.55" />
    <circle cx="9.8" cy="11.5" r="0.55" />
    <circle cx="13.3" cy="11.5" r="0.55" />
    <circle cx="15" cy="11.5" r="0.55" />
    <circle cx="11.5" cy="13.3" r="0.55" />
    <circle cx="13.3" cy="13.3" r="0.55" />
    <circle cx="9.8" cy="15" r="0.55" />
    <circle cx="13.3" cy="15" r="0.55" />
    <circle cx="15" cy="15" r="0.55" />
  </svg>
)

const walletIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
    <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
  </svg>
)

const dollarIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
)

// ── Utility ──

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// ── WalletDropdown sub-component ──

function WalletDropdown({
  wallets,
  activeId,
  onSelect,
  onDelete,
  onNewAddress,
}: {
  wallets: StoredWallet[]
  activeId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNewAddress: () => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const active = wallets.find(w => w.id === activeId)

  if (!active) return null

  return (
    <div className="depositoor-dropdown">
      <button
        className="depositoor-dropdown-trigger"
        onClick={() => setOpen(o => !o)}
        type="button"
      >
        <span className="depositoor-dropdown-addr">{truncateAddress(active.address)}</span>
        <svg
          className={`depositoor-dropdown-chevron ${open ? 'depositoor-dropdown-chevron--open' : ''}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          <div className="depositoor-dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="depositoor-dropdown-menu">
            {wallets.map(w => (
              <div
                key={w.id}
                className={`depositoor-dropdown-item ${w.id === activeId ? 'depositoor-dropdown-item--active' : ''}`}
                onClick={() => { onSelect(w.id); setOpen(false) }}
                role="button"
                tabIndex={0}
              >
                <span className="depositoor-dropdown-item-addr">{truncateAddress(w.address)}</span>
                {wallets.length > 1 && (
                  <button
                    className="depositoor-dropdown-item-delete"
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(w.id) }}
                    type="button"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <div className="depositoor-dropdown-divider" />
            <button
              className="depositoor-dropdown-new"
              onClick={() => { onNewAddress(); setOpen(false) }}
              type="button"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Address
            </button>
          </div>
        </>
      )}

      {confirmDeleteId && (() => {
        const w = wallets.find(w => w.id === confirmDeleteId)
        if (!w) return null
        return (
          <>
            <div className="depositoor-dropdown-backdrop" onClick={() => setConfirmDeleteId(null)} />
            <div className="depositoor-confirm-dialog">
              <p className="depositoor-confirm-title">Delete address?</p>
              <p className="depositoor-confirm-addr">{truncateAddress(w.address)}</p>
              <p className="depositoor-confirm-warning">
                Private key will be lost. Make sure you have saved it if there are funds on this address.
              </p>
              <div className="depositoor-confirm-actions">
                <button
                  className="depositoor-confirm-cancel"
                  onClick={() => setConfirmDeleteId(null)}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="depositoor-confirm-delete"
                  onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null) }}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

// ── DestinationPanel sub-component ──

function DestinationPanel({
  destinationChainId,
  destinationAddress,
  visibleChains,
  onChainChange,
  onAddressChange,
}: {
  destinationChainId: number
  destinationAddress: string
  visibleChains: Chain[]
  onChainChange: (chainId: number) => void
  onAddressChange: (address: string) => void
}) {
  const [open, setOpen] = useState(false)
  const activeChain = visibleChains.find(c => c.id === destinationChainId) ?? visibleChains[0]

  return (
    <div className="depositoor-dest">
      <button className="depositoor-dest-header" onClick={() => setOpen(o => !o)} type="button">
        <span className="depositoor-dest-label">Destination</span>
        <span className="depositoor-dest-summary">
          <ChainLogo chain={activeChain} size={14} />
          <span className="depositoor-dest-chain">{activeChain.name}</span>
          {destinationAddress && (
            <span className="depositoor-dest-addr">
              {truncateAddress(destinationAddress)}
            </span>
          )}
        </span>
        <svg
          className={`depositoor-dest-chevron ${open ? 'depositoor-dest-chevron--open' : ''}`}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="depositoor-dest-body">
          <div className="depositoor-dest-field">
            <label className="depositoor-dest-field-label">Address</label>
            <input
              className="depositoor-dest-input"
              type="text"
              placeholder="0x..."
              value={destinationAddress}
              onChange={e => onAddressChange(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="depositoor-dest-field">
            <label className="depositoor-dest-field-label">Chain</label>
            <div className="depositoor-chain-selector">
              {visibleChains.map(chain => (
                <button
                  key={chain.id}
                  className={`depositoor-chain-pill ${destinationChainId === chain.id ? 'depositoor-chain-pill--active' : ''}`}
                  onClick={() => onChainChange(chain.id)}
                  style={{ '--depositoor-chain-color': chain.color } as React.CSSProperties}
                  type="button"
                >
                  <ChainLogo chain={chain} size={16} />
                  {chain.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AssetsView sub-component ──

function AssetsView({
  initialChainId,
  visibleChains,
  copiedAddr,
  onCopyAddr,
}: {
  initialChainId?: number
  visibleChains: Chain[]
  copiedAddr: string | null
  onCopyAddr: (addr: string) => void
}) {
  const [selectedChainId, setSelectedChainId] = useState(() => {
    if (initialChainId && visibleChains.some(c => c.id === initialChainId)) {
      return initialChainId
    }
    return visibleChains[0]?.id ?? SUPPORTED_CHAINS[0].id
  })
  const selectedChain = visibleChains.find(c => c.id === selectedChainId) ?? visibleChains[0]
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div className="depositoor-assets">
      <div className="depositoor-assets-chain-dropdown" ref={dropdownRef}>
        <button
          className="depositoor-assets-chain-trigger"
          onClick={() => setDropdownOpen(o => !o)}
          type="button"
        >
          <ChainLogo chain={selectedChain} size={20} />
          <span className="depositoor-assets-chain-label">{selectedChain.name}</span>
          <svg
            className={`depositoor-assets-chain-chevron ${dropdownOpen ? 'depositoor-assets-chain-chevron--open' : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {dropdownOpen && (
          <div className="depositoor-assets-chain-menu">
            {visibleChains.map(chain => (
              <button
                key={chain.id}
                className={`depositoor-assets-chain-option ${chain.id === selectedChainId ? 'depositoor-assets-chain-option--active' : ''}`}
                onClick={() => { setSelectedChainId(chain.id); setDropdownOpen(false) }}
                type="button"
              >
                <ChainLogo chain={chain} size={20} />
                <span>{chain.name}</span>
                {chain.id === selectedChainId && (
                  <svg className="depositoor-assets-chain-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="depositoor-token-list">
        {SUPPORTED_TOKENS.map(token => {
          const addr = token.addresses[selectedChainId]
          if (!addr) return null
          const isCopied = copiedAddr === addr
          return (
            <button
              key={token.symbol}
              className="depositoor-token-row"
              onClick={() => onCopyAddr(addr)}
              type="button"
            >
              <svg className="depositoor-token-icon" width="32" height="32" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="16" fill={token.color} />
                <text
                  x="16"
                  y="17"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize="11"
                  fontWeight="700"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {token.symbol[0]}
                </text>
              </svg>
              <div className="depositoor-token-info">
                <span className="depositoor-token-symbol">{token.symbol}</span>
                <span className="depositoor-token-name">{token.name}</span>
              </div>
              <div className="depositoor-token-addr-group">
                <span className="depositoor-token-addr">{truncateAddress(addr)}</span>
                <span className={`depositoor-token-copy-icon ${isCopied ? 'is-copied' : ''}`}>
                  {isCopied ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main widget ──

export function DepositWidget({
  destinationAddress: initialDestAddress,
  destinationChainId: initialDestChainId,
  chains,
  theme = 'light',
  onStatusChange,
  onComplete,
  onWalletConnect,
  onPeerOnramp,
  className,
}: DepositWidgetProps) {
  const { apiUrl, implementationAddress } = useDepositoor()

  // ── View state ──
  const [view, setView] = useState<View>('methods')
  const [assetsChainId, setAssetsChainId] = useState<number | undefined>()

  // ── Wallet state (in-memory, no localStorage) ──
  const [wallets, setWallets] = useState<StoredWallet[]>([])
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null)

  // ── Destination state (user-editable, seeded from props) ──
  const [destAddress, setDestAddress] = useState(initialDestAddress)
  const [destChainId, setDestChainId] = useState(initialDestChainId)

  // ── Session state ──
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Copy feedback ──
  const [copied, setCopied] = useState(false)
  const [copiedTokenAddr, setCopiedTokenAddr] = useState<string | null>(null)

  // ── Refs ──
  const eventSourceRef = useRef<EventSource | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initRef = useRef(false)

  // ── Derived ──
  const visibleChains = chains
    ? SUPPORTED_CHAINS.filter(c => chains.includes(c.id))
    : SUPPORTED_CHAINS

  const activeWallet = wallets.find(w => w.id === activeWalletId) ?? null

  const themeClass = theme === 'dark' ? 'depositoor-dark' : 'depositoor-light'
  const isCompact = view === 'methods'

  // ── Sync destination props ──
  useEffect(() => {
    setDestAddress(initialDestAddress)
  }, [initialDestAddress])

  useEffect(() => {
    setDestChainId(initialDestChainId)
  }, [initialDestChainId])

  // ── Notify parent of status changes ──
  useEffect(() => {
    if (session?.status) {
      onStatusChange?.(session.status)
    }
  }, [session?.status, onStatusChange])

  // ── SSE cleanup helper ──
  const closeSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  // ── Create wallet helper ──
  const createWallet = useCallback(async (): Promise<StoredWallet> => {
    const privateKey = generatePrivateKey()
    const account = privateKeyToAccount(privateKey)
    const auth = await account.signAuthorization({
      contractAddress: implementationAddress,
      chainId: 0,
      nonce: 0,
    })

    return {
      id: crypto.randomUUID(),
      address: account.address,
      privateKey,
      signedAuth: {
        address: auth.address,
        chainId: auth.chainId,
        nonce: auth.nonce,
        r: auth.r,
        s: auth.s,
        yParity: auth.yParity ?? 0,
      },
    }
  }, [implementationAddress])

  // ── Generate initial wallet on mount ──
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    createWallet()
      .then(w => {
        setWallets([w])
        setActiveWalletId(w.id)
      })
      .catch(e => {
        setError(e instanceof Error ? e.message : 'Failed to create wallet')
      })
  }, [createWallet])

  // ── Register session when user enters crypto view ──
  useEffect(() => {
    if (view !== 'crypto' || !activeWallet || !destAddress || session) return

    let cancelled = false

    async function register() {
      try {
        const sess = await registerSession(
          apiUrl,
          activeWallet!.address,
          activeWallet!.signedAuth,
          destAddress,
          destChainId,
        )

        if (cancelled) return

        setSession(sess)

        const es = connectSSE(
          apiUrl,
          sess.id,
          (status) => {
            setSession(prev => prev ? { ...prev, status } : prev)
          },
          () => {
            // SSE error — session will auto-expire via timer
          },
        )
        eventSourceRef.current = es
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Registration failed')
      }
    }

    register()

    return () => { cancelled = true }
  }, [view, activeWallet, destAddress, destChainId, apiUrl, session])

  // ── Expiry timer ──
  useEffect(() => {
    if (!session?.expiresAt) return
    if (session.status === 'swept' || session.status === 'failed') return

    const msUntilExpiry = session.expiresAt * 1000 - Date.now()
    if (msUntilExpiry <= 0) {
      closeSSE()
      setSession(prev => prev ? { ...prev, status: 'expired' as SessionStatus } : prev)
      return
    }

    timerRef.current = setTimeout(() => {
      closeSSE()
      setSession(prev => prev ? { ...prev, status: 'expired' as SessionStatus } : prev)
    }, msUntilExpiry)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [session, closeSSE])

  // ── Close SSE on terminal states ──
  useEffect(() => {
    if (session?.status === 'swept' || session?.status === 'failed') {
      closeSSE()
    }
  }, [session?.status, closeSSE])

  // ── Fire onComplete ──
  useEffect(() => {
    if (session?.status === 'swept' && session.id) {
      onComplete?.(session.id)
    }
  }, [session?.status, session?.id, onComplete])

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      closeSSE()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [closeSSE])

  // ── Handlers ──

  const handleNewAddress = useCallback(async () => {
    try {
      const w = await createWallet()
      setWallets(prev => [w, ...prev])
      setActiveWalletId(w.id)
      setSession(null)
      closeSSE()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create wallet')
    }
  }, [createWallet, closeSSE])

  const handleSelectWallet = useCallback((id: string) => {
    setActiveWalletId(id)
    setSession(null)
    closeSSE()
    setView('crypto')
  }, [closeSSE])

  const handleDeleteWallet = useCallback((id: string) => {
    if (wallets.length <= 1) return
    setWallets(prev => {
      const updated = prev.filter(w => w.id !== id)
      if (id === activeWalletId && updated.length > 0) {
        setActiveWalletId(updated[0].id)
        setSession(null)
        closeSSE()
      }
      return updated
    })
  }, [wallets.length, activeWalletId, closeSSE])

  const handleDestChainChange = useCallback((chainId: number) => {
    setDestChainId(chainId)
    setSession(null)
    closeSSE()
  }, [closeSSE])

  const handleDestAddressChange = useCallback((address: string) => {
    setDestAddress(address)
    setSession(null)
    closeSSE()
  }, [closeSSE])

  const handleRetry = useCallback(() => {
    setError(null)
    setSession(null)
    closeSSE()
  }, [closeSSE])

  const copyAddress = useCallback(async () => {
    if (!activeWallet) return
    await navigator.clipboard.writeText(activeWallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeWallet])

  const copyTokenAddress = useCallback(async (addr: string) => {
    await navigator.clipboard.writeText(addr)
    setCopiedTokenAddr(addr)
    setTimeout(() => setCopiedTokenAddr(null), 1500)
  }, [])

  // ── Progress / terminal states ──
  const sessionStatus = session?.status ?? 'idle'
  const isTerminal = sessionStatus === 'detected' || sessionStatus === 'sweeping' || sessionStatus === 'swept'
  const isFailed = sessionStatus === 'failed'
  const isExpired = sessionStatus === 'expired'

  // ── Loading state (no wallet yet) ──
  if (!activeWallet) {
    return (
      <div className={`depositoor-widget ${themeClass} ${className ?? ''}`}>
        <div className="depositoor-loading">
          <div className="depositoor-spinner" />
          <span>Generating wallet...</span>
        </div>
      </div>
    )
  }

  // ── Render ──
  return (
    <div className={`depositoor-widget ${themeClass} ${isCompact ? 'depositoor-widget--compact' : ''} ${className ?? ''}`}>
      {/* ── Header ── */}
      <div className="depositoor-header">
        {view === 'methods' ? (
          <span className="depositoor-header-title">Deposit</span>
        ) : view === 'crypto' ? (
          <>
            <button className="depositoor-back-btn" onClick={() => setView('methods')} type="button">
              {backIcon}
            </button>
            <WalletDropdown
              wallets={wallets}
              activeId={activeWalletId!}
              onSelect={handleSelectWallet}
              onDelete={handleDeleteWallet}
              onNewAddress={handleNewAddress}
            />
            <div style={{ width: 40 }} />
          </>
        ) : view === 'assets' ? (
          <>
            <button className="depositoor-back-btn" onClick={() => setView('crypto')} type="button">
              {backIcon}
            </button>
            <span className="depositoor-header-title">Supported Assets</span>
            <div style={{ width: 40 }} />
          </>
        ) : null}
      </div>

      {/* ── Body ── */}
      <div className="depositoor-body">
        {/* ── Error state ── */}
        {error && (
          <div className="depositoor-error">
            <p className="depositoor-error-msg">{error}</p>
            <button className="depositoor-retry-btn" onClick={handleRetry} type="button">
              Try Again
            </button>
          </div>
        )}

        {/* ── Expired state ── */}
        {!error && isExpired && (
          <div className="depositoor-error">
            <p className="depositoor-error-msg">Session expired</p>
            <button className="depositoor-retry-btn" onClick={handleRetry} type="button">
              New Session
            </button>
          </div>
        )}

        {/* ── Failed state ── */}
        {!error && !isExpired && isFailed && (
          <div className="depositoor-error">
            <p className="depositoor-error-msg">Sweep failed</p>
            <button className="depositoor-retry-btn" onClick={handleRetry} type="button">
              Try Again
            </button>
          </div>
        )}

        {/* ── Progress states (detected / sweeping / swept) ── */}
        {!error && !isExpired && !isFailed && isTerminal && (
          <div className="depositoor-progress">
            <div className="depositoor-steps">
              <div className={`depositoor-step ${sessionStatus === 'detected' || sessionStatus === 'sweeping' || sessionStatus === 'swept' ? 'done' : ''}`}>
                <div className="depositoor-step-dot" />
                <span>Deposit detected</span>
              </div>
              <div className={`depositoor-step ${sessionStatus === 'sweeping' || sessionStatus === 'swept' ? 'done' : sessionStatus === 'detected' ? 'active' : ''}`}>
                <div className="depositoor-step-dot" />
                <span>{sessionStatus === 'sweeping' || sessionStatus === 'swept' ? 'Converted to USDC' : 'Converting to USDC...'}</span>
              </div>
              <div className={`depositoor-step ${sessionStatus === 'swept' ? 'done' : sessionStatus === 'sweeping' ? 'active' : ''}`}>
                <div className="depositoor-step-dot" />
                <span>{sessionStatus === 'swept' ? 'Bridged to destination' : sessionStatus === 'sweeping' ? 'Bridging to destination...' : 'Bridging to destination'}</span>
              </div>
              <div className={`depositoor-step ${sessionStatus === 'swept' ? 'done' : ''}`}>
                <div className="depositoor-step-dot" />
                <span>{sessionStatus === 'swept' ? 'Complete!' : 'Complete'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Normal view content ── */}
        {!error && !isExpired && !isFailed && !isTerminal && (
          <>
            {/* ── Methods view ── */}
            {view === 'methods' && (
              <div className="depositoor-methods">
                <button className="depositoor-method" onClick={() => setView('crypto')} type="button">
                  <div className="depositoor-method-icon depositoor-method-icon--default">
                    {qrCodeIcon}
                  </div>
                  <div className="depositoor-method-text">
                    <span className="depositoor-method-title">Send Crypto</span>
                    <span className="depositoor-method-subtitle">Send from any wallet or exchange</span>
                  </div>
                  <div className="depositoor-method-chains">
                    {visibleChains.map(chain => (
                      <span key={chain.id}>
                        <ChainLogo chain={chain} size={15} />
                      </span>
                    ))}
                  </div>
                </button>

                <button
                  className="depositoor-method depositoor-method--disabled"
                  onClick={() => onWalletConnect?.()}
                  type="button"
                  disabled={!onWalletConnect}
                >
                  <div className="depositoor-method-icon depositoor-method-icon--default">
                    {walletIcon}
                  </div>
                  <div className="depositoor-method-text">
                    <span className="depositoor-method-title">Pay from Wallet</span>
                    <span className="depositoor-method-subtitle">Connect and send any token</span>
                  </div>
                  {onWalletConnect ? (
                    <div className="depositoor-method-chains">
                      {visibleChains.map(chain => (
                        <span key={chain.id}>
                          <ChainLogo chain={chain} size={15} />
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="depositoor-method-badge">Soon</span>
                  )}
                </button>

                <button
                  className="depositoor-method"
                  onClick={() => onPeerOnramp?.()}
                  type="button"
                >
                  <div className="depositoor-method-icon depositoor-method-icon--peer">
                    {dollarIcon}
                  </div>
                  <div className="depositoor-method-text">
                    <span className="depositoor-method-title">Pay by Cash</span>
                    <span className="depositoor-method-subtitle">Deposit via Revolut, Venmo & more</span>
                  </div>
                  <div className="depositoor-method-chains">
                    {PEER_METHODS.map(method => (
                      <PeerMethodLogo key={method.name} method={method} size={15} />
                    ))}
                  </div>
                </button>
              </div>
            )}

            {/* ── Crypto view (QR) ── */}
            {view === 'crypto' && (
              <div className="depositoor-qr-content">
                <p className="depositoor-qr-title">Deposit Address</p>

                <div className="depositoor-qr-frame">
                  <Cuer
                    value={activeWallet.address}
                    size={180}
                    color={theme === 'dark' ? '#ffffff' : '#000000'}
                  />
                </div>

                <div className="depositoor-qr-details">
                  <button className="depositoor-detail" onClick={copyAddress} type="button">
                    <div className="depositoor-detail-text">
                      <span className="depositoor-detail-label">Deposit Address</span>
                      <span className="depositoor-detail-value depositoor-addr">
                        {activeWallet.address}
                      </span>
                    </div>
                    <span className={`depositoor-detail-action ${copied ? 'is-copied' : ''}`}>
                      {copied ? checkIcon : copyIcon}
                    </span>
                  </button>

                  <button
                    className="depositoor-detail depositoor-accepted-row"
                    onClick={() => { setAssetsChainId(undefined); setView('assets') }}
                    type="button"
                  >
                    <div className="depositoor-detail-text">
                      <span className="depositoor-detail-label">Accepted</span>
                      <span className="depositoor-detail-value">
                        Any ERC-20 on
                        <span className="depositoor-accepted-chains">
                          {visibleChains.map(chain => (
                            <span
                              key={chain.id}
                              className="depositoor-chain-btn"
                              role="button"
                              tabIndex={0}
                              title={chain.name}
                              onClick={(e) => {
                                e.stopPropagation()
                                setAssetsChainId(chain.id)
                                setView('assets')
                              }}
                            >
                              <ChainLogo chain={chain} size={15} />
                            </span>
                          ))}
                        </span>
                      </span>
                    </div>
                    {chevronRight}
                  </button>
                </div>

                <div className="depositoor-status-row">
                  <span className="depositoor-pulse" />
                  <span>
                    {sessionStatus === 'registering' ? 'Registering...' :
                     sessionStatus === 'pending' ? 'Listening for deposits...' :
                     'Setting up...'}
                  </span>
                </div>
              </div>
            )}

            {/* ── Assets view ── */}
            {view === 'assets' && (
              <AssetsView
                initialChainId={assetsChainId}
                visibleChains={visibleChains}
                copiedAddr={copiedTokenAddr}
                onCopyAddr={copyTokenAddress}
              />
            )}
          </>
        )}
      </div>

      {/* ── Destination Panel ── */}
      <DestinationPanel
        destinationChainId={destChainId}
        destinationAddress={destAddress}
        visibleChains={visibleChains}
        onChainChange={handleDestChainChange}
        onAddressChange={handleDestAddressChange}
      />
    </div>
  )
}

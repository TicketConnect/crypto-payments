import { useState } from 'react'
import type { StoredWallet } from '../App'
import './WalletDropdown.css'

type Props = {
  wallets: StoredWallet[]
  activeId: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNewAddress: () => void
}

function truncate(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function WalletDropdown({ wallets, activeId, onSelect, onDelete, onNewAddress }: Props) {
  const [open, setOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const active = wallets.find(w => w.id === activeId)

  if (!active) return null

  return (
    <div className="dropdown">
      <button className="dropdown-trigger" onClick={() => setOpen(!open)}>
        <span className="dropdown-dot" style={{ background: active.chainColor }} />
        <span className="dropdown-chain">{active.chainName}</span>
        <span className="dropdown-addr">{truncate(active.address)}</span>
        <svg className={`dropdown-chevron ${open ? 'open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
          <div className="dropdown-menu">
            {wallets.map(w => (
              <div
                key={w.id}
                className={`dropdown-item ${w.id === activeId ? 'active' : ''}`}
                onClick={() => { onSelect(w.id); setOpen(false) }}
              >
                <span className="dropdown-dot" style={{ background: w.chainColor }} />
                <div className="dropdown-item-info">
                  <span className="dropdown-item-addr">{truncate(w.address)}</span>
                  <span className="dropdown-item-chain">{w.chainName}</span>
                </div>
                {wallets.length > 1 && (
                  <button
                    className="dropdown-item-delete"
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(w.id) }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            <div className="dropdown-divider" />
            <button
              className="dropdown-new"
              onClick={() => { onNewAddress(); setOpen(false) }}
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
            <div className="confirm-backdrop" onClick={() => setConfirmDeleteId(null)} />
            <div className="confirm-dialog">
              <p className="confirm-title">Delete wallet?</p>
              <p className="confirm-addr">{truncate(w.address)}</p>
              <p className="confirm-warning">Private key will be lost. Make sure you've saved it if there are funds on this address.</p>
              <div className="confirm-actions">
                <button className="confirm-cancel" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                <button className="confirm-delete" onClick={() => { onDelete(confirmDeleteId); setConfirmDeleteId(null) }}>Delete</button>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}

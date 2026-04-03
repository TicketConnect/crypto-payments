import { useState } from 'react'
import type React from 'react'
import { SUPPORTED_CHAINS } from '../lib/constants'
import { ChainLogo } from './ChainLogo'
import './DestinationPanel.css'

type Props = {
  destinationChainId: number
  destinationAddress: string
  onChainChange: (chainId: number) => void
  onAddressChange: (address: string) => void
}

const availableChains = SUPPORTED_CHAINS.filter(c => !c.comingSoon)

export function DestinationPanel({ destinationChainId, destinationAddress, onChainChange, onAddressChange }: Props) {
  const [open, setOpen] = useState(true)
  const activeChain = availableChains.find(c => c.id === destinationChainId) ?? availableChains[0]

  return (
    <div className="dest-panel">
      <button className="dest-header" onClick={() => setOpen(o => !o)} type="button">
        <span className="dest-header-label">Destination</span>
        <span className="dest-header-summary">
          <ChainLogo chain={activeChain} size={14} />
          <span className="dest-header-chain">{activeChain.name}</span>
          {destinationAddress && (
            <span className="dest-header-addr">
              {destinationAddress.slice(0, 6)}...{destinationAddress.slice(-4)}
            </span>
          )}
        </span>
        <svg
          className={`dest-chevron ${open ? 'dest-chevron--open' : ''}`}
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
        <div className="dest-body">
          <div className="dest-field">
            <label className="dest-label">Address</label>
            <input
              className="dest-input"
              type="text"
              placeholder="0x..."
              value={destinationAddress}
              onChange={e => onAddressChange(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>

          <div className="dest-field">
            <label className="dest-label">Chain</label>
            <div className="chain-selector">
              {availableChains.map(chain => (
                <button
                  key={chain.id}
                  className={`chain-pill ${destinationChainId === chain.id ? 'active' : ''}`}
                  onClick={() => onChainChange(chain.id)}
                  style={{ '--chain-color': chain.color } as React.CSSProperties}
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

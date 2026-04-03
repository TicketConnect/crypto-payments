import { useState } from 'react'
import type { Chain, StoredWallet } from '../App'
import './Settings.css'

type Props = {
  wallet: StoredWallet
  chains: Chain[]
  onSave: (destinationAddress: string, chain: Chain) => void
}

export function Settings({ wallet, chains, onSave }: Props) {
  const [address, setAddress] = useState(wallet.destinationAddress)
  const [selectedChain, setSelectedChain] = useState<Chain>(
    chains.find(c => c.id === wallet.chainId) ?? chains[0]
  )

  return (
    <div className="settings">
      <h2 className="settings-title">Settings</h2>

      <div className="settings-field">
        <label>Destination Address</label>
        <input
          type="text"
          placeholder="0x..."
          value={address}
          onChange={e => setAddress(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
      </div>

      <div className="settings-field">
        <label>Destination Chain</label>
        <div className="chain-selector">
          {chains.map(chain => (
            <button
              key={chain.id}
              className={`chain-pill ${selectedChain.id === chain.id ? 'active' : ''}`}
              onClick={() => setSelectedChain(chain)}
              style={{ '--chain-color': chain.color } as React.CSSProperties}
            >
              <span className="chain-dot" />
              {chain.name}
            </button>
          ))}
        </div>
      </div>

      <div className="settings-field">
        <label>Destination Token</label>
        <div className="token-display">
          <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#2775CA" />
            <path
              d="M20.5 18.5c0-2.1-1.3-2.8-3.8-3.1-.5-.1-1.1-.2-1.5-.4-.7-.3-1-.7-1-1.3s.5-1.1 1.4-1.3c.9-.1 1.7.1 2.5.6.2.1.3.1.4 0l.5-.7c.1-.2.1-.3 0-.4-.8-.5-1.8-.8-2.7-.9v-1.4c0-.2-.1-.3-.3-.3h-.8c-.2 0-.3.1-.3.3V11c-1.8.2-2.9 1.3-2.9 2.7 0 2 1.3 2.7 3.8 3 .5.1 1 .2 1.4.4.7.3 1 .8 1 1.4s-.7 1.3-1.7 1.4c-1 .1-2-.2-2.9-.7-.2-.1-.3-.1-.4 0l-.5.7c-.1.2-.1.3 0 .4.9.6 2.1.9 3.2 1v1.5c0 .2.1.3.3.3h.8c.2 0 .3-.1.3-.3v-1.5c1.8-.3 3-1.4 3-2.9z"
              fill="white"
            />
          </svg>
          <span>USDC</span>
        </div>
      </div>

      <button
        className="save-btn"
        onClick={() => onSave(address, selectedChain)}
      >
        Save
      </button>
    </div>
  )
}

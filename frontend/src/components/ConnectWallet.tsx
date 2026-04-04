import { useState } from 'react'
import { useWallet } from './WalletProvider'
import type { WalletProviderDetail, Ecosystem } from '../lib/wallets'
import './ConnectWallet.css'

function WalletOption({ detail, connect }: {
  detail: WalletProviderDetail
  connect: (detail: WalletProviderDetail, ecosystem?: Ecosystem) => Promise<void>
}) {
  const [expanded, setExpanded] = useState(false)
  const isMultiChain = detail.ecosystems.length > 1

  function handleClick() {
    if (isMultiChain) {
      setExpanded(!expanded)
    } else {
      connect(detail, detail.ecosystems[0])
    }
  }

  return (
    <div className="wallet-option-wrapper">
      <button className="wallet-option" onClick={handleClick}>
        <img
          src={detail.info.icon}
          alt={detail.info.name}
          className="wallet-option-icon"
        />
        <span className="wallet-option-name">{detail.info.name}</span>
        {isMultiChain && (
          <span className="wallet-option-multi">
            {expanded ? '▾' : '›'}
          </span>
        )}
      </button>
      {expanded && isMultiChain && (
        <div className="wallet-ecosystem-choice">
          {detail.ecosystems.map((eco) => (
            <button
              key={eco}
              className="wallet-ecosystem-btn"
              onClick={() => connect(detail, eco)}
            >
              {eco === 'evm' ? 'EVM' : 'Solana'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ConnectWallet() {
  const { providers, connect } = useWallet()

  const webWallets = providers.filter((p) =>
    p.source !== 'eip6963' && p.source !== 'wallet-standard'
  )
  const extensionWallets = providers.filter((p) =>
    p.source === 'eip6963' || p.source === 'wallet-standard'
  )

  return (
    <div className="connect-wallet">
      {webWallets.length > 0 && (
        <div className="connect-wallet-section">
          <div className="connect-wallet-label">Web wallets</div>
          <div className="connect-wallet-list">
            {webWallets.map((detail) => (
              <WalletOption key={detail.info.uuid} detail={detail} connect={connect} />
            ))}
          </div>
        </div>
      )}
      {extensionWallets.length > 0 && (
        <div className="connect-wallet-section">
          <div className="connect-wallet-label">Extension wallets</div>
          <div className="connect-wallet-list">
            {extensionWallets.map((detail) => (
              <WalletOption key={detail.info.uuid} detail={detail} connect={connect} />
            ))}
          </div>
        </div>
      )}
      {providers.length === 0 && (
        <div className="connect-wallet-empty">
          No wallets detected.
        </div>
      )}
    </div>
  )
}

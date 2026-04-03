import { useWallet } from './WalletProvider'
import './ConnectWallet.css'

export function ConnectWallet() {
  const { providers, connect } = useWallet()

  return (
    <div className="connect-wallet">
      <div className="connect-wallet-label">Connect a wallet</div>
      {providers.length === 0 && (
        <div className="connect-wallet-empty">
          No wallets detected. Install a browser wallet extension to continue.
        </div>
      )}
      <div className="connect-wallet-list">
        {providers.map((detail) => (
          <button
            key={detail.info.uuid}
            className="wallet-option"
            onClick={() => connect(detail)}
          >
            <img
              src={detail.info.icon}
              alt={detail.info.name}
              className="wallet-option-icon"
            />
            <span className="wallet-option-name">{detail.info.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

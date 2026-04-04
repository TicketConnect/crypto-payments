import { SUPPORTED_CHAINS } from '../lib/constants'
import { ChainLogo } from './ChainLogo'
import { PeerOnrampButton } from './PeerOnrampButton'
import './DepositMethods.css'

type Props = {
  onSelectCrypto: () => void
  onSelectWallet: () => void
  onPeerStarted?: () => void
  onNeedsInstall?: () => void
  destinationChainId: number
  destinationAddress?: string
}

export function DepositMethods({ onSelectCrypto, onSelectWallet, onPeerStarted, onNeedsInstall, destinationChainId, destinationAddress }: Props) {
  return (
    <div className="deposit-methods">
      <button className="method-row" onClick={onSelectCrypto} type="button">
        <div className="method-icon method-icon--default">
          <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            {/* top-left finder */}
            <rect x="0.5" y="0.5" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <rect x="2.25" y="2.25" width="2.5" height="2.5" rx="0.5" />
            {/* top-right finder */}
            <rect x="9.5" y="0.5" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <rect x="11.25" y="2.25" width="2.5" height="2.5" rx="0.5" />
            {/* bottom-left finder */}
            <rect x="0.5" y="9.5" width="6" height="6" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <rect x="2.25" y="11.25" width="2.5" height="2.5" rx="0.5" />
            {/* data dots - sparse 4x4 grid */}
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
        </div>
        <div className="method-text">
          <span className="method-title">Send Crypto</span>
          <span className="method-subtitle">Send from any wallet or exchange</span>
        </div>
        <div className="method-chains">
          {SUPPORTED_CHAINS.map(chain => (
            <span key={chain.id} className={chain.comingSoon ? 'chain-coming-soon' : undefined}>
              <ChainLogo chain={chain} size={15} />
            </span>
          ))}
        </div>
      </button>

      <button className="method-row" onClick={onSelectWallet} type="button">
        <div className="method-icon method-icon--default">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
            <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
            <path d="M18 12a2 2 0 0 0 0 4h4v-4h-4z" />
          </svg>
        </div>
        <div className="method-text">
          <span className="method-title">Pay from Wallet</span>
          <span className="method-subtitle">Connect and send any token</span>
        </div>
        <div className="method-chains">
          {SUPPORTED_CHAINS.filter(c => !c.comingSoon).map(chain => (
            <span key={chain.id}>
              <ChainLogo chain={chain} size={15} />
            </span>
          ))}
        </div>
      </button>

      <PeerOnrampButton
        destinationChainId={destinationChainId}
        destinationAddress={destinationAddress}
        onPeerStarted={onPeerStarted}
        onNeedsInstall={onNeedsInstall}
      />
    </div>
  )
}

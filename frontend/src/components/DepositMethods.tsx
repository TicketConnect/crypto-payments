import { SUPPORTED_CHAINS } from '../lib/constants'
import { ChainLogo } from './ChainLogo'
import { PeerOnrampButton } from './PeerOnrampButton'
import './DepositMethods.css'

type Props = {
  onSelectCrypto: () => void
  onSelectWallet: () => void
  onPeerStarted?: () => void
  destinationChainId: number
  destinationAddress?: string
}

export function DepositMethods({ onSelectCrypto, onSelectWallet, onPeerStarted, destinationChainId, destinationAddress }: Props) {
  return (
    <div className="deposit-methods">
      <button className="method-row" onClick={onSelectCrypto} type="button">
        <div className="method-icon method-icon--active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div className="method-text">
          <span className="method-title">Transfer Crypto</span>
          <span className="method-subtitle">No limit · Instant</span>
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
        <div className="method-icon method-icon--active">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="6" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
            <path d="M16 14h2" />
          </svg>
        </div>
        <div className="method-text">
          <span className="method-title">Connect Wallet</span>
          <span className="method-subtitle">Swap & bridge from your wallet</span>
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
      />
    </div>
  )
}

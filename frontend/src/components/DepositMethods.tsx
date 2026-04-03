import { SUPPORTED_CHAINS } from '../lib/constants'
import { ChainLogo } from './ChainLogo'
import './DepositMethods.css'

type Props = {
  onSelectCrypto: () => void
}

export function DepositMethods({ onSelectCrypto }: Props) {
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

      <div className="method-row method-row--disabled">
        <div className="method-icon method-icon--muted">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <div className="method-text">
          <span className="method-title">Peer-to-peer</span>
          <span className="method-subtitle">Revolut, Venmo & more</span>
        </div>
        <span className="method-badge">Coming soon</span>
      </div>
    </div>
  )
}

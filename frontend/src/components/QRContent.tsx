import { useState } from 'react'
import { Cuer } from 'cuer'
import type { StoredWallet } from '../App'
import type { Session } from '../hooks/useSession'
import { SUPPORTED_CHAINS } from '../lib/constants'
import { ChainLogo } from './ChainLogo'
import './QRContent.css'

type Props = {
  wallet: StoredWallet
  session: Session | null
  onShowAssets: (chainId?: number) => void
}

export function QRContent({ wallet, session, onShowAssets }: Props) {
  const [copied, setCopied] = useState(false)

  const truncated = wallet.address

  const copyAddress = async () => {
    await navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="qr-content">
      <p className="qr-title">Deposit Address</p>

      <div className="qr-frame">
        <Cuer value={wallet.address} size={180} color="#ffffff" />
      </div>

      <div className="qr-details">
        <button className="detail" onClick={copyAddress} type="button">
          <div className="detail-text">
            <span className="detail-label">Deposit Address</span>
            <span className="detail-value addr">{truncated}</span>
          </div>
          <span className={`detail-action ${copied ? 'is-copied' : ''}`}>
            {copied ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </span>
        </button>

        <button
          className="detail accepted-row"
          onClick={() => onShowAssets()}
          type="button"
        >
          <div className="detail-text">
            <span className="detail-label">Accepted</span>
            <span className="detail-value">
              Any ERC-20 on
              <span className="accepted-chains">
                {SUPPORTED_CHAINS.map(chain => (
                  <span
                    key={chain.id}
                    className={`chain-icon-btn ${chain.comingSoon ? 'coming-soon' : ''}`}
                    role="button"
                    tabIndex={chain.comingSoon ? -1 : 0}
                    title={chain.comingSoon ? `${chain.name} (coming soon)` : chain.name}
                    onClick={(e) => {
                      if (chain.comingSoon) return
                      e.stopPropagation()
                      onShowAssets(chain.id)
                    }}
                  >
                    <ChainLogo chain={chain} size={15} />
                  </span>
                ))}
              </span>
            </span>
          </div>
          <svg className="accepted-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      <div className="qr-status">
        <span className="status-pulse" />
        <span>
          {session?.status === 'detected' ? 'Deposit detected!' :
           session?.status === 'sweeping' ? 'Sweeping funds...' :
           session?.status === 'swept' ? 'Funds swept successfully' :
           session?.status === 'failed' ? 'Sweep failed' :
           session?.status === 'registering' ? 'Registering...' :
           'Listening for deposits...'}
        </span>
      </div>
    </div>
  )
}

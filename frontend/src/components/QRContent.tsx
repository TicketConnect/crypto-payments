import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import type { StoredWallet } from '../App'
import './QRContent.css'

type Props = {
  wallet: StoredWallet
}

export function QRContent({ wallet }: Props) {
  const [copied, setCopied] = useState(false)

  const truncated = `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}`

  const copyAddress = async () => {
    await navigator.clipboard.writeText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="qr-content">
      <p className="qr-title">
        Deposit on <span style={{ color: wallet.chainColor }}>{wallet.chainName}</span>
      </p>

      <div className="qr-frame">
        <div className="qr-glow" style={{ '--glow-color': wallet.chainColor } as React.CSSProperties} />
        <QRCodeSVG
          value={wallet.address}
          size={260}
          bgColor="transparent"
          fgColor="#ffffff"
          level="H"
          includeMargin={false}
        />
        <div className="qr-badge">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <circle cx="18" cy="18" r="18" fill="#2775CA" />
            <path
              d="M23 20.8c0-2.3-1.4-3-4.1-3.4-.6-.1-1.2-.2-1.6-.5-.7-.3-1-.7-1-1.4 0-.6.5-1.2 1.5-1.3 1-.1 1.8.1 2.6.6.2.1.3.1.4 0l.5-.8c.1-.2.1-.3 0-.4-.9-.6-1.9-.8-2.8-.9v-1.5c0-.2-.1-.3-.3-.3h-.9c-.2 0-.3.1-.3.3v1.5c-1.9.2-3.1 1.4-3.1 3 0 2.1 1.4 2.9 4.1 3.2.6.1 1.1.2 1.5.5.7.3 1 .8 1 1.5 0 .9-.7 1.5-1.8 1.6-1.1.1-2.2-.2-3.1-.8-.2-.1-.3-.1-.4 0l-.5.8c-.1.2-.1.3 0 .4 1 .7 2.2 1 3.4 1.1v1.6c0 .2.1.3.3.3h.9c.2 0 .3-.1.3-.3v-1.6c2-.3 3.3-1.5 3.3-3.2z"
              fill="white"
            />
          </svg>
        </div>
      </div>

      <div className="qr-details">
        <button className="detail" onClick={copyAddress} type="button">
          <div className="detail-text">
            <span className="detail-label">Deposit Address</span>
            <span className="detail-value mono">{truncated}</span>
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

        <div className="detail">
          <div className="detail-text">
            <span className="detail-label">Accepted</span>
            <span className="detail-value">Any ERC20 on {wallet.chainName}</span>
          </div>
        </div>
      </div>

      <div className="qr-status">
        <span className="status-pulse" />
        <span>Listening for deposits...</span>
      </div>
    </div>
  )
}

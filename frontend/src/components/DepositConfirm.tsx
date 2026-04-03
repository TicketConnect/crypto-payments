import type { QuoteResponse } from '../lib/quote'
import './DepositConfirm.css'

interface DepositConfirmProps {
  quote: QuoteResponse
  onConfirm: () => void
  onCancel: () => void
  signing: boolean
}

export function DepositConfirm({ quote, onConfirm, onCancel, signing }: DepositConfirmProps) {
  const { preview } = quote
  const expiresIn = Math.max(0, Math.floor((quote.expires_at * 1000 - Date.now()) / 1000))

  return (
    <div className="deposit-confirm">
      <div className="deposit-confirm-label">Confirm deposit</div>

      <div className="deposit-confirm-summary">
        <div className="confirm-row">
          <span className="confirm-row-label">You send</span>
          <span className="confirm-row-value">
            {preview.input.amount} {preview.input.symbol}
          </span>
        </div>
        <div className="confirm-arrow">&darr;</div>
        <div className="confirm-row">
          <span className="confirm-row-label">You receive</span>
          <span className="confirm-row-value confirm-row-value--accent">
            {preview.output.amount} {preview.output.symbol}
          </span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row-label">Destination</span>
          <span className="confirm-row-value">{preview.output.dest_chain}</span>
        </div>
        <div className="confirm-row">
          <span className="confirm-row-label">Fee</span>
          <span className="confirm-row-value">
            ${preview.fee_usd.toFixed(2)}
          </span>
        </div>
      </div>

      {expiresIn < 30 && (
        <div className="confirm-expiry">Quote expires in {expiresIn}s</div>
      )}

      <div className="deposit-confirm-actions">
        <button className="confirm-btn confirm-btn--cancel" onClick={onCancel} disabled={signing}>
          Cancel
        </button>
        <button className="confirm-btn confirm-btn--confirm" onClick={onConfirm} disabled={signing}>
          {signing ? 'Waiting for wallet...' : 'Confirm & Sign'}
        </button>
      </div>
    </div>
  )
}

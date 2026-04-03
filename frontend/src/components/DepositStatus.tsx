import { useEffect, useState } from 'react'
import { API_URL } from '../lib/constants'
import './DepositStatus.css'

type Status = 'pending' | 'confirmed' | 'bridging' | 'complete' | 'failed'

interface DepositStatusProps {
  txHash: string
  sessionId: string
  onDone: () => void
}

const STATUS_LABELS: Record<Status, string> = {
  pending: 'Waiting for confirmation...',
  confirmed: 'Transaction confirmed',
  bridging: 'Bridging USDC to destination...',
  complete: 'Deposit complete!',
  failed: 'Deposit failed',
}

const STATUS_ORDER: Status[] = ['pending', 'confirmed', 'bridging', 'complete']

export function DepositStatus({ txHash, sessionId, onDone }: DepositStatusProps) {
  const [status, setStatus] = useState<Status>('pending')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const eventSource = new EventSource(`${API_URL}/sessions/${sessionId}/events`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      if (data.status) setStatus(data.status as Status)
      if (data.error) setError(data.error)
    }

    eventSource.onerror = () => {
      // Fall back to polling if SSE fails
      eventSource.close()
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/sessions/${sessionId}`)
          const data = await res.json()
          if (data.status) setStatus(data.status as Status)
          if (data.status === 'complete' || data.status === 'failed') {
            clearInterval(interval)
          }
        } catch {
          // Silently retry
        }
      }, 3000)
      return () => clearInterval(interval)
    }

    return () => eventSource.close()
  }, [sessionId])

  const currentIdx = STATUS_ORDER.indexOf(status)

  return (
    <div className="deposit-status">
      <div className="deposit-status-label">Deposit progress</div>

      <div className="status-steps">
        {STATUS_ORDER.map((step, i) => (
          <div
            key={step}
            className={
              'status-step' +
              (i < currentIdx ? ' done' : '') +
              (i === currentIdx ? ' active' : '') +
              (status === 'failed' && i === currentIdx ? ' failed' : '')
            }
          >
            <div className="status-step-dot" />
            <span className="status-step-label">{STATUS_LABELS[step]}</span>
          </div>
        ))}
      </div>

      {error && <div className="status-error">{error}</div>}

      <div className="status-tx">
        <span className="status-tx-label">Transaction</span>
        <span className="status-tx-hash">{txHash.slice(0, 10)}...{txHash.slice(-8)}</span>
      </div>

      {(status === 'complete' || status === 'failed') && (
        <button className="status-done-btn" onClick={onDone}>
          {status === 'complete' ? 'New Deposit' : 'Try Again'}
        </button>
      )}
    </div>
  )
}

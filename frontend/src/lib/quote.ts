import { API_URL } from './constants'

export interface QuoteRequest {
  wallet: string
  src_chain_id: number
  token: string
  amount: string
  dest_chain_id: number
}

export interface QuotePreview {
  input: { symbol: string; amount: string; value_usd: number }
  output: { symbol: string; amount: string; dest_chain: string }
  fee_usd: number
}

export interface QuoteResponse {
  quote_id: string
  tx: { to: string; data: string; value: string; gas: string }
  preview: QuotePreview
  expires_at: number
}

export async function fetchQuote(req: QuoteRequest): Promise<QuoteResponse> {
  const res = await fetch(`${API_URL}/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Quote error: ${res.status} — ${body}`)
  }

  return res.json()
}

export async function submitSession(quoteId: string, txHash: string): Promise<void> {
  const res = await fetch(`${API_URL}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quote_id: quoteId, tx_hash: txHash }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Session error: ${res.status} — ${body}`)
  }
}

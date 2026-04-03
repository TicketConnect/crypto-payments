import { useEffect, useState } from 'react'
import { fetchBalances, type TokenBalance } from '../lib/dune'
import { SUPPORTED_CHAINS } from '../lib/constants'
import { ChainLogo } from './ChainLogo'
import './TokenList.css'

interface TokenListProps {
  walletAddress: string
  onSelect: (token: TokenBalance) => void
}

export function TokenList({ walletAddress, onSelect }: TokenListProps) {
  const [balances, setBalances] = useState<TokenBalance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchBalances(walletAddress)
      .then((b) => {
        if (!cancelled) setBalances(b)
      })
      .catch((e) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [walletAddress])

  if (loading) {
    return <div className="token-list-status">Loading balances...</div>
  }

  if (error) {
    return <div className="token-list-status token-list-error">{error}</div>
  }

  if (balances.length === 0) {
    return <div className="token-list-status">No tokens found on supported chains.</div>
  }

  const priced = balances.filter((b) => b.value_usd >= 0.01)
  const unpriced = balances.filter((b) => b.value_usd < 0.01)
  const visible = showAll ? balances : priced

  return (
    <div className="token-list">
      {visible.map((token) => {
        const chain = SUPPORTED_CHAINS.find((c) => c.id === token.chain_id)
        return (
          <button
            key={`${token.chain_id}-${token.address}`}
            className="token-row"
            onClick={() => onSelect(token)}
          >
            <div className="token-row-left">
              {token.token_metadata?.logo ? (
                <img src={token.token_metadata.logo} alt={token.symbol} className="token-logo" />
              ) : (
                <div className="token-logo token-logo-fallback">
                  {token.symbol.charAt(0)}
                </div>
              )}
              <div className="token-info">
                <span className="token-symbol">{token.symbol}</span>
                {chain && (
                  <span className="token-chain">
                    <ChainLogo chain={chain} size={12} />
                    {chain.name}
                  </span>
                )}
              </div>
            </div>
            <div className="token-row-right">
              <span className="token-balance">
                {formatBalance(token.amount, token.decimals)}
              </span>
              {token.value_usd >= 0.01 && (
                <span className="token-value">
                  ${token.value_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              )}
            </div>
          </button>
        )
      })}
      {unpriced.length > 0 && (
        <button className="token-list-show-more" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show less' : `Show ${unpriced.length} more`}
        </button>
      )}
    </div>
  )
}

function formatBalance(amount: string, decimals: number): string {
  const num = Number(amount) / 10 ** decimals
  if (num >= 1000) return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
  if (num >= 1) return num.toLocaleString(undefined, { maximumFractionDigits: 4 })
  return num.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

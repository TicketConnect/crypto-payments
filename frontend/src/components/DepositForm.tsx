import { useState } from 'react'
import { SUPPORTED_CHAINS } from '../lib/constants'
import { ChainLogo } from './ChainLogo'
import type { TokenBalance } from '../lib/dune'
import './DepositForm.css'

interface DepositFormProps {
  token: TokenBalance
  onSubmit: (amount: string, destChainId: number) => void
  onBack: () => void
}

export function DepositForm({ token, onSubmit, onBack }: DepositFormProps) {
  const [amount, setAmount] = useState('')
  const [destChainId, setDestChainId] = useState(8453) // Default Base

  const maxBalance = Number(token.amount) / 10 ** token.decimals
  const numAmount = Number(amount)
  const isValid = numAmount > 0 && numAmount <= maxBalance

  // Filter to CCTP-supported destination chains (have cctpDomain defined)
  const destChains = SUPPORTED_CHAINS.filter((c) => c.cctpDomain !== undefined && !c.comingSoon)

  return (
    <div className="deposit-form">
      <button className="deposit-form-back" onClick={onBack}>
        &larr; Back
      </button>

      <div className="deposit-form-token">
        {token.token_metadata?.logo ? (
          <img src={token.token_metadata.logo} alt={token.symbol} className="deposit-form-token-logo" />
        ) : (
          <div className="deposit-form-token-logo deposit-form-token-fallback">
            {token.symbol.charAt(0)}
          </div>
        )}
        <span className="deposit-form-token-symbol">{token.symbol}</span>
        <span className="deposit-form-token-chain">
          on {SUPPORTED_CHAINS.find((c) => c.id === token.chain_id)?.name}
        </span>
      </div>

      <div className="deposit-form-field">
        <label className="deposit-form-label">Amount</label>
        <div className="deposit-form-input-wrap">
          <input
            type="number"
            className="deposit-form-input"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button className="deposit-form-max" onClick={() => setAmount(String(maxBalance))}>
            MAX
          </button>
        </div>
        <div className="deposit-form-hint">
          Balance: {maxBalance.toLocaleString(undefined, { maximumFractionDigits: 6 })} {token.symbol}
        </div>
      </div>

      <div className="deposit-form-field">
        <label className="deposit-form-label">Destination chain</label>
        <div className="deposit-form-chains">
          {destChains.map((chain) => (
            <button
              key={chain.id}
              className={'chain-pill' + (chain.id === destChainId ? ' active' : '')}
              style={{ '--chain-color': chain.color } as React.CSSProperties}
              onClick={() => setDestChainId(chain.id)}
            >
              <ChainLogo chain={chain} size={18} />
              {chain.name}
            </button>
          ))}
        </div>
      </div>

      <button
        className="deposit-form-submit"
        disabled={!isValid}
        onClick={() => onSubmit(amount, destChainId)}
      >
        {isValid
          ? `Deposit ${amount} ${token.symbol}`
          : numAmount > maxBalance
            ? 'Insufficient balance'
            : 'Enter amount'}
      </button>
    </div>
  )
}

import { useState, useEffect, useRef, useCallback } from 'react'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { Cuer } from 'cuer'
import { useDepositoor } from './hooks/useDepositoor'
import { registerSession, connectSSE } from './api'
import { SUPPORTED_CHAINS } from './constants'
import type { SessionStatus, Session, SignedAuth, DepositWidgetProps } from './types'

type WidgetState =
  | 'idle'
  | 'registering'
  | 'pending'
  | 'detected'
  | 'sweeping'
  | 'swept'
  | 'failed'
  | 'expired'

export function DepositWidget({
  destinationAddress,
  destinationChainId,
  chains,
  theme = 'light',
  onStatusChange,
  onComplete,
  className,
}: DepositWidgetProps) {
  const { apiUrl, implementationAddress } = useDepositoor()

  const [state, setState] = useState<WidgetState>('idle')
  const [burnerAddress, setBurnerAddress] = useState<string | null>(null)
  const [signedAuth, setSignedAuth] = useState<SignedAuth | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const eventSourceRef = useRef<EventSource | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initRef = useRef(false)

  const visibleChains = chains
    ? SUPPORTED_CHAINS.filter(c => chains.includes(c.id))
    : SUPPORTED_CHAINS

  // Notify parent of status changes
  useEffect(() => {
    onStatusChange?.(state)
  }, [state, onStatusChange])

  const closeSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  // Generate burner wallet + EIP-7702 auth on mount
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    async function init() {
      setState('registering')
      try {
        const privateKey = generatePrivateKey()
        const account = privateKeyToAccount(privateKey)
        const auth = await account.signAuthorization({
          contractAddress: implementationAddress,
          chainId: 0,
          nonce: 0,
        })

        const serializedAuth: SignedAuth = {
          address: auth.address,
          chainId: auth.chainId,
          nonce: auth.nonce,
          r: auth.r,
          s: auth.s,
          yParity: auth.yParity ?? 0,
        }

        setBurnerAddress(account.address)
        setSignedAuth(serializedAuth)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create wallet')
        setState('failed')
      }
    }

    init()
  }, [implementationAddress])

  // Register session once we have burner + auth
  useEffect(() => {
    if (!burnerAddress || !signedAuth || !destinationAddress || session) return

    async function register() {
      try {
        const sess = await registerSession(
          apiUrl,
          burnerAddress!,
          signedAuth!,
          destinationAddress,
          destinationChainId,
        )

        setSession(sess)
        setState(sess.status as WidgetState)

        // Connect SSE
        const es = connectSSE(
          apiUrl,
          sess.id,
          (status) => {
            setState(status as WidgetState)
            setSession(prev => prev ? { ...prev, status } : prev)
          },
          () => {
            // SSE failed — rely on expiry timer for renewal
          },
        )
        eventSourceRef.current = es
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Registration failed')
        setState('failed')
      }
    }

    register()
  }, [burnerAddress, signedAuth, destinationAddress, destinationChainId, apiUrl, session])

  // Expiry timer — auto-renew
  useEffect(() => {
    if (!session?.expiresAt) return
    if (state === 'swept' || state === 'failed') return

    const msUntilExpiry = session.expiresAt * 1000 - Date.now()
    if (msUntilExpiry <= 0) {
      closeSSE()
      setSession(null)
      setState('expired')
      return
    }

    timerRef.current = setTimeout(() => {
      closeSSE()
      setSession(null)
      setState('expired')
    }, msUntilExpiry)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [session, state, closeSSE])

  // Close SSE on terminal states
  useEffect(() => {
    if (state === 'swept' || state === 'failed') {
      closeSSE()
    }
  }, [state, closeSSE])

  // Fire onComplete when swept
  useEffect(() => {
    if (state === 'swept' && session?.id) {
      onComplete?.(session.id)
    }
  }, [state, session?.id, onComplete])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeSSE()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [closeSSE])

  const handleRetry = () => {
    setError(null)
    setSession(null)
    initRef.current = false
    setState('idle')
    setBurnerAddress(null)
    setSignedAuth(null)
  }

  const copyAddress = async () => {
    if (!burnerAddress) return
    await navigator.clipboard.writeText(burnerAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const themeClass = theme === 'dark' ? 'depositoor-dark' : 'depositoor-light'

  return (
    <div className={`depositoor-widget ${themeClass} ${className ?? ''}`}>
      {/* Registering / Loading */}
      {(state === 'idle' || state === 'registering') && (
        <div className="depositoor-loading">
          <div className="depositoor-spinner" />
          <span>Setting up deposit...</span>
        </div>
      )}

      {/* Pending — show QR */}
      {state === 'pending' && burnerAddress && (
        <div className="depositoor-pending">
          <p className="depositoor-title">Deposit Address</p>

          <div className="depositoor-qr">
            <Cuer
              value={burnerAddress}
              size={180}
              color={theme === 'dark' ? '#ffffff' : '#000000'}
            />
          </div>

          <div className="depositoor-details">
            <button className="depositoor-detail" onClick={copyAddress} type="button">
              <div className="depositoor-detail-text">
                <span className="depositoor-detail-label">Address</span>
                <span className="depositoor-detail-value depositoor-addr">
                  {burnerAddress}
                </span>
              </div>
              <span className={`depositoor-detail-action ${copied ? 'is-copied' : ''}`}>
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

            <div className="depositoor-detail">
              <div className="depositoor-detail-text">
                <span className="depositoor-detail-label">Accepted Chains</span>
                <span className="depositoor-detail-value">
                  <span className="depositoor-chains">
                    {visibleChains.map(chain => (
                      <span
                        key={chain.id}
                        className="depositoor-chain-dot"
                        title={chain.name}
                        style={{ background: chain.color }}
                      />
                    ))}
                    <span className="depositoor-chain-names">
                      {visibleChains.map(c => c.name).join(', ')}
                    </span>
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="depositoor-status-row">
            <span className="depositoor-pulse" />
            <span>Listening for deposits...</span>
          </div>
        </div>
      )}

      {/* Detected */}
      {state === 'detected' && (
        <div className="depositoor-progress">
          <div className="depositoor-steps">
            <div className="depositoor-step done">
              <div className="depositoor-step-dot" />
              <span>Deposit detected</span>
            </div>
            <div className="depositoor-step active">
              <div className="depositoor-step-dot" />
              <span>Converting to USDC...</span>
            </div>
            <div className="depositoor-step">
              <div className="depositoor-step-dot" />
              <span>Bridging to destination</span>
            </div>
            <div className="depositoor-step">
              <div className="depositoor-step-dot" />
              <span>Complete</span>
            </div>
          </div>
        </div>
      )}

      {/* Sweeping */}
      {state === 'sweeping' && (
        <div className="depositoor-progress">
          <div className="depositoor-steps">
            <div className="depositoor-step done">
              <div className="depositoor-step-dot" />
              <span>Deposit detected</span>
            </div>
            <div className="depositoor-step done">
              <div className="depositoor-step-dot" />
              <span>Converted to USDC</span>
            </div>
            <div className="depositoor-step active">
              <div className="depositoor-step-dot" />
              <span>Bridging to destination...</span>
            </div>
            <div className="depositoor-step">
              <div className="depositoor-step-dot" />
              <span>Complete</span>
            </div>
          </div>
        </div>
      )}

      {/* Swept — success */}
      {state === 'swept' && (
        <div className="depositoor-progress">
          <div className="depositoor-steps">
            <div className="depositoor-step done">
              <div className="depositoor-step-dot" />
              <span>Deposit detected</span>
            </div>
            <div className="depositoor-step done">
              <div className="depositoor-step-dot" />
              <span>Converted to USDC</span>
            </div>
            <div className="depositoor-step done">
              <div className="depositoor-step-dot" />
              <span>Bridged to destination</span>
            </div>
            <div className="depositoor-step done">
              <div className="depositoor-step-dot" />
              <span>Complete!</span>
            </div>
          </div>
        </div>
      )}

      {/* Failed */}
      {state === 'failed' && (
        <div className="depositoor-error">
          <p className="depositoor-error-msg">{error ?? 'Something went wrong'}</p>
          <button className="depositoor-retry-btn" onClick={handleRetry} type="button">
            Try Again
          </button>
        </div>
      )}

      {/* Expired */}
      {state === 'expired' && (
        <div className="depositoor-error">
          <p className="depositoor-error-msg">Session expired</p>
          <button className="depositoor-retry-btn" onClick={handleRetry} type="button">
            New Session
          </button>
        </div>
      )}
    </div>
  )
}

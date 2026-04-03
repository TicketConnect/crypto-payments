import { createPeerExtensionSdk } from '@zkp2p/sdk'
import { useState } from 'react'
import { SUPPORTED_CHAINS, PEER_METHODS } from '../lib/constants'
import { PeerMethodLogo } from './PeerMethodLogo'
import './PeerOnrampButton.css'

const peerSdk = createPeerExtensionSdk({ window })

type Props = {
  destinationChainId: number
  destinationAddress?: string
  onPeerStarted?: () => void
}

export function PeerOnrampButton({ destinationChainId, destinationAddress, onPeerStarted }: Props) {
  const [showInstallModal, setShowInstallModal] = useState(false)

  const handleClick = async () => {
    const state = await peerSdk.getState()

    if (state === 'needs_install') {
      setShowInstallModal(true)
      return
    }

    if (state === 'needs_connection') {
      const approved = await peerSdk.requestConnection()
      if (!approved) return
    }

    const chain = SUPPORTED_CHAINS.find(c => c.id === destinationChainId)
    const toToken = chain?.usdcAddress
      ? `${chain.id}:${chain.usdcAddress}`
      : undefined

    peerSdk.onramp({
      ...(toToken && { toToken }),
      ...(destinationAddress && { recipientAddress: destinationAddress }),
      referrer: 'Depositoor',
      referrerLogo: `${window.location.origin}/depositoor-logo.svg`,
      callbackUrl: window.location.href,
    })
    onPeerStarted?.()
  }

  return (
    <>
      <button className="method-row" onClick={handleClick} type="button">
        <div className="method-icon method-icon--peer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
        <div className="method-text">
          <span className="method-title">Peer-to-peer</span>
          <span className="method-subtitle">Revolut, Venmo & more</span>
        </div>
        <div className="method-chains">
          {PEER_METHODS.map(method => (
            <PeerMethodLogo key={method.name} method={method} size={15} />
          ))}
        </div>
      </button>

      {showInstallModal && (
        <div className="peer-modal-overlay" onClick={() => setShowInstallModal(false)}>
          <div className="peer-modal" onClick={e => e.stopPropagation()}>
            <h3 className="peer-modal-title">Install Peer</h3>
            <p className="peer-modal-desc">
              A funding wallet that lets you go from fiat to crypto in seconds,
              without additional verification.
            </p>
            <div className="peer-modal-actions">
              <button className="peer-modal-install" onClick={() => peerSdk.openInstallPage()}>
                Install Extension
              </button>
              <button className="peer-modal-close" onClick={() => setShowInstallModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

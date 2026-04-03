import { createPeerExtensionSdk } from '@zkp2p/sdk'
import { SUPPORTED_CHAINS } from '../lib/constants'
import './PeerInProgress.css'

const peerSdk = createPeerExtensionSdk({ window })

type Props = {
  destinationChainId: number
  destinationAddress?: string
}

export function PeerInProgress({ destinationChainId, destinationAddress }: Props) {
  const handleOpen = () => {
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
  }

  return (
    <div className="peer-progress">
      <div className="peer-progress-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </div>
      <span className="peer-progress-title">Onramp in progress</span>
      <span className="peer-progress-subtitle">Complete your purchase in the Peer extension</span>
      <button className="peer-progress-btn" onClick={handleOpen} type="button">
        Open Extension
      </button>
    </div>
  )
}

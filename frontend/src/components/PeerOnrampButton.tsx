import { createPeerExtensionSdk } from '@zkp2p/sdk'
import { SUPPORTED_CHAINS, PEER_METHODS } from '../lib/constants'
import { PeerMethodLogo } from './PeerMethodLogo'
import './PeerOnrampButton.css'

export const peerSdk = createPeerExtensionSdk({ window })

type Props = {
  destinationChainId: number
  destinationAddress?: string
  onPeerStarted?: () => void
  onNeedsInstall?: () => void
}

export function PeerOnrampButton({ destinationChainId, destinationAddress, onPeerStarted, onNeedsInstall }: Props) {
  const handleClick = async () => {
    const state = await peerSdk.getState()

    if (state === 'needs_install') {
      onNeedsInstall?.()
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
    <button className="method-row" onClick={handleClick} type="button">
      <div className="method-icon method-icon--peer">
        <img src="/peer-logo.svg" alt="Peer" width="24" height="24" />
      </div>
      <div className="method-text">
        <span className="method-title">Pay by Cash</span>
        <span className="method-subtitle">Deposit via Revolut, Venmo & more</span>
      </div>
      <div className="method-chains">
        {PEER_METHODS.map(method => (
          <PeerMethodLogo key={method.name} method={method} size={15} />
        ))}
      </div>
    </button>
  )
}

import { peerSdk } from './PeerOnrampButton'
import './PeerInProgress.css'

export function PeerInstall() {
  return (
    <div className="peer-progress">
      <div className="peer-progress-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </div>
      <span className="peer-progress-title">Install Peer</span>
      <span className="peer-progress-subtitle">
        A funding wallet that lets you go from fiat to crypto in seconds, without additional verification.
      </span>
      <button className="peer-progress-btn" onClick={() => peerSdk.openInstallPage()} type="button">
        Install Extension
      </button>
    </div>
  )
}

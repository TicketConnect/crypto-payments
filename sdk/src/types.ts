export type SessionStatus =
  | 'idle'
  | 'registering'
  | 'pending'
  | 'detected'
  | 'sweeping'
  | 'swept'
  | 'failed'
  | 'expired'

export type Session = {
  id: string
  expiresAt: number
  status: SessionStatus
}

export type SignedAuth = {
  address: string
  chainId: number
  nonce: number
  r: string
  s: string
  yParity: number
}

export type Chain = {
  id: number
  name: string
  color: string
  logoBg?: string
  logoScale?: number
  cctpDomain?: number
  usdcAddress?: string
}

export type Token = {
  symbol: string
  name: string
  color: string
  addresses: Record<number, string>
}

export type PeerMethod = {
  name: string
  color: string
}

export type DepositoorTheme = 'light' | 'dark'

export interface DepositoorProviderProps {
  apiUrl: string
  implementationAddress: `0x${string}`
  children: React.ReactNode
}

export interface DepositWidgetProps {
  destinationAddress: string
  destinationChainId: number
  chains?: number[]
  theme?: DepositoorTheme
  onStatusChange?: (status: SessionStatus) => void
  onComplete?: (txHash: string) => void
  onWalletConnect?: () => void
  onPeerOnramp?: () => void
  className?: string
}

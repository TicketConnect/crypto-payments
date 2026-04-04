import { useContext } from 'react'
import { DepositoorContext } from '../provider'
import type { Session, SessionStatus } from '../types'

export interface DepositoorContextValue {
  apiUrl: string
  implementationAddress: `0x${string}`
}

export function useDepositoor(): DepositoorContextValue {
  const ctx = useContext(DepositoorContext)
  if (!ctx) {
    throw new Error('useDepositoor must be used within a <DepositoorProvider>')
  }
  return ctx
}

export type { Session, SessionStatus }

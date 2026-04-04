import { createContext, type ReactNode } from 'react'

export interface DepositoorContextValue {
  apiUrl: string
  implementationAddress: `0x${string}`
}

export const DepositoorContext = createContext<DepositoorContextValue | null>(null)

export interface DepositoorProviderProps {
  apiUrl: string
  implementationAddress: `0x${string}`
  children: ReactNode
}

export function DepositoorProvider({
  apiUrl,
  implementationAddress,
  children,
}: DepositoorProviderProps) {
  return (
    <DepositoorContext.Provider value={{ apiUrl, implementationAddress }}>
      {children}
    </DepositoorContext.Provider>
  )
}

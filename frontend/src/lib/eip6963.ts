// EIP-6963 types
export interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon: string  // data URI
  rdns: string  // reverse DNS (e.g. "io.metamask")
}

export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
  on(event: string, handler: (...args: unknown[]) => void): void
  removeListener(event: string, handler: (...args: unknown[]) => void): void
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo
  provider: EIP1193Provider
}

// Declare the custom events for TypeScript
declare global {
  interface WindowEventMap {
    'eip6963:announceProvider': CustomEvent<EIP6963ProviderDetail>
  }
}

/** Discover all injected EIP-6963 wallet providers. */
export function discoverProviders(
  onProvider: (detail: EIP6963ProviderDetail) => void
): () => void {
  const handler = (event: CustomEvent<EIP6963ProviderDetail>) => {
    onProvider(event.detail)
  }

  window.addEventListener('eip6963:announceProvider', handler)
  window.dispatchEvent(new Event('eip6963:requestProvider'))

  // Return cleanup function
  return () => window.removeEventListener('eip6963:announceProvider', handler)
}

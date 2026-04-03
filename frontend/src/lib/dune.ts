const DUNE_API_URL = 'https://api.sim.dune.com/v1/evm/balances'
const DUNE_API_KEY = import.meta.env.VITE_DUNE_SIM_API_KEY as string

export interface TokenBalance {
  chain: string
  chain_id: number
  address: string
  amount: string
  symbol: string
  name: string
  decimals: number
  price_usd: number
  value_usd: number
  pool_size: number
  low_liquidity: boolean
  token_metadata?: {
    logo: string | null
    url: string | null
  }
}

interface DuneBalancesResponse {
  wallet_address: string
  balances: TokenBalance[]
  next_offset: string | null
}

const SUPPORTED_CHAIN_IDS = [1, 42161, 8453, 10, 137, 56, 143, 999]

/** Fetch all token balances for a wallet across supported chains. */
export async function fetchBalances(walletAddress: string): Promise<TokenBalance[]> {
  const params = new URLSearchParams({
    chain_ids: SUPPORTED_CHAIN_IDS.join(','),
    exclude_spam_tokens: 'true',
    metadata: 'logo',
  })

  const res = await fetch(`${DUNE_API_URL}/${walletAddress}?${params}`, {
    headers: { 'X-Sim-Api-Key': DUNE_API_KEY },
  })

  if (!res.ok) {
    throw new Error(`Dune SIM API error: ${res.status}`)
  }

  const data: DuneBalancesResponse = await res.json()

  return data.balances
    .sort((a, b) => b.value_usd - a.value_usd)
}

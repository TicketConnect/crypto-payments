export const IMPL_ADDRESS = '0x000000000000000000000000000000000000dEaD' as const

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'

export type Chain = {
  id: number
  name: string
  color: string
  logo?: string         // filename in /chain-logos/ (without .svg)
  logoBg?: string       // override background color behind logo SVG
  logoScale?: number    // 0-1+ scale of logo inside square (default 0.75)
  shortLabel?: string   // 1-2 char fallback for logo (default: name[0])
  cctpDomain?: number
  comingSoon?: boolean
  usdcAddress?: string
}

export const SUPPORTED_CHAINS: Chain[] = [
  { id: 1,     name: 'Ethereum',  color: '#627EEA', logo: 'ethereum',        cctpDomain: 0, usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { id: 42161, name: 'Arbitrum',  color: '#12AAFF', logo: 'arbitrum',        logoBg: '#05163D', cctpDomain: 3, usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  { id: 8453,  name: 'Base',      color: '#0052FF', logo: 'base',            logoBg: '#ffffff', cctpDomain: 6, usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { id: 10,    name: 'Optimism',  color: '#FF0420', logo: 'op-mainnet',      logoScale: 0.6, cctpDomain: 2, usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
  { id: 137,   name: 'Polygon',   color: '#8247E5', logo: 'polygon',        logoBg: '#6C00F7', logoScale: 1.1, usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
  { id: 56,    name: 'BSC',       color: '#F0B90B', logo: 'bnb-smart-chain', logoBg: '#1E2026' },
  { id: 143,   name: 'Monad',     color: '#836EF9', logo: 'monad',          logoBg: '#6E54FF', logoScale: 0.85 },
  { id: 999,   name: 'HyperEVM',  color: '#7BF179', logo: 'hyperevm',       logoBg: '#072722', shortLabel: 'HL' },
  { id: 0,     name: 'Solana',    color: '#9945FF', logo: 'solana',          logoBg: 'linear-gradient(to right, #9945FF, #14F195)' },
]

export type PeerMethod = {
  name: string
  logo: string       // filename in /peer-logos/ (with extension)
  color: string      // brand color (used as background)
  logoScale?: number // 0-1+ scale (default 0.75)
}

export const PEER_METHODS: PeerMethod[] = [
  { name: 'Luxon',   logo: 'luxon.png',   color: '#000000', logoScale: 1 },
  { name: 'Revolut', logo: 'revolut.svg', color: '#ffffff' },
  { name: 'Wise',    logo: 'wise.svg', color: '#9FE870', logoScale: 1 },
  { name: 'Venmo',   logo: 'venmo.webp',         color: '#008CFF', logoScale: 1 },
  { name: 'CashApp', logo: 'cashapp.svg', color: '#00D632', logoScale: 0.9 },
  { name: 'Chime',   logo: 'chime.webp',   color: '#1DBF73', logoScale: 1 },
  { name: 'Zelle',   logo: 'zelle.svg',   color: '#6D1ED4', logoScale: 0.6 },
  { name: 'PayPal',  logo: 'paypal.png', color: '#ffffff', logoScale: 2.5 },
]

export type Token = {
  symbol: string
  name: string
  color: string
  addresses: Record<number, string> // chainId -> address
}

export const SUPPORTED_TOKENS: Token[] = [
  {
    symbol: 'USDC',
    name: 'USD Coin',
    color: '#2775CA',
    addresses: {
      42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      8453:  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      10:    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    },
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    color: '#26A17B',
    addresses: {
      42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
      8453:  '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      10:    '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    },
  },
  {
    symbol: 'DAI',
    name: 'Dai',
    color: '#F5AC37',
    addresses: {
      42161: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
      8453:  '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      10:    '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
    },
  },
]

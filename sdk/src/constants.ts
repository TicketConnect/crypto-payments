import type { Chain, PeerMethod, Token } from './types'

export const SUPPORTED_CHAINS: Chain[] = [
  { id: 1,     name: 'Ethereum',  color: '#627EEA', cctpDomain: 0, usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { id: 42161, name: 'Arbitrum',  color: '#12AAFF', logoBg: '#05163D', cctpDomain: 3, usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  { id: 8453,  name: 'Base',      color: '#0052FF', logoBg: '#ffffff', cctpDomain: 6, usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { id: 10,    name: 'Optimism',  color: '#FF0420', logoScale: 0.6, cctpDomain: 2, usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
  { id: 137,   name: 'Polygon',   color: '#8247E5', logoBg: '#6C00F7', logoScale: 1.1, usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
]

export const PEER_METHODS: PeerMethod[] = [
  { name: 'Luxon',   color: '#000000' },
  { name: 'Revolut', color: '#ffffff' },
  { name: 'Wise',    color: '#9FE870' },
  { name: 'Venmo',   color: '#008CFF' },
  { name: 'CashApp', color: '#00D632' },
  { name: 'Chime',   color: '#1DBF73' },
  { name: 'Zelle',   color: '#6D1ED4' },
  { name: 'PayPal',  color: '#ffffff' },
]

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

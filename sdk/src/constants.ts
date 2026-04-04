import type { Chain } from './types'

export const SUPPORTED_CHAINS: Chain[] = [
  { id: 1,     name: 'Ethereum',  color: '#627EEA', cctpDomain: 0, usdcAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { id: 42161, name: 'Arbitrum',  color: '#12AAFF', cctpDomain: 3, usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
  { id: 8453,  name: 'Base',      color: '#0052FF', cctpDomain: 6, usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
  { id: 10,    name: 'Optimism',  color: '#FF0420', cctpDomain: 2, usdcAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
  { id: 137,   name: 'Polygon',   color: '#8247E5', usdcAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
]

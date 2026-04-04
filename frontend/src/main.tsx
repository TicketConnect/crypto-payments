import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LandingPage from './LandingPage.tsx'
import { WalletProvider } from './components/WalletProvider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <LandingPage />
    </WalletProvider>
  </StrictMode>,
)

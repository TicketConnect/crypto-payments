import App from './App'
import './LandingPage.css'
import { SUPPORTED_CHAINS } from './lib/constants'
import { ChainLogo } from './components/ChainLogo'

export default function LandingPage() {
  return (
    <div className="antialiased min-h-screen flex flex-col relative overflow-x-hidden selection:bg-accent/30">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-bg/80 backdrop-blur-md border-b border-white/[0.04] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="font-mono text-text-primary text-base font-medium tracking-tight">
            depositoor
          </a>
          <div className="flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors">Docs</a>
            <a href="https://github.com/kkoshiya/depositoor" className="text-text-secondary hover:text-text-primary transition-colors">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12C2 16.42 4.868 20.166 8.839 21.492C9.339 21.584 9.52 21.276 9.52 21.011C9.52 20.771 9.511 20.148 9.506 19.309C6.725 19.913 6.138 17.969 6.138 17.969C5.683 16.815 5.027 16.508 5.027 16.508C4.12 15.888 5.095 15.9 5.095 15.9C6.098 15.97 6.626 16.93 6.626 16.93C7.518 18.459 8.966 18.016 9.544 17.761C9.635 17.106 9.897 16.663 10.187 16.409C7.967 16.156 5.635 15.297 5.635 11.458C5.635 10.366 6.025 9.471 6.657 8.766C6.554 8.513 6.213 7.498 6.755 6.126C6.755 6.126 7.589 5.859 9.502 7.153C10.294 6.933 11.144 6.823 11.992 6.819C12.84 6.823 13.69 6.933 14.483 7.153C16.395 5.859 17.228 6.126 17.228 6.126C17.771 7.498 17.43 8.513 17.328 8.766C17.961 9.471 18.35 10.366 18.35 11.458C18.35 15.308 16.015 16.153 13.788 16.4C14.15 16.713 14.473 17.333 14.473 18.286C14.473 19.65 14.46 20.75 14.46 21.011C14.46 21.279 14.639 21.59 15.147 21.492C19.115 20.163 21.996 16.418 21.996 12C21.996 6.477 17.523 2 12 2Z" />
              </svg>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 pt-16">
        {/* Hero */}
        <section className="relative min-h-[90vh] flex flex-col justify-center items-center overflow-hidden py-20">
          <div className="landing-bg-grid" />

          <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-8 items-center">
              {/* Left: headline + code */}
              <div className="flex flex-col max-w-xl mx-auto lg:mx-0 w-full">
                <h1 className="text-[44px] sm:text-5xl lg:text-[56px] font-bold text-text-primary leading-[1.05] tracking-tight mb-4">
                  Accept any token.<br />
                  Settle in USDC.
                </h1>
                <p className="text-lg text-text-secondary mb-10">
                  Any chain. Any token. One address. Non-custodial.
                </p>

                <div className="landing-code-block border border-white/[0.04] rounded-[14px] p-5 w-full shadow-2xl shadow-black/50">
                  <div className="font-mono text-[13px] text-text-secondary mb-5 pb-5 border-b border-white/[0.04] select-all">
                    npm i @depositoor/react
                  </div>
                  <div className="font-mono text-[13px] leading-[1.6]">
                    <span className="text-[#89ddff]">&lt;</span>
                    <span className="text-[#ffcb6b]">DepositoorProvider</span>{' '}
                    <span className="text-[#c792ea]">apiUrl</span>
                    <span className="text-[#89ddff]">=</span>
                    <span className="text-[#c3e88d]">"https://api.depositoor.xyz"</span>
                    <span className="text-[#89ddff]">&gt;</span>
                    <br />
                    <div className="pl-4">
                      <span className="text-[#89ddff]">&lt;</span>
                      <span className="text-[#ffcb6b]">DepositWidget</span>
                      <br />
                      <div className="pl-4">
                        <span className="text-[#c792ea]">destinationAddress</span>
                        <span className="text-[#89ddff]">=</span>
                        <span className="text-[#c3e88d]">"0xYourAddress"</span>
                        <br />
                        <span className="text-[#c792ea]">destinationChainId</span>
                        <span className="text-[#89ddff]">=</span>
                        <span className="text-[#89ddff]">{'{'}</span>
                        <span className="text-[#f78c6c]">8453</span>
                        <span className="text-[#89ddff]">{'}'}</span>
                        <br />
                      </div>
                      <span className="text-[#89ddff]">/&gt;</span>
                    </div>
                    <span className="text-[#89ddff]">&lt;/</span>
                    <span className="text-[#ffcb6b]">DepositoorProvider</span>
                    <span className="text-[#89ddff]">&gt;</span>
                  </div>
                </div>
              </div>

              {/* Right: widget */}
              <div className="w-full flex justify-center lg:justify-end relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-accent/20 rounded-full blur-[100px] pointer-events-none" />
                <div className="landing-widget-wrap">
                  <App />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Chain logos */}
        <section className="py-12 border-b border-white/[0.04]">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex flex-wrap justify-center gap-10 opacity-70 grayscale-[0.3] transition-all hover:grayscale-0 hover:opacity-100 duration-500">
              {SUPPORTED_CHAINS.map(chain => (
                <div key={chain.id} className="flex flex-col items-center gap-3 group cursor-default">
                  <div
                    className="w-10 h-10 rounded-[10px] flex items-center justify-center shadow-lg transition-transform group-hover:scale-110 duration-300"
                    style={{ background: chain.logoBg ?? chain.color }}
                  >
                    <ChainLogo chain={chain} size={24} />
                  </div>
                  <span className="text-xs font-medium text-text-muted transition-colors group-hover:text-text-primary">
                    {chain.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pipeline flow */}
        <section className="py-6 border-b border-white/[0.04] bg-surface/30">
          <div className="max-w-7xl mx-auto px-6 overflow-x-auto">
            <div className="flex items-center justify-center min-w-max gap-4 font-mono text-[13px] text-text-muted whitespace-nowrap">
              <span>deposit (any token)</span>
              <Arrow />
              <span>detect</span>
              <Arrow />
              <span>swap (Uniswap)</span>
              <Arrow />
              <span>bridge (Across)</span>
              <Arrow />
              <span className="text-text-secondary">settle (USDC)</span>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24 max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
            <Step num="01" text={<>User sends any token<br className="hidden lg:block" />to a generated address</>} />
            <Step num="02" text={<>depositoor converts<br className="hidden lg:block" />via Uniswap + bridges<br className="hidden lg:block" />cross-chain automatically</>} />
            <Step num="03" text={<>USDC arrives at your<br className="hidden lg:block" />address, any chain</>} />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-white/[0.04] mt-auto">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-mono text-text-muted">
          <span>Built with EIP-7702 and Solady ERC-7821</span>
          <span>ETHGlobal 2026</span>
        </div>
      </footer>
    </div>
  )
}

function Arrow() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

function Step({ num, text }: { num: string; text: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <span className="font-mono text-4xl font-medium text-text-muted/60 tracking-tighter">{num}</span>
      <p className="text-[15px] leading-relaxed text-text-secondary">{text}</p>
    </div>
  )
}

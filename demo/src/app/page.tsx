"use client";

import { DepositoorProvider, DepositWidget } from "@depositoor/react";

const CHAINS = [
  { name: "Ethereum", color: "#627EEA" },
  { name: "Arbitrum", color: "#12AAFF" },
  { name: "Base", color: "#0052FF" },
  { name: "Optimism", color: "#FF0420" },
  { name: "Polygon", color: "#8247E5" },
];

function CodeSnippet() {
  return (
    <div className="code-block">
      <span className="cmt">{"// npm i @depositoor/react"}</span>
      {"\n\n"}
      <span className="punc">{"<"}</span>
      <span className="tag">DepositoorProvider</span>
      {" "}
      <span className="attr">apiUrl</span>
      <span className="punc">{"="}</span>
      <span className="str">{'"https://depositoor.xyz/api"'}</span>
      <span className="punc">{">"}</span>
      {"\n  "}
      <span className="punc">{"<"}</span>
      <span className="tag">DepositWidget</span>
      {"\n    "}
      <span className="attr">destinationAddress</span>
      <span className="punc">{"="}</span>
      <span className="str">{'"0xYour...Addr"'}</span>
      {"\n    "}
      <span className="attr">destinationChainId</span>
      <span className="punc">{"={"}</span>
      <span className="str">8453</span>
      <span className="punc">{"}"}</span>
      {"\n  "}
      <span className="punc">{"/>"}</span>
      {"\n"}
      <span className="punc">{"</"}</span>
      <span className="tag">DepositoorProvider</span>
      <span className="punc">{">"}</span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative z-1 grid-bg min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto w-full">
        <span className="text-[15px] font-semibold tracking-tight">
          depositoor
        </span>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/kkoshiya/depositoor"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/@depositoor/react"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[13px] text-[var(--text-secondary)] hover:text-[var(--foreground)] transition-colors"
          >
            npm
          </a>
        </div>
      </nav>

      {/* Hero + Widget */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24 gap-16">
        {/* Hero copy */}
        <div className="text-center max-w-xl space-y-4">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1]">
            Accept any token.
            <br />
            <span className="text-[var(--text-secondary)]">Receive USDC.</span>
          </h1>
          <p className="text-[15px] text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">
            One React component. Five chains. Any ERC-20 or native ETH gets
            swapped and bridged to USDC at your destination — powered by
            EIP-7702 delegation.
          </p>
          <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
            {CHAINS.map((c) => (
              <span key={c.name} className="chain-pill">
                <span className="chain-dot" style={{ background: c.color }} />
                {c.name}
              </span>
            ))}
          </div>
        </div>

        {/* Widget showcase */}
        <div className="relative">
          <div className="glow" />
          <div className="relative z-1">
            <DepositoorProvider
              apiUrl="https://depositoor.xyz/api"
              implementationAddress="0x33333393A5EdE0c5E257b836034b8ab48078f53c"
            >
              <DepositWidget
                destinationAddress="0x0000000000000000000000000000000000000000"
                destinationChainId={8453}
                theme="dark"
                onStatusChange={(s) => console.log("status:", s)}
                onComplete={(id) => console.log("complete:", id)}
              />
            </DepositoorProvider>
          </div>
        </div>

        {/* Code snippet */}
        <div className="w-full max-w-lg">
          <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--text-muted)] mb-3 text-center">
            Integration
          </p>
          <CodeSnippet />
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 text-center text-[12px] text-[var(--text-muted)]">
        Built for ETHGlobal
      </footer>
    </div>
  );
}

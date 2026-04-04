# Landing Page Brief

Build a single-page landing/demo site for depositoor. The page has one job: show what the product is, show the widget working, and make it feel inevitable. No signup, no waitlist, no "coming soon". This is a live product with a working SDK.

## Reference

`homepage-mockup.html` in the repo root contains the actual deposit widget component with all its styles, chain logos, and payment methods. **Use this as the literal centerpiece of the page.** Don't redesign it. Embed it.

## Page structure

Top to bottom, one scroll:

### 1. Header bar

Minimal. Logo (just "depositoor" in the monospace font) left-aligned. A single "Docs" link and a GitHub icon, right-aligned. No hamburger menu, no nav items. Sticky, transparent with backdrop blur, becomes slightly opaque on scroll.

### 2. Hero

Center of the viewport. Two elements side by side (stacked on mobile):

**Left: the pitch.** One headline, one subline, one code block.

Headline (large, white, tight leading):
```
Accept any token.
Settle in USDC.
```

Subline (smaller, muted, one line):
```
Any chain. Any token. One address. Non-custodial.
```

Then the install + usage block — the SDK one-liner that makes engineers stop scrolling:

```tsx
npm i @depositoor/react
```

```tsx
<DepositoorProvider apiUrl="https://api.depositoor.xyz">
  <DepositWidget
    destinationAddress="0xYourAddress"
    destinationChainId={8453}
  />
</DepositoorProvider>
```

Style this code block well. Monospace, syntax highlighted (just use static colored spans — no runtime highlighter needed). Dark surface with subtle border. This is the money shot for any developer looking at this page.

**Right: the widget.** Embed the actual deposit widget from `homepage-mockup.html`. It should look like it's floating — slight elevation, maybe a soft glow underneath. This is a real, functional component, not a screenshot.

### 3. The grid / background

Behind the hero, a subtle dot grid or line grid. Very low opacity (0.03-0.05). Fades out at the edges. Think Linear or Vercel's landing pages — the grid implies precision without being decorative. Use CSS, not an image.

### 4. How it works

Three steps, horizontal on desktop, vertical on mobile. Minimal.

```
01                          02                          03
User sends any token        depositoor converts         USDC arrives at your
to a generated address      via Uniswap + bridges       address, any chain
                            cross-chain automatically
```

No icons, no illustrations. Just the numbers and text. Let the typography do the work.

### 5. Supported chains

A single row of the 5 chain logos (Ethereum, Arbitrum, Base, Optimism, Polygon) with names underneath. Small, muted. Not a feature grid — just a quiet acknowledgment.

### 6. Architecture strip

One-line diagram of the flow, rendered as a horizontal strip:

```
deposit (any token) → detect → swap (Uniswap) → bridge (Across) → settle (USDC)
```

Monospace, muted, with subtle arrows. Think of it as a system diagram, not marketing.

### 7. Footer

One line: "Built with EIP-7702 and Solady ERC-7821" on the left. "ETHGlobal 2026" on the right. That's it.

## Design system

Pull all values from the existing mockup's CSS variables:

```css
--bg: #050506
--card: #0a0a0c
--surface: #101012
--text-primary: #fafafa
--text-secondary: #71717a
--text-muted: #3f3f46
--accent: #2775CA
--font: 'Plus Jakarta Sans'
--font-mono: 'IBM Plex Mono'
```

The page should feel like an extension of the widget — same dark theme, same type scale, same surface colors. No gradient banners, no hero images, no glassmorphism. Just dark surfaces, sharp type, and negative space.

## Technical

- Single HTML file or a simple Vite page — whatever is faster.
- No React needed for the landing page itself. The widget mockup is static HTML/CSS.
- Google Fonts: Plus Jakarta Sans (400, 500, 600, 700) + IBM Plex Mono (400, 500).
- Mobile responsive. The hero stacks (text above widget). The "how it works" stacks vertically. Everything else flows naturally.
- The code blocks should look good. Use a slightly lighter surface (`#0e0e10` or similar) with a 1px border. Subtle line numbers optional.

## What not to do

- No animations, transitions, or scroll effects beyond the sticky header
- No "trusted by" logos or testimonials
- No pricing section
- No feature comparison table
- No newsletter signup
- No cookies banner
- No chatbot
- The widget is the hero. Everything else exists to explain it. Don't compete with it.

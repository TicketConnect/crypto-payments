import { useState, useEffect } from 'react'

type Props = {
  icon: string
  name: string
  logoBg?: string
  logoScale?: number
  size?: number
}

type BgResult = { type: 'none' } | { type: 'extend'; color: string } | { type: 'add' }

/**
 * Detect icon background shape using X and + ray patterns.
 * Returns:
 *  - 'none':   icon fills the square (rounded square bg) — just clip
 *  - 'extend': icon has circular bg — extend its color to fill the square
 *  - 'add':    icon is a floating shape — add a dark bg behind it
 */
function useBgDetect(src: string, walletName: string, explicitBg?: string): BgResult {
  const [result, setResult] = useState<BgResult>({ type: 'none' })

  useEffect(() => {
    if (explicitBg) return

    const img = new Image()
    img.onload = () => {
      try {
        const s = 32
        const c = document.createElement('canvas')
        c.width = s
        c.height = s
        const ctx = c.getContext('2d')!
        ctx.drawImage(img, 0, 0, s, s)
        const data = ctx.getImageData(0, 0, s, s).data

        const mid = s / 2

        const rays: { label: string; start: [number, number]; group: 'x' | '+' }[] = [
          { label: 'TL corner', start: [0, 0], group: 'x' },
          { label: 'TR corner', start: [s - 1, 0], group: 'x' },
          { label: 'BL corner', start: [0, s - 1], group: 'x' },
          { label: 'BR corner', start: [s - 1, s - 1], group: 'x' },
          { label: 'T  mid',    start: [mid, 0], group: '+' },
          { label: 'B  mid',    start: [mid, s - 1], group: '+' },
          { label: 'L  mid',    start: [0, mid], group: '+' },
          { label: 'R  mid',    start: [s - 1, mid], group: '+' },
        ]

        const xPcts: number[] = []
        const plusPcts: number[] = []
        const results: string[] = []

        for (const { label, start: [sx, sy], group } of rays) {
          const dx = mid - sx
          const dy = mid - sy
          const steps = Math.max(Math.abs(dx), Math.abs(dy))

          let firstPct = 100
          for (let i = 0; i <= steps; i++) {
            const x = Math.round(sx + (dx * i) / steps)
            const y = Math.round(sy + (dy * i) / steps)
            if (data[(y * s + x) * 4 + 3] > 128) {
              firstPct = Math.round((i / steps) * 100)
              break
            }
          }

          if (group === 'x') xPcts.push(firstPct)
          else plusPcts.push(firstPct)

          results.push(`  ${label}: ${firstPct}%`)
        }

        const avgX = xPcts.reduce((a, b) => a + b, 0) / xPcts.length
        const avgPlus = plusPcts.reduce((a, b) => a + b, 0) / plusPcts.length
        const hasBg = avgPlus <= avgX && avgPlus < 25

        // Check if corners are transparent (circular bg vs square bg)
        const cornerAlpha = (x: number, y: number) => data[(y * s + x) * 4 + 3]
        const cornersTransparent =
          cornerAlpha(0, 0) < 128 ||
          cornerAlpha(s - 1, 0) < 128 ||
          cornerAlpha(0, s - 1) < 128 ||
          cornerAlpha(s - 1, s - 1) < 128

        let detected: BgResult
        if (!hasBg) {
          detected = { type: 'add' }
        } else if (cornersTransparent && avgX > 20) {
          // Circular bg — sample color from an edge midpoint (inside the circle)
          const sampleX = mid
          const sampleY = Math.round(s * 0.15) // slightly inward from top
          const idx = (sampleY * s + sampleX) * 4
          const r = data[idx], g = data[idx + 1], b = data[idx + 2]
          const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
          detected = { type: 'extend', color: hex }
        } else {
          detected = { type: 'none' }
        }

        console.log(
          `[WalletLogo] bg detect for "${walletName}":\n` +
          results.join('\n') +
          `\n  avgX=${Math.round(avgX)}% avgPlus=${Math.round(avgPlus)}%` +
          `\n  corners=${cornersTransparent ? 'transparent' : 'opaque'}` +
          `\n  → ${detected.type}${detected.type === 'extend' ? ` (${detected.color})` : ''}`
        )

        setResult(detected)
      } catch {
        setResult({ type: 'add' })
      }
    }
    img.src = src
  }, [src, walletName, explicitBg])

  return result
}

export function WalletLogo({ icon, name, logoBg, logoScale, size = 32 }: Props) {
  const r = Math.round(size * 0.22)
  const detected = useBgDetect(icon, name, logoBg)

  let bg: string | undefined
  if (logoBg) {
    bg = logoBg
  } else if (detected.type === 'extend') {
    bg = detected.color
  } else if (detected.type === 'add') {
    bg = '#1c1c1e'
  }

  const scale = logoScale ?? (bg ? 0.75 : 1)
  const imgSize = Math.round(size * scale)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: bg ?? 'transparent',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={icon}
        alt={name}
        width={imgSize}
        height={imgSize}
        style={{ display: 'block', objectFit: 'contain' }}
      />
    </div>
  )
}

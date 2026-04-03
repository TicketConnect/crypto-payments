import type { PeerMethod } from '../lib/constants'

type Props = {
  method: PeerMethod
  size?: number
}

export function PeerMethodLogo({ method, size = 18 }: Props) {
  const r = Math.round(size * 0.22)
  const scale = method.logoScale ?? 0.75
  const imgSize = Math.round(size * scale)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: method.color,
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <img
        src={`/peer-logos/${method.logo}`}
        alt={method.name}
        width={imgSize}
        height={imgSize}
        style={{ display: 'block', objectFit: 'contain' }}
      />
    </div>
  )
}

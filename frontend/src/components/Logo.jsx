// StatCourt logo: one geometric S (two stacked arcs) with a dot on the top end.
// The bottom stroke is always brand cyan; the top stroke and dot carry the sport colour.
const TOP = { master: '#F4F5F7', basketball: '#FF7A1A', soccer: '#22C55E' }
const CYAN = '#4FC3F7'
const LABEL = { basketball: 'BASKETBALL', soccer: 'SOCCER' }

export function LogoMark({ variant = 'master', size = 32, className = '' }) {
  const top = TOP[variant] || TOP.master
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img"
      aria-label={`StatCourt${LABEL[variant] ? ' ' + LABEL[variant].toLowerCase() : ''} logo`}>
      <path d="M86 28 H52 A16 16 0 0 0 52 60 H60" fill="none" stroke={top} strokeWidth="14" />
      <path d="M60 60 H68 A16 16 0 0 1 68 92 H34" fill="none" stroke={CYAN} strokeWidth="14" />
      <circle cx="86" cy="28" r="9" fill={top} />
    </svg>
  )
}

// Full lockup: mark + STATCOURT wordmark (+ sport name when the variant has one). `size` = the mark's height in px.
export default function Logo({ variant = 'master', size = 40, showLabel = true, className = '' }) {
  const top = TOP[variant] || TOP.master
  const word = { fontFamily: "Saira, 'Oswald', system-ui, sans-serif", fontWeight: 800, lineHeight: 1, letterSpacing: '0.01em' }
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.22 }}>
      <LogoMark variant={variant} size={size} />
      <span className="inline-flex flex-col" style={{ gap: size * 0.06 }}>
        <span style={{ ...word, fontSize: size * 0.555 }}>
          <span style={{ color: '#F4F5F7' }}>STAT</span><span style={{ color: CYAN }}>COURT</span>
        </span>
        {showLabel && LABEL[variant] && (
          <span style={{ ...word, fontWeight: 700, fontSize: size * 0.222, letterSpacing: '0.28em', color: top }}>
            {LABEL[variant]}
          </span>
        )}
      </span>
    </span>
  )
}

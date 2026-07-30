// Generates a consistent color per player name so the same player always
// gets the same avatar color across searches/sessions, without depending
// on any external photo source that could break or rate-limit.
const PALETTE = ['#FF7A1A', '#C99A4B', '#3E8E7E', '#5B7FDB', '#D65D8A', '#7A6BC9']

function colorForName(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

function initialsForName(name) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export default function Avatar({ name, size = 56 }) {
  const bg = colorForName(name)
  return (
    <div
      className="flex items-center justify-center rounded-full font-display font-semibold text-court-bg shrink-0"
      style={{ backgroundColor: bg, width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initialsForName(name)}
    </div>
  )
}

const STATUS_CONTENT = {
  not_yet_drafted: {
    icon: '⏳',
    title: 'Not Yet Drafted',
    message: (name, year) => `${name} hadn't entered the league in ${year}.`,
  },
  retired: {
    icon: '🏁',
    title: 'No Longer Active',
    message: (name, year) => `${name} was no longer active during the ${year} season.`,
  },
  no_data: {
    icon: '—',
    title: 'No Stats Recorded',
    message: (name, year) => `No stats were recorded for ${name} in ${year}.`,
  },
}

export default function EmptyStateCard({ status, name, year, align = 'left' }) {
  const content = STATUS_CONTENT[status]
  if (!content) return null

  return (
    <div className={`flex flex-col gap-1 py-3 ${align === 'right' ? 'items-end text-right' : 'items-start text-left'}`}>
      <span className="text-lg leading-none opacity-70" aria-hidden="true">{content.icon}</span>
      <span className="text-xs uppercase tracking-widest text-ink-faint font-body">{content.title}</span>
      <span className="text-sm text-ink-muted font-body max-w-[220px]">
        {content.message(name, year)}
      </span>
    </div>
  )
}

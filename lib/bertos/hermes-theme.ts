// Hermes — Jarvis × Roman Mission-Control design tokens.
// Cyan holographic + bronze/gold Roman accents on a dark-glass substrate.
// All tokens are exported as className strings so Tailwind sees them.

export const hermes = {
  // Surfaces
  surface: {
    base:    'bg-[#05080F]',
    panel:   'bg-[#0A0F1A]/70 backdrop-blur-xl',
    raised:  'bg-[#0E1525]/80 backdrop-blur-xl',
    sunken:  'bg-black/40',
    inset:   'bg-[#070B14]/80',
  },
  // Borders
  border: {
    subtle:  'border-cyan-500/10',
    default: 'border-cyan-500/20',
    strong:  'border-cyan-500/35',
    bronze:  'border-amber-600/30',
    bronzeStrong: 'border-amber-600/50',
    warn:    'border-amber-500/30',
    danger:  'border-red-500/30',
  },
  // Text
  text: {
    primary:   'text-cyan-50',
    secondary: 'text-cyan-100/70',
    muted:     'text-cyan-100/40',
    bronze:    'text-amber-300',
    bronzeMuted: 'text-amber-200/60',
    cyan:      'text-cyan-300',
    danger:    'text-red-300',
  },
  // Glows
  glow: {
    cyan:   'shadow-[0_0_20px_rgba(34,211,238,0.25)]',
    cyanStrong: 'shadow-[0_0_30px_rgba(34,211,238,0.45)]',
    bronze: 'shadow-[0_0_18px_rgba(217,119,6,0.35)]',
    inner:  'shadow-[inset_0_0_20px_rgba(34,211,238,0.06)]',
  },
  // Status colors
  status: {
    nominal: { ring: 'ring-emerald-400/50', text: 'text-emerald-300', fill: 'bg-emerald-400', glow: 'rgba(52,211,153,0.45)' },
    active:  { ring: 'ring-cyan-400/50',    text: 'text-cyan-300',    fill: 'bg-cyan-400',    glow: 'rgba(34,211,238,0.5)'  },
    warning: { ring: 'ring-amber-400/50',   text: 'text-amber-300',   fill: 'bg-amber-400',   glow: 'rgba(245,158,11,0.45)' },
    danger:  { ring: 'ring-red-400/50',     text: 'text-red-300',     fill: 'bg-red-400',     glow: 'rgba(239,68,68,0.45)'  },
    idle:    { ring: 'ring-zinc-500/50',    text: 'text-zinc-400',    fill: 'bg-zinc-500',    glow: 'rgba(113,113,122,0.3)'  },
  },
} as const

// Roman/Hermes language used in copy. Pick from these so the UX feels consistent.
export const HERMES_LEXICON = {
  controlCenter: 'Mission Control',
  fleet:         'Provider Fleet',
  legion:        'Agent Legion',
  oracle:        'Oracle Stream',
  pantheon:      'Model Pantheon',
  forum:         'Forum',
  temple:        'Temple of Memory',
  archive:       'Archive',
  scrollOfLaw:   'Edicts & Safety',
} as const

// Helper for inline radial backgrounds.
export const HERMES_BG = {
  // Deep navy radial with subtle holographic ring at top
  shell:
    'bg-[radial-gradient(ellipse_at_top,_rgba(34,211,238,0.12),_transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(217,119,6,0.05),_transparent_45%),linear-gradient(180deg,#05080F,#02050B)]',
  panel:
    'bg-[radial-gradient(ellipse_at_top_right,_rgba(34,211,238,0.08),_transparent_60%),linear-gradient(135deg,rgba(10,15,26,0.9),rgba(5,8,15,0.95))]',
  hero:
    'bg-[radial-gradient(ellipse_at_top_left,_rgba(34,211,238,0.18),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(217,119,6,0.10),_transparent_55%),linear-gradient(135deg,#070B14,#020409)]',
} as const

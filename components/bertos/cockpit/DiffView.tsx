'use client'

type DiffLine = { type: 'context' | 'add' | 'del'; text: string }

/** LCS line diff between two strings (client mirror of lib/bertos/coding/patches lineDiff). */
export function clientLineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n')
  const b = after.split('\n')
  const m = a.length
  const n = b.length
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i -= 1) {
    for (let j = n - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }
  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ type: 'context', text: a[i] }); i += 1; j += 1 }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) { out.push({ type: 'del', text: a[i] }); i += 1 }
    else { out.push({ type: 'add', text: b[j] }); j += 1 }
  }
  while (i < m) { out.push({ type: 'del', text: a[i] }); i += 1 }
  while (j < n) { out.push({ type: 'add', text: b[j] }); j += 1 }
  return out
}

/** Live before/after diff with real per-line additions/deletions. */
export function LiveDiff({ before, after, label }: { before: string; after: string; label?: string }) {
  const lines = clientLineDiff(before, after)
  const adds = lines.filter(l => l.type === 'add').length
  const dels = lines.filter(l => l.type === 'del').length
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[#070503]">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        <span>{label ?? 'live diff'}</span>
        <span><span className="text-emerald-300">+{adds}</span> <span className="text-red-300">-{dels}</span></span>
      </div>
      <pre className="max-h-72 overflow-auto p-0 text-xs leading-relaxed">
        <code className="block">
          {lines.slice(0, 400).map((line, index) => (
            <span key={index} className={'block px-3 py-px font-mono ' + (line.type === 'add' ? 'bg-emerald-500/10 text-emerald-200' : line.type === 'del' ? 'bg-red-500/10 text-red-200' : 'text-zinc-500')}>
              <span className="mr-2 select-none text-zinc-700">{line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}</span>{line.text || ' '}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

/** Readable, high-contrast diff renderer. Greens additions, reds deletions. */
export function DiffView({ diff, maxLines = 240 }: { diff: string; maxLines?: number }) {
  const lines = diff.split('\n').slice(0, maxLines)
  const truncated = diff.split('\n').length > maxLines
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[#070503]">
      <div className="border-b border-zinc-800 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">unified diff</div>
      <pre className="max-h-72 overflow-auto p-0 text-xs leading-relaxed">
        <code className="block">
          {lines.map((line, index) => {
            const isAdd = line.startsWith('+') && !line.startsWith('+++')
            const isDel = line.startsWith('-') && !line.startsWith('---')
            const isMeta = line.startsWith('@@') || line.startsWith('diff ') || line.startsWith('+++') || line.startsWith('---') || line === 'new file' || line === 'deleted file'
            return (
              <span
                key={index}
                className={
                  'block px-3 py-px font-mono ' +
                  (isAdd ? 'bg-emerald-500/10 text-emerald-200' : isDel ? 'bg-red-500/10 text-red-200' : isMeta ? 'text-amber-300/80' : 'text-zinc-400')
                }
              >
                {line || ' '}
              </span>
            )
          })}
          {truncated && <span className="block px-3 py-1 text-zinc-600">… diff truncated …</span>}
        </code>
      </pre>
    </div>
  )
}

import { CheckCircle2, FileText, Monitor, ShieldAlert, Terminal } from 'lucide-react'
import { HologramPanel, PanelHeader } from './HologramPanel'
import { MetricTile } from './MetricTile'

export function ProofOfWorkPanel({
  filesChanged,
  affectedRoutes,
  commands,
  screenshots,
  limitations,
}: {
  filesChanged: string[]
  affectedRoutes: string[]
  commands: Array<{ label: string; status: 'passed' | 'failed' | 'not-run'; detail?: string }>
  screenshots: { available: boolean; detail: string }
  limitations: string[]
}) {
  return (
    <HologramPanel tone="bronze">
      <PanelHeader
        icon={<ShieldAlert className="h-5 w-5" />}
        eyebrow="Proof required before merge"
        title="Claimed complete vs verified complete"
        subtitle="BertOS does not treat visual work as done until routes, commands, and limitations are visible."
      />
      <div className="grid gap-3 md:grid-cols-4">
        <MetricTile label="Files changed" value={filesChanged.length} icon={<FileText className="h-4 w-4" />} tone="cyan" />
        <MetricTile label="Routes affected" value={affectedRoutes.length} icon={<Monitor className="h-4 w-4" />} tone="bronze" />
        <MetricTile label="Commands tracked" value={commands.length} icon={<Terminal className="h-4 w-4" />} tone="emerald" />
        <MetricTile label="Screenshots" value={screenshots.available ? 'captured' : 'pending'} detail={screenshots.detail} tone={screenshots.available ? 'emerald' : 'amber'} />
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-cyan-300/15 bg-cyan-300/5 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-200/70">Changed files</div>
          <div className="space-y-1 text-[11px] text-zinc-400">
            {filesChanged.map(file => <div key={file} className="truncate font-mono">{file}</div>)}
          </div>
        </div>
        <div className="rounded-xl border border-emerald-300/15 bg-emerald-300/5 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200/70">Validation</div>
          <div className="space-y-2">
            {commands.map(command => (
              <div key={command.label} className="flex items-start gap-2 text-[11px] text-zinc-400">
                <CheckCircle2 className={command.status === 'passed' ? 'mt-0.5 h-3.5 w-3.5 text-emerald-300' : 'mt-0.5 h-3.5 w-3.5 text-amber-300'} />
                <span>{command.label}: {command.status}{command.detail ? ` - ${command.detail}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-amber-300/15 bg-amber-300/5 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200/70">Remaining limits</div>
          <div className="space-y-1 text-[11px] text-zinc-400">
            {limitations.map(limit => <div key={limit}>- {limit}</div>)}
          </div>
        </div>
      </div>
    </HologramPanel>
  )
}

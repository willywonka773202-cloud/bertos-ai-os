'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ClipboardCopy, Compass, Cpu, Globe2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { buildMigrationAuditPrompt } from '@/lib/bertos/command-center'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

interface ProviderStatusResponse {
  providers?: Array<{ id: string; name: string; status: string; message?: string }>
  externalAgents?: Record<string, { status?: string; message?: string; configured?: boolean }>
}

const CHECKLIST = [
  'Verify official Google documentation before changing BertOS routing.',
  'Back up CLI settings and project history before migration.',
  'Check local Gemini CLI availability and current version.',
  'Confirm whether Google Anti-Gravity CLI or Desktop is actually installed.',
  'Avoid conflicting installs and test on a small repo first.',
  'Keep Gemini CLI supported until Anti-Gravity is verified.',
  'Do not make Anti-Gravity default until local commands and billing behavior are understood.',
]

export function MigrationsView() {
  const [status, setStatus] = useState<ProviderStatusResponse | null>(null)

  useEffect(() => {
    fetch('/api/providers/status', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setStatus(data as ProviderStatusResponse))
      .catch(() => setStatus(null))
  }, [])

  const geminiCli = useMemo(() => status?.providers?.find(provider => provider.id === 'gemini-cli'), [status])
  const prompt = useMemo(() => buildMigrationAuditPrompt(), [])

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(prompt)
    toast.success('Migration audit prompt copied.')
  }

  return (
    <div className="flex h-full">
      <main className="min-w-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="mx-auto max-w-6xl space-y-5 p-6">
            <RouteHero
              eyebrow="migration augury"
              title="Migration Center"
              subtitle="Plan provider migrations without breaking BertOS routing. Anti-Gravity remains planned/experimental until docs, local command detection, and billing behavior are verified."
              status={status ? 'nominal' : 'loading'}
              seal={<Compass className="h-5 w-5" />}
              metrics={[
                { label: 'Gemini CLI', value: geminiCli?.status ?? 'unknown', detail: geminiCli?.message ?? 'current provider path', tone: geminiCli?.status === 'online' ? 'emerald' : 'amber' },
                { label: 'Anti-Gravity', value: 'planned', detail: 'not default', tone: 'bronze' },
                { label: 'Checklist', value: CHECKLIST.length, detail: 'pre-flight items', tone: 'cyan' },
                { label: 'Mode', value: 'audit only', detail: 'copy prompt, no live migration', tone: 'zinc' },
              ]}
            />
            <ChamberCard tone="bronze">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <Compass className="h-5 w-5 text-blue-400" />
                    <h1 className="text-2xl font-bold text-zinc-100">Migration Center</h1>
                  </div>
                  <p className="max-w-3xl text-sm leading-relaxed text-zinc-500">
                    Manage the Gemini CLI to Google Anti-Gravity transition without breaking BertOS provider routing.
                    Anti-Gravity is treated as planned/experimental until official docs and local command detection confirm it.
                  </p>
                </div>
                <Badge variant="warning">not default</Badge>
              </div>
            </ChamberCard>

            <section className="grid gap-4 lg:grid-cols-3">
              <ChamberCard tone="cyan">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Globe2 className="h-4 w-4 text-blue-400" />
                    <h2 className="text-sm font-semibold text-zinc-100">Gemini CLI</h2>
                  </div>
                  <Badge variant={geminiCli?.status === 'online' ? 'success' : 'default'} className="text-[10px]">
                    {geminiCli?.status ?? 'unknown'}
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-zinc-500">
                  Current/legacy CLI provider. Keep it supported until the migration path is verified.
                </p>
                {geminiCli?.message && <p className="mt-2 text-[11px] text-zinc-600">{geminiCli.message}</p>}
              </ChamberCard>

              <ChamberCard tone="amber">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-amber-300" />
                    <h2 className="text-sm font-semibold text-amber-100">Google Anti-Gravity CLI</h2>
                  </div>
                  <Badge variant="warning" className="text-[10px]">planned</Badge>
                </div>
                <p className="text-xs leading-relaxed text-amber-200/75">
                  Planned/experimental. BertOS does not assume it is installed and does not route to it by default.
                </p>
              </ChamberCard>

              <ChamberCard tone="zinc">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <h2 className="text-sm font-semibold text-zinc-100">Managed Agents API</h2>
                  </div>
                  <Badge variant="default" className="text-[10px]">future</Badge>
                </div>
                <p className="text-xs leading-relaxed text-zinc-500">
                  Future cloud sandbox concept. No live paid calls, no default routing, and no replacement for the local daemon.
                </p>
              </ChamberCard>
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
              <ChamberCard tone="cyan">
                <div className="mb-3 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                  <h2 className="text-sm font-semibold text-zinc-100">Migration checklist</h2>
                </div>
                <div className="space-y-2">
                  {CHECKLIST.map((item, index) => (
                    <div key={item} className="flex gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[11px] font-semibold text-blue-300">{index + 1}</div>
                      <p className="text-sm text-zinc-400">{item}</p>
                    </div>
                  ))}
                </div>
              </ChamberCard>

              <aside className="space-y-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="text-sm font-semibold text-zinc-100">Routing impact</h3>
                  <div className="mt-3 space-y-2 text-xs leading-relaxed text-zinc-500">
                    <p>Gemini CLI remains supported.</p>
                    <p>Anti-Gravity is planned/experimental and not default.</p>
                    <p>Google Managed Agents are future cloud infrastructure, not local file editing.</p>
                    <p>Paid calls must be explicitly enabled before any cloud runtime is used.</p>
                  </div>
                </div>
                <Button onClick={() => void copyPrompt()} className="w-full">
                  <ClipboardCopy className="h-4 w-4" />Copy migration audit prompt
                </Button>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-relaxed text-amber-200/75">
                  YouTube or transcript claims are not treated as source of truth. Verify official Google docs and local commands before changing routing.
                </div>
              </aside>
            </section>

            <ChamberCard tone="zinc">
              <div className="mb-2 text-sm font-semibold text-zinc-100">Audit prompt preview</div>
              <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-black/40 p-3 text-xs leading-relaxed text-zinc-500">
                {prompt}
              </pre>
            </ChamberCard>
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}

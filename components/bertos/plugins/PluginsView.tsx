'use client'
import { useEffect, useState } from 'react'
import { Cable, CheckCircle2, Lock, Puzzle, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

type Plugin = {
  id: string
  mention: string
  name: string
  purpose: string
  credentialsRequired: string[]
  tools: Array<{ id: string; name: string; risk: string }>
  relatedSkills: string[]
  permissions: string[]
  setupStatus: string
  safetyRules: string[]
  exampleUse: string
  degradedMode: string
}

export function PluginsView() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const load = async () => {
    const data = await fetch('/api/bertos/plugins', { cache: 'no-store' }).then(res => res.json())
    setPlugins(data.plugins ?? [])
  }
  useEffect(() => { void load() }, [])
  const ready = plugins.filter(plugin => plugin.setupStatus === 'ready').length
  const testPlugin = async (plugin: Plugin) => {
    const data = await fetch(`/api/bertos/plugins/${plugin.id}`, { cache: 'no-store' }).then(res => res.json())
    if (!data.ok) {
      setNotice(data.error ?? `${plugin.mention} setup check failed.`)
      return
    }
    setNotice(data.setup.ok
      ? `${plugin.mention} is ready.`
      : `${plugin.mention} is ${data.setup.status}; degraded mode: ${data.setup.degradedMode}`)
  }
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <RouteHero
          eyebrow="capabilities"
          title="Plugin Registry"
          subtitle="Tool/API/capability bundles invoked with @mentions. Missing integrations stay setup-required or degraded instead of pretending to run."
          seal={<Puzzle className="h-5 w-5" />}
          status="nominal"
          metrics={[
            { label: 'Plugins', value: plugins.length, detail: 'capability bundles', tone: 'cyan' },
            { label: 'Ready', value: ready, detail: 'local or configured', tone: 'emerald' },
            { label: 'Setup Required', value: plugins.length - ready, detail: 'honest gates', tone: 'amber' },
            { label: 'Tools', value: plugins.reduce((sum, plugin) => sum + plugin.tools.length, 0), detail: 'declared actions', tone: 'bronze' },
          ]}
        />
        <div className="mb-4 flex justify-end"><Button size="sm" variant="secondary" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button></div>
        {notice && <ChamberCard tone="cyan" className="mb-4 p-3 text-sm text-cyan-100">{notice}</ChamberCard>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {plugins.map(plugin => (
            <ChamberCard key={plugin.id} tone={plugin.setupStatus === 'ready' ? 'emerald' : plugin.setupStatus === 'planned' ? 'zinc' : 'amber'} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Cable className="h-4 w-4 text-sky-300" />
                    <h2 className="font-semibold text-zinc-100">{plugin.name}</h2>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">{plugin.mention}</p>
                </div>
                <Badge variant={plugin.setupStatus === 'ready' ? 'success' : plugin.setupStatus === 'planned' ? 'default' : 'warning'}>{plugin.setupStatus}</Badge>
              </div>
              <p className="mt-3 text-sm text-zinc-400">{plugin.purpose}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">{plugin.permissions.slice(0, 5).map(permission => <Badge key={permission} variant="default">{permission}</Badge>)}</div>
              <div className="mt-3 rounded-lg border border-zinc-800 bg-black/20 p-2 text-xs text-zinc-500">
                <div className="mb-1 flex items-center gap-1.5 text-zinc-300"><Lock className="h-3 w-3" /> Credentials</div>
                {plugin.credentialsRequired.join(', ') || 'None'}
              </div>
              <div className="mt-3 text-xs text-amber-200"><ShieldAlert className="mr-1 inline h-3 w-3" /> {plugin.degradedMode}</div>
              <div className="mt-3 text-xs text-zinc-500"><CheckCircle2 className="mr-1 inline h-3 w-3" /> {plugin.exampleUse}</div>
              <div className="mt-3">
                <Button size="sm" variant="secondary" onClick={() => testPlugin(plugin)}>
                  <CheckCircle2 className="h-3.5 w-3.5" /> Test Setup
                </Button>
              </div>
            </ChamberCard>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}

'use client'
import { useEffect, useState } from 'react'
import { Inbox, MailPlus, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

type Plugin = {
  id: string
  mention: string
  name: string
  setupStatus: string
  credentialsRequired: string[]
  degradedMode: string
  safetyRules: string[]
}

export function InboxDealsView() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    const data = await fetch('/api/bertos/plugins', { cache: 'no-store' }).then(res => res.json())
    setPlugins((data.plugins ?? []).filter((plugin: Plugin) => ['gmail', 'calendar'].includes(plugin.id)))
  }

  useEffect(() => { void load() }, [])

  const saveLocalDigest = async () => {
    const data = await fetch('/api/bertos/outputs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'email_priority_table',
        title: 'Inbox / Deals Local Digest',
        content: '# Inbox / Deals Local Digest\n\nGmail and Calendar connectors are setup-required. No inbox was read, no email was sent, and no event was scheduled.',
        pluginIds: ['gmail', 'calendar', 'outputs'],
        tags: ['inbox-deals', 'local-fallback'],
        status: 'draft',
        metadata: { mode: 'local-fallback', externalActionsExecuted: false },
      }),
    }).then(res => res.json())
    setNotice(data.ok ? `Saved local fallback digest ${data.output.outputId}.` : data.error ?? 'Could not save digest.')
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <RouteHero
          eyebrow="sponsorship ops"
          title="Inbox / Deals"
          subtitle="Brand-deal triage, reply drafts, and meeting-window planning stay local fallback until Gmail and Calendar connectors are explicitly configured."
          seal={<Inbox className="h-5 w-5" />}
          status="nominal"
          metrics={[
            { label: 'Connectors', value: plugins.length, detail: 'declared', tone: 'cyan' },
            { label: 'Ready', value: plugins.filter(plugin => plugin.setupStatus === 'ready').length, detail: 'verified', tone: 'emerald' },
            { label: 'Send Email', value: 'blocked', detail: 'approval required', tone: 'amber' },
            { label: 'Schedule', value: 'blocked', detail: 'approval required', tone: 'amber' },
          ]}
        />
        <div className="mb-4 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          <Button size="sm" onClick={saveLocalDigest}><MailPlus className="h-3.5 w-3.5" /> Save Local Digest</Button>
        </div>
        {notice && <ChamberCard tone="cyan" className="mb-4 p-3 text-sm text-cyan-100">{notice}</ChamberCard>}
        <div className="grid gap-3 md:grid-cols-2">
          {plugins.map(plugin => (
            <ChamberCard key={plugin.id} tone={plugin.setupStatus === 'ready' ? 'emerald' : 'amber'} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-zinc-100">{plugin.name}</h2>
                  <p className="mt-1 text-xs text-zinc-500">{plugin.mention}</p>
                </div>
                <Badge variant={plugin.setupStatus === 'ready' ? 'success' : 'warning'}>{plugin.setupStatus}</Badge>
              </div>
              <div className="mt-3 rounded-lg border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-400">
                <div className="mb-1 font-semibold text-zinc-200">Required Setup</div>
                {plugin.credentialsRequired.join(', ') || 'None'}
              </div>
              <p className="mt-3 text-xs text-amber-200"><ShieldAlert className="mr-1 inline h-3 w-3" /> {plugin.degradedMode}</p>
              <div className="mt-3 space-y-1">
                {plugin.safetyRules.slice(0, 3).map(rule => <p key={rule} className="text-xs text-zinc-500">{rule}</p>)}
              </div>
            </ChamberCard>
          ))}
        </div>
      </div>
    </ScrollArea>
  )
}

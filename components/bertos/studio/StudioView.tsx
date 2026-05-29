'use client'
import { useEffect, useState } from 'react'
import { Check, Film, ImageIcon, Lock, Music, Plus, RefreshCw, Sparkles, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChamberCard, RouteHero } from '@/components/bertos/hermes'

const PLACEHOLDERS = [
  { title: 'Image Grid', type: 'image', icon: ImageIcon, status: 'local placeholder' },
  { title: 'Thumbnail Concepts', type: 'thumbnail', icon: Sparkles, status: 'agent-ready schema' },
  { title: 'Motion Compositions', type: 'video', icon: Film, status: 'setup required' },
  { title: 'Audio / Sound', type: 'audio', icon: Music, status: 'setup required' },
]

type StudioAsset = {
  assetId: string
  type: string
  prompt?: string
  model?: string
  provider?: string
  preview?: string
  favorite: boolean
  collection?: string
  status: string
  createdBy: 'human' | 'agent'
  createdAt: string
}

export function StudioView() {
  const [assets, setAssets] = useState<StudioAsset[]>([])
  const [prompt, setPrompt] = useState('Cinematic BertOS creator OS thumbnail, dark interface, bright artifact grid, premium software feel')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const load = async () => {
    const data = await fetch('/api/bertos/studio/assets', { cache: 'no-store' }).then(res => res.json())
    setAssets(data.assets ?? [])
  }

  useEffect(() => { void load() }, [])

  const createFour = async () => {
    setBusy(true)
    setNotice(null)
    const variants = ['wide product hero', 'face-safe creator thumbnail', 'minimal UI grid', 'high-contrast launch visual']
    try {
      await Promise.all(variants.map((variant, index) => fetch('/api/bertos/studio/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: index === 1 ? 'thumbnail' : 'image',
          prompt: `${prompt}. Variant: ${variant}.`,
          provider: 'local-placeholder',
          model: 'setup-required',
          preview: variant,
          collection: 'generated-options',
          status: 'generated',
          createdBy: 'agent',
          metadata: { generationMode: 'local-placeholder', requiresPaidApiApproval: false },
        }),
      })))
      setNotice('Created four local Studio prompt cards. No paid generation API was called.')
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Studio asset creation failed.')
    } finally {
      setBusy(false)
    }
  }

  const updateAsset = async (asset: StudioAsset, patch: Partial<StudioAsset>) => {
    const data = await fetch(`/api/bertos/studio/assets/${asset.assetId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }).then(res => res.json())
    if (data.ok) {
      setNotice(`${asset.type} asset updated.`)
      await load()
    }
  }

  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-6xl px-6 py-4">
        <RouteHero
          eyebrow="creator studio"
          title="Studio Mini-App"
          subtitle="Shared human-agent asset workspace for generated media, references, thumbnails, motion compositions, and publishing-ready assets. External generators remain setup-gated."
          seal={<Sparkles className="h-5 w-5" />}
          status="idle"
          metrics={[
            { label: 'Assets', value: assets.length, detail: 'local records', tone: 'emerald' },
            { label: 'FAL', value: 'setup', detail: 'paid-gated', tone: 'amber' },
            { label: 'Remotion', value: 'planned', detail: 'verify install', tone: 'zinc' },
            { label: 'Human Review', value: 'required', detail: 'final 10%', tone: 'bronze' },
          ]}
        />
        <ChamberCard tone="cyan" className="mb-4 p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">Create Four Local Options</h2>
              <p className="mt-1 text-xs text-zinc-500">Agent and human share the same grid. This saves prompt cards only until a paid media plugin is configured and approved.</p>
            </div>
            <Button size="sm" variant="secondary" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
          </div>
          <textarea value={prompt} onChange={event => setPrompt(event.target.value)} className="min-h-20 w-full rounded-lg border border-zinc-800 bg-black/30 p-3 text-sm text-zinc-200 outline-none" />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" onClick={createFour} disabled={busy || !prompt.trim()}><Plus className="h-3.5 w-3.5" /> Create 4 Prompt Cards</Button>
            {notice && <span className="self-center text-xs text-cyan-100">{notice}</span>}
          </div>
        </ChamberCard>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {PLACEHOLDERS.map(item => {
            const Icon = item.icon
            return (
              <ChamberCard key={item.title} tone={item.status.includes('setup') ? 'amber' : 'zinc'} className="p-4">
                <div className="flex items-center justify-between">
                  <Icon className="h-5 w-5 text-sky-300" />
                  <Badge variant={item.status.includes('setup') ? 'warning' : 'default'}>{item.status}</Badge>
                </div>
                <h2 className="mt-3 font-semibold text-zinc-100">{item.title}</h2>
                <p className="mt-1 text-xs text-zinc-500">Agents can create records for this asset type; real generation requires a configured plugin and approval.</p>
              </ChamberCard>
            )
          })}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {assets.map(asset => (
            <ChamberCard key={asset.assetId} tone={asset.favorite ? 'bronze' : asset.status === 'final' ? 'emerald' : 'zinc'} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge variant={asset.status === 'final' ? 'success' : asset.status === 'selected' ? 'warning' : 'default'}>{asset.type}</Badge>
                  <h2 className="mt-3 text-sm font-semibold text-zinc-100">{asset.preview ?? asset.collection ?? asset.type}</h2>
                </div>
                {asset.favorite && <Star className="h-4 w-4 fill-amber-300 text-amber-300" />}
              </div>
              <p className="mt-2 line-clamp-5 text-xs leading-relaxed text-zinc-500">{asset.prompt ?? 'No prompt stored.'}</p>
              <p className="mt-3 text-[10px] uppercase tracking-wide text-zinc-600">{asset.provider ?? 'local'} · {asset.createdBy}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => updateAsset(asset, { favorite: !asset.favorite })}>
                  <Star className="h-3.5 w-3.5" /> {asset.favorite ? 'Unfavorite' : 'Favorite'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => updateAsset(asset, { status: asset.status === 'final' ? 'selected' : 'final' })}>
                  <Check className="h-3.5 w-3.5" /> {asset.status === 'final' ? 'Unfinal' : 'Finalize'}
                </Button>
              </div>
            </ChamberCard>
          ))}
        </div>
        {!assets.length && <ChamberCard tone="zinc" className="mt-4 p-6 text-sm text-zinc-500">No Studio assets yet. Create four prompt cards to simulate the human-agent selection workflow locally.</ChamberCard>}
        <ChamberCard tone="amber" className="mt-4 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-100"><Lock className="h-4 w-4" /> Safety and Consent</div>
          <p className="mt-2 text-sm text-zinc-400">Paid media APIs, likeness/persona generation, publishing, and external uploads are disabled until explicitly configured and approved. Local placeholder assets and prompt cards can be saved through the Output Registry.</p>
        </ChamberCard>
      </div>
    </ScrollArea>
  )
}

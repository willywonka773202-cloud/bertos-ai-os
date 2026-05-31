'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { Bot, Code2, MessageSquare, Radio, ShieldCheck, Sparkles, Swords, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/bertos/cn'

type ArenaLane = 'oracle' | 'forge' | 'legion'

const laneConfig: Record<ArenaLane, { label: string; verb: string; color: string; glow: string; icon: ReactNode }> = {
  oracle: {
    label: 'Oracle',
    verb: 'Route prompt',
    color: '#7ABCD6',
    glow: 'rgba(122,188,214,0.30)',
    icon: <MessageSquare className="h-4 w-4" />,
  },
  forge: {
    label: 'Forge',
    verb: 'Temper patch',
    color: '#F6C453',
    glow: 'rgba(246,196,83,0.30)',
    icon: <Code2 className="h-4 w-4" />,
  },
  legion: {
    label: 'Legion',
    verb: 'Dispatch agent',
    color: '#86C9A0',
    glow: 'rgba(134,201,160,0.28)',
    icon: <Bot className="h-4 w-4" />,
  },
}

interface MissionArenaProps {
  providersOnline: number
  providersTotal: number
  activeAgents: number
  automationRunning: number
  chatStreaming: boolean
  daemonOnline: boolean
  xp: number
  rankTitle: string
  onOpenOracle: () => void
  onOpenBuilder: () => void
  onOpenAgents: () => void
}

export function MissionArena({
  providersOnline,
  providersTotal,
  activeAgents,
  automationRunning,
  chatStreaming,
  daemonOnline,
  xp,
  rankTitle,
  onOpenOracle,
  onOpenBuilder,
  onOpenAgents,
}: MissionArenaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const laneRef = useRef<ArenaLane>('oracle')
  const surgeRef = useRef(0)
  const [activeLane, setActiveLane] = useState<ArenaLane>('oracle')
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(1)

  const livePressure = useMemo(() => {
    const providerRatio = providersTotal ? providersOnline / providersTotal : 0
    return Math.min(1, providerRatio * 0.42 + activeAgents * 0.14 + automationRunning * 0.16 + (chatStreaming ? 0.22 : 0) + (daemonOnline ? 0.12 : 0))
  }, [activeAgents, automationRunning, chatStreaming, daemonOnline, providersOnline, providersTotal])

  useEffect(() => {
    laneRef.current = activeLane
  }, [activeLane])

  useEffect(() => {
    const canvas = canvasRef.current
    const parent = canvas?.parentElement
    if (!canvas || !parent) return

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(0, 1.8, 8.4)

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    scene.add(new THREE.AmbientLight(0xf0e8d0, 0.82))
    const keyLight = new THREE.PointLight(0xf6c453, 3.2, 18)
    keyLight.position.set(-2.5, 4, 4)
    scene.add(keyLight)
    const rimLight = new THREE.PointLight(0x7abcd6, 2.4, 16)
    rimLight.position.set(3.5, 1.8, 3.8)
    scene.add(rimLight)

    const coreGroup = new THREE.Group()
    scene.add(coreGroup)

    const coreMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xd4b483,
      emissive: 0x3a2410,
      metalness: 0.64,
      roughness: 0.24,
      clearcoat: 0.45,
    })
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 2), coreMaterial)
    coreGroup.add(core)

    const wire = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.16, 1),
      new THREE.MeshBasicMaterial({ color: 0xf0e8d0, wireframe: true, transparent: true, opacity: 0.20 }),
    )
    coreGroup.add(wire)

    const ringMaterials = [
      new THREE.MeshBasicMaterial({ color: 0x7abcd6, transparent: true, opacity: 0.44 }),
      new THREE.MeshBasicMaterial({ color: 0xf6c453, transparent: true, opacity: 0.38 }),
      new THREE.MeshBasicMaterial({ color: 0x86c9a0, transparent: true, opacity: 0.34 }),
    ]
    const rings = ringMaterials.map((material, index) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7 + index * 0.36, 0.012, 12, 132), material)
      ring.rotation.set(index * 0.55, index * 0.9, index * 0.42)
      coreGroup.add(ring)
      return ring
    })

    const nodeGeometry = new THREE.SphereGeometry(0.08, 18, 18)
    const nodes = Array.from({ length: 18 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 3 === 0 ? 0x7abcd6 : index % 3 === 1 ? 0xf6c453 : 0x86c9a0,
        transparent: true,
        opacity: 0.78,
      })
      const node = new THREE.Mesh(nodeGeometry, material)
      coreGroup.add(node)
      return node
    })

    const packetGeometry = new THREE.SphereGeometry(0.045, 12, 12)
    const packets = Array.from({ length: 54 }, (_, index) => {
      const material = new THREE.MeshBasicMaterial({
        color: index % 4 === 0 ? 0xf0e8d0 : index % 4 === 1 ? 0x7abcd6 : index % 4 === 2 ? 0xf6c453 : 0x86c9a0,
        transparent: true,
        opacity: 0.46,
      })
      const packet = new THREE.Mesh(packetGeometry, material)
      scene.add(packet)
      return packet
    })

    const grid = new THREE.GridHelper(9, 18, 0xd4b483, 0x2c2418)
    grid.position.y = -2.15
    const gridMaterial = grid.material as THREE.Material
    gridMaterial.opacity = 0.18
    gridMaterial.transparent = true
    scene.add(grid)

    const resize = () => {
      const rect = parent.getBoundingClientRect()
      const width = Math.max(1, Math.floor(rect.width))
      const height = Math.max(1, Math.floor(rect.height))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(parent)

    let frame = 0
    let stopped = false
    const startedAt = performance.now()

    const animate = () => {
      if (stopped) return
      const elapsed = (performance.now() - startedAt) / 1000
      const lane = laneRef.current
      const laneColor = new THREE.Color(laneConfig[lane].color)
      const surge = surgeRef.current
      surgeRef.current = Math.max(0, surge - 0.018)

      const speed = 0.34 + livePressure * 0.42 + surge * 0.42
      core.rotation.x = elapsed * 0.16
      core.rotation.y = elapsed * (0.25 + speed * 0.3)
      wire.rotation.y = -elapsed * (0.18 + speed * 0.22)
      wire.rotation.z = elapsed * 0.12
      core.scale.setScalar(1 + Math.sin(elapsed * 2.6) * 0.025 + surge * 0.055)
      coreMaterial.emissive.copy(laneColor).multiplyScalar(0.16 + livePressure * 0.18 + surge * 0.28)

      rings.forEach((ring, index) => {
        ring.rotation.x += (0.002 + index * 0.0018) * (1 + speed)
        ring.rotation.y += (0.003 + index * 0.0012) * (1 + speed)
        ring.material.color.lerp(laneColor, 0.035)
        ring.material.opacity = 0.28 + livePressure * 0.18 + surge * 0.20 - index * 0.035
      })

      nodes.forEach((node, index) => {
        const offset = index / nodes.length
        const radius = 2.18 + (index % 3) * 0.34 + surge * 0.28
        const angle = elapsed * (0.38 + (index % 5) * 0.035 + speed * 0.22) + offset * Math.PI * 2
        node.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle * 1.7) * 0.48,
          Math.sin(angle) * radius * 0.45,
        )
        node.scale.setScalar(1 + livePressure * 0.75 + surge * 1.2)
      })

      packets.forEach((packet, index) => {
        const offset = index / packets.length
        const laneOffset = lane === 'oracle' ? -1.2 : lane === 'forge' ? 0 : 1.2
        const phase = (elapsed * (0.10 + speed * 0.16) + offset) % 1
        const x = THREE.MathUtils.lerp(-4.4, 4.4, phase)
        const arc = Math.sin(phase * Math.PI)
        packet.position.set(x, -1.15 + arc * (1.4 + livePressure * 0.8) + laneOffset * 0.22, Math.sin(phase * Math.PI * 2 + index) * 0.45)
        packet.scale.setScalar(0.75 + arc * 1.7 + surge * 1.4)
        ;(packet.material as THREE.MeshBasicMaterial).color.lerp(laneColor, 0.05)
        ;(packet.material as THREE.MeshBasicMaterial).opacity = 0.24 + arc * 0.46 + surge * 0.20
      })

      keyLight.color.lerp(laneColor, 0.045)
      rimLight.intensity = 1.8 + livePressure * 2 + surge * 2.2
      grid.rotation.y = elapsed * 0.025
      renderer.render(scene, camera)
      frame = window.requestAnimationFrame(animate)
    }

    if (prefersReducedMotion) {
      renderer.render(scene, camera)
    } else {
      frame = window.requestAnimationFrame(animate)
    }

    return () => {
      stopped = true
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      renderer.dispose()
      core.geometry.dispose()
      wire.geometry.dispose()
      rings.forEach(ring => ring.geometry.dispose())
      nodeGeometry.dispose()
      packetGeometry.dispose()
      grid.geometry.dispose()
      ;[coreMaterial, wire.material, ...ringMaterials, ...nodes.map(node => node.material), ...packets.map(packet => packet.material), gridMaterial].forEach(material => {
        if (Array.isArray(material)) material.forEach(item => item.dispose())
        else material.dispose()
      })
    }
  }, [livePressure])

  const runLane = (lane: ArenaLane) => {
    setActiveLane(lane)
    setScore(current => current + (lane === 'legion' ? 18 : lane === 'forge' ? 14 : 10) * combo)
    setCombo(current => Math.min(9, current + 1))
    surgeRef.current = 1
    window.setTimeout(() => setCombo(current => Math.max(1, current - 1)), 1800)
  }

  const activityState = chatStreaming
    ? 'oracle streaming'
    : activeAgents > 0
      ? `${activeAgents} agent${activeAgents === 1 ? '' : 's'} active`
      : automationRunning > 0
        ? `${automationRunning} automation${automationRunning === 1 ? '' : 's'} running`
        : daemonOnline
          ? 'daemon live'
          : 'standby'

  return (
    <section className="relative isolate min-h-[520px] overflow-hidden rounded-none border-y border-[rgba(212,180,131,0.14)] bg-[#060403]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_55%_at_50%_5%,rgba(122,188,214,0.12),transparent_58%),radial-gradient(circle_at_18%_80%,rgba(246,196,83,0.12),transparent_28%),linear-gradient(160deg,rgba(7,5,3,0.20),rgba(2,1,1,0.76))]" />
      <div
        className="absolute inset-0 transition-colors duration-500"
        style={{ boxShadow: `inset 0 0 120px ${laneConfig[activeLane].glow}` }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="3D AI mission arena" />

      <div className="pointer-events-none absolute inset-0 hermes-grid opacity-20" />
      <div className="relative z-10 grid min-h-[520px] gap-6 px-4 py-5 md:px-6 xl:grid-cols-[minmax(280px,0.62fr)_minmax(360px,0.38fr)] xl:items-end">
        <div className="flex h-full min-h-0 flex-col justify-between gap-6">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-sm border border-[rgba(122,188,214,0.24)] bg-[rgba(122,188,214,0.08)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-100/80">
                <Radio className="h-3.5 w-3.5" />
                live mission arena
              </span>
              <span className="inline-flex items-center gap-2 rounded-sm border border-[rgba(212,180,131,0.22)] bg-[rgba(212,180,131,0.07)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#D4B483]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {activityState}
              </span>
            </div>
            <h2 className="max-w-3xl text-3xl font-semibold tracking-normal text-[#F0E8D0] md:text-5xl">
              Command the AI engine like a playable operations arena.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9A8A68] md:text-base">
              Provider signals, daemon status, active agents, automations, and Oracle streams move through the core in real time.
            </p>
          </div>

          <div className="grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
            <ArenaStat label="Rank" value={rankTitle} />
            <ArenaStat label="XP" value={xp.toLocaleString()} />
            <ArenaStat label="Arena score" value={score.toLocaleString()} />
            <ArenaStat label="Combo" value={`${combo}x`} />
          </div>
        </div>

        <div className="pointer-events-auto ml-auto w-full max-w-md rounded-xl border border-[rgba(212,180,131,0.16)] bg-[rgba(8,6,4,0.72)] p-4 shadow-[0_24px_80px_rgba(0,0,0,0.34)] backdrop-blur-xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[rgba(212,180,131,0.58)]">tactical lanes</div>
              <h3 className="mt-1 text-base font-semibold text-[#F0E8D0]">{laneConfig[activeLane].label} channel armed</h3>
            </div>
            <Swords className="h-5 w-5 text-[#D4B483]" />
          </div>

          <div className="grid gap-2">
            {(Object.keys(laneConfig) as ArenaLane[]).map(lane => (
              <button
                key={lane}
                onClick={() => runLane(lane)}
                className={cn(
                  'flex min-h-12 items-center justify-between rounded-lg border px-3 py-2 text-left transition',
                  activeLane === lane
                    ? 'border-[rgba(240,232,208,0.34)] bg-[rgba(212,180,131,0.12)]'
                    : 'border-[rgba(212,180,131,0.12)] bg-[rgba(10,8,6,0.52)] hover:border-[rgba(212,180,131,0.28)] hover:bg-[rgba(212,180,131,0.07)]',
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[rgba(212,180,131,0.18)]" style={{ color: laneConfig[lane].color }}>
                    {laneConfig[lane].icon}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[#E8DDB8]">{laneConfig[lane].verb}</span>
                    <span className="block text-[11px] text-[#6A5A3A]">{laneConfig[lane].label} lane</span>
                  </span>
                </span>
                <Sparkles className="h-4 w-4 shrink-0 text-[#D4B483]" />
              </button>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Button size="sm" onClick={onOpenOracle} className="gap-1.5 border border-[rgba(122,188,214,0.26)] bg-[rgba(122,188,214,0.10)] text-cyan-100 hover:bg-[rgba(122,188,214,0.18)]">
              <MessageSquare className="h-3.5 w-3.5" />
              Oracle
            </Button>
            <Button size="sm" onClick={onOpenBuilder} className="gap-1.5 border border-[rgba(246,196,83,0.26)] bg-[rgba(246,196,83,0.10)] text-amber-100 hover:bg-[rgba(246,196,83,0.18)]">
              <Zap className="h-3.5 w-3.5" />
              Forge
            </Button>
            <Button size="sm" onClick={onOpenAgents} className="gap-1.5 border border-[rgba(134,201,160,0.24)] bg-[rgba(134,201,160,0.10)] text-emerald-100 hover:bg-[rgba(134,201,160,0.18)]">
              <Bot className="h-3.5 w-3.5" />
              Agents
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function ArenaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-h-20 rounded-lg border border-[rgba(212,180,131,0.16)] bg-[rgba(8,6,4,0.66)] p-3 backdrop-blur-md">
      <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#6A5A3A]">{label}</div>
      <div className="mt-2 truncate text-lg font-semibold text-[#F0E8D0]">{value}</div>
    </div>
  )
}

'use client'

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { MythicStageVariant } from './Mythic3DStage'

const VARIANT_PALETTES: Record<MythicStageVariant, { primary: string; secondary: string; accent: string }> = {
  home: { primary: '#f6c453', secondary: '#67e8f9', accent: '#8b5cf6' },
  dashboard: { primary: '#f6c453', secondary: '#67e8f9', accent: '#86c9a0' },
  agents: { primary: '#67e8f9', secondary: '#8b5cf6', accent: '#f6c453' },
  terminal: { primary: '#86c9a0', secondary: '#67e8f9', accent: '#f6c453' },
  files: { primary: '#f6c453', secondary: '#f0e8d0', accent: '#67e8f9' },
  settings: { primary: '#f0e8d0', secondary: '#f6c453', accent: '#67e8f9' },
  memory: { primary: '#8b5cf6', secondary: '#f6c453', accent: '#67e8f9' },
  automation: { primary: '#67e8f9', secondary: '#f6c453', accent: '#8b5cf6' },
  generic: { primary: '#f6c453', secondary: '#67e8f9', accent: '#8b5cf6' },
}

export function OlympusThreeField({ variant }: { variant: MythicStageVariant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const host = canvas?.parentElement
    if (!canvas || !host) return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const palette = VARIANT_PALETTES[variant] ?? VARIANT_PALETTES.generic
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    const clock = new THREE.Clock()
    const group = new THREE.Group()
    const geometries: THREE.BufferGeometry[] = []
    const materials: THREE.Material[] = []

    const trackGeometry = <T extends THREE.BufferGeometry>(geometry: T) => {
      geometries.push(geometry)
      return geometry
    }

    const trackMaterial = <T extends THREE.Material>(material: T) => {
      materials.push(material)
      return material
    }

    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    camera.position.set(0, 0.2, 8.4)
    scene.add(group)

    scene.add(new THREE.AmbientLight(0xffffff, 0.42))
    const keyLight = new THREE.PointLight(new THREE.Color(palette.primary), 2.2, 18)
    keyLight.position.set(-3.8, 3.1, 4.6)
    scene.add(keyLight)
    const rimLight = new THREE.PointLight(new THREE.Color(palette.secondary), 1.8, 16)
    rimLight.position.set(4.2, -1.4, 4.2)
    scene.add(rimLight)

    const core = new THREE.Mesh(
      trackGeometry(new THREE.IcosahedronGeometry(1.08, 2)),
      trackMaterial(new THREE.MeshStandardMaterial({
        color: new THREE.Color(palette.primary),
        emissive: new THREE.Color(palette.accent),
        emissiveIntensity: 0.18,
        metalness: 0.55,
        roughness: 0.28,
        transparent: true,
        opacity: 0.82,
        wireframe: true,
      })),
    )
    core.position.set(0.18, -0.05, -0.2)
    group.add(core)

    const ringGeometry = trackGeometry(new THREE.TorusGeometry(2.25, 0.012, 8, 144))
    const ringMaterial = trackMaterial(new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette.secondary),
      transparent: true,
      opacity: 0.48,
    }))

    const ringAngles = [
      [Math.PI / 2.5, 0, 0.24],
      [Math.PI / 2.2, Math.PI / 3.1, -0.22],
      [Math.PI / 2.8, -Math.PI / 2.9, 0.38],
    ]

    for (const [x, y, z] of ringAngles) {
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.rotation.set(x, y, z)
      group.add(ring)
    }

    const nodeGeometry = trackGeometry(new THREE.SphereGeometry(0.055, 16, 16))
    const nodeMaterials = [
      trackMaterial(new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.primary), emissive: new THREE.Color(palette.primary), emissiveIntensity: 0.65 })),
      trackMaterial(new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.secondary), emissive: new THREE.Color(palette.secondary), emissiveIntensity: 0.55 })),
      trackMaterial(new THREE.MeshStandardMaterial({ color: new THREE.Color(palette.accent), emissive: new THREE.Color(palette.accent), emissiveIntensity: 0.48 })),
    ]
    const nodeGroup = new THREE.Group()
    for (let index = 0; index < 14; index += 1) {
      const theta = (index / 14) * Math.PI * 2
      const radius = index % 2 === 0 ? 2.36 : 1.72
      const node = new THREE.Mesh(nodeGeometry, nodeMaterials[index % nodeMaterials.length])
      node.position.set(Math.cos(theta) * radius, Math.sin(theta) * 0.68, Math.sin(theta) * radius * 0.34)
      nodeGroup.add(node)
    }
    nodeGroup.rotation.x = Math.PI / 4.8
    group.add(nodeGroup)

    const resize = () => {
      const width = Math.max(1, host.clientWidth)
      const height = Math.max(1, host.clientHeight)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    let frame = 0
    const render = () => {
      const time = clock.getElapsedTime()
      group.rotation.y = time * 0.09
      group.rotation.x = Math.sin(time * 0.25) * 0.08
      core.rotation.x = time * 0.22
      core.rotation.z = time * 0.16
      nodeGroup.rotation.z = time * -0.13
      renderer.render(scene, camera)
      if (!reduceMotion) frame = window.requestAnimationFrame(render)
    }

    resize()
    render()
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    resizeObserver?.observe(host)
    window.addEventListener('resize', resize)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      resizeObserver?.disconnect()
      window.removeEventListener('resize', resize)
      geometries.forEach(geometry => geometry.dispose())
      materials.forEach(material => material.dispose())
      renderer.dispose()
    }
  }, [variant])

  return <canvas ref={canvasRef} className="olympus-three-field" aria-hidden="true" />
}

import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BertOS AI OS',
    short_name: 'BertOS',
    description: 'AI command center for chat, local CLI agents, workspace coding, and project evolution.',
    id: '/',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'browser'],
    background_color: '#0A0A0B',
    theme_color: '#0A0A0B',
    categories: ['productivity', 'developer', 'utilities'],
    orientation: 'any',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/apple-touch-icon.svg',
        sizes: '180x180',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Command Center',
        short_name: 'Home',
        description: 'Open BertOS mission control.',
        url: '/dashboard',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      {
        name: 'Workspace',
        short_name: 'Files',
        description: 'Open the local coding workspace.',
        url: '/workspace',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      {
        name: 'Launch Readiness',
        short_name: 'Launch',
        description: 'Check publishability, install state, and local bridge status.',
        url: '/launch',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
    ],
  };
}

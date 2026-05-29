import type { Metadata, Viewport } from 'next'
import './globals.css'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A0B',
  interactiveWidget: 'resizes-content',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://bertos-ai-os.vercel.app'),
  title: {
    default: 'BertOS - AI Operating System',
    template: '%s | BertOS',
  },
  description: 'A premium local AI command center. Control Claude, Codex, and Gemini from one unified workspace.',
  applicationName: 'BertOS',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'BertOS',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: 'BertOS - AI Operating System',
    description: 'A local-first AI operating system for coding, agents, skills, memory, outputs, and workflows.',
    url: 'https://bertos-ai-os.vercel.app',
    siteName: 'BertOS',
    images: [{ url: '/og.svg', width: 1200, height: 630, alt: 'BertOS AI Operating System' }],
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0A0A0B] text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  )
}

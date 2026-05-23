import Link from 'next/link'

export default function NotFound() {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#020617] text-zinc-100 min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200/60 mb-3">404 — Route not found</p>
          <h1 className="text-4xl font-bold text-zinc-100 mb-2">Off the map</h1>
          <p className="text-zinc-500 text-sm mb-6">This route does not exist in BertOS command space.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm text-cyan-100 hover:bg-cyan-300/20 transition"
          >
            Return to Dashboard
          </Link>
        </div>
      </body>
    </html>
  )
}

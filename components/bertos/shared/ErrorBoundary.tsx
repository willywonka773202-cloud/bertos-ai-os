'use client'
import React, { ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCcw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { HologramPanel, RomanDivider } from '@/components/bertos/hermes'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-[400px] w-full items-center justify-center p-6">
          <HologramPanel tone="bronze" className="w-full max-w-lg p-8">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                <AlertCircle className="h-8 w-8" />
              </div>
              
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-200/70">System Exception</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-100">The Oracle has faltered</h1>
              
              <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-left font-mono text-xs text-red-300/80">
                <p className="font-bold">Error detail:</p>
                <p className="mt-1 break-all opacity-80">{this.state.error?.message || 'An unexpected UI crash occurred.'}</p>
              </div>

              <RomanDivider label="recovery rites" className="my-6 w-full" />
              
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button 
                  onClick={() => window.location.reload()} 
                  className="gap-2 border-cyan-300/30 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Reload App
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/dashboard'}
                  className="gap-2 border-zinc-800 bg-zinc-900/50 text-zinc-400"
                >
                  <Home className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </div>
              
              <p className="mt-6 text-[10px] text-zinc-600">
                If this persists, check the local daemon logs or verify your provider configuration in Settings.
              </p>
            </div>
          </HologramPanel>
        </div>
      )
    }

    return this.props.children
  }
}

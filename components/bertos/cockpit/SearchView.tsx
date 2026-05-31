'use client'
import { Search } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RouteHero } from '@/components/bertos/hermes'
import { OracleSearch } from './OracleSearch'

export function SearchView() {
  return (
    <ScrollArea className="h-full min-h-0">
      <div className="mx-auto max-w-4xl px-4 py-4 sm:px-6">
        <RouteHero
          eyebrow="oracle search"
          title="Search Everything"
          subtitle="One query across projects, files, patches, tasks, decisions, outputs, validation, commands, and approvals."
          seal={<Search className="h-5 w-5" />}
          status="active"
        />
        <OracleSearch />
      </div>
    </ScrollArea>
  )
}

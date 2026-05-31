'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Compact, high-contrast markdown for assistant replies and artifact previews. */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-2 text-sm leading-relaxed text-zinc-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mt-2 text-base font-semibold text-[#F0E8D0]">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-2 text-sm font-semibold text-[#E8B86D]">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-2 text-sm font-semibold text-zinc-200">{children}</h3>,
          p: ({ children }) => <p className="text-zinc-300">{children}</p>,
          ul: ({ children }) => <ul className="ml-4 list-disc space-y-0.5 text-zinc-300">{children}</ul>,
          ol: ({ children }) => <ol className="ml-4 list-decimal space-y-0.5 text-zinc-300">{children}</ol>,
          li: ({ children }) => <li className="text-zinc-300">{children}</li>,
          a: ({ children, href }) => <a href={href} className="text-cyan-300 underline hover:text-cyan-200">{children}</a>,
          code: ({ children, className }) =>
            className?.includes('language-')
              ? <code className={className}>{children}</code>
              : <code className="rounded bg-black/40 px-1 py-0.5 font-mono text-[12px] text-amber-200">{children}</code>,
          pre: ({ children }) => <pre className="max-h-72 overflow-auto rounded-lg border border-zinc-800 bg-[#070503] p-3 font-mono text-[12px] leading-relaxed text-zinc-300">{children}</pre>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-cyan-500/40 pl-3 text-zinc-400">{children}</blockquote>,
          table: ({ children }) => <table className="w-full border-collapse text-xs">{children}</table>,
          th: ({ children }) => <th className="border border-zinc-800 bg-black/30 px-2 py-1 text-left text-zinc-300">{children}</th>,
          td: ({ children }) => <td className="border border-zinc-800 px-2 py-1 text-zinc-400">{children}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

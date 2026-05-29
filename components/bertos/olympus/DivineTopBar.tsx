import { BrandSigil } from './BrandSigil'

export function DivineTopBar({ currentSection }: { currentSection: string }) {
  return (
    <div className="divine-topbar hidden min-w-0 items-center gap-3 xl:flex" aria-label="Olympus neural OS status">
      <div className="divine-topbar__identity">
        <span className="divine-topbar__glyph">B</span>
        <span className="min-w-0">
          <span className="block truncate text-[10px] font-black uppercase tracking-[0.28em] text-[#F0E8D0]">BERTOS Olympus Neural OS</span>
          <span className="block truncate text-[9px] uppercase tracking-[0.20em] text-[#9A8A68]">{currentSection}</span>
        </span>
      </div>
      <div className="divine-topbar__modules">
        <BrandSigil brand="claude" size="xs" />
        <BrandSigil brand="codex" size="xs" />
        <BrandSigil brand="ollama" size="xs" />
        <BrandSigil brand="hermes" size="xs" />
      </div>
    </div>
  )
}

import { BrandSigil, type OlympusBrand } from './BrandSigil'

const ORBIT_BRANDS: OlympusBrand[] = ['claude', 'codex', 'ollama', 'hermes']

export function AIIntegrationOrbit({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'olympus-orbit olympus-orbit--compact' : 'olympus-orbit'} aria-label="BERTOS AI integration orbit">
      <div className="olympus-orbit__ring olympus-orbit__ring--outer" />
      <div className="olympus-orbit__ring olympus-orbit__ring--inner" />
      <div className="olympus-orbit__axis" />
      <div className="olympus-orbit__core">
        <BrandSigil brand="bertos" size={compact ? 'sm' : 'lg'} />
        {!compact && (
          <div className="mt-2 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-[#F0E8D0]">Olympus Core</p>
            <p className="text-[9px] uppercase tracking-[0.18em] text-[#9A8A68]">Routing divine compute</p>
          </div>
        )}
      </div>
      {ORBIT_BRANDS.map((brand, index) => (
        <div key={brand} className={`olympus-orbit__node olympus-orbit__node--${index + 1}`}>
          <BrandSigil brand={brand} size={compact ? 'xs' : 'sm'} showLabel={!compact} status={!compact} />
        </div>
      ))}
    </div>
  )
}

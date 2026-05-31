export function ParticleField({ count = 32 }: { count?: number }) {
  return (
    <div className="olympus-particles" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <span
          key={index}
          style={{
            left: `${(index * 37) % 100}%`,
            top: `${(index * 53) % 100}%`,
            animationDelay: `${(index % 9) * 0.7}s`,
            animationDuration: `${9 + (index % 7) * 1.4}s`,
          }}
        />
      ))}
    </div>
  )
}

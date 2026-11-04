/** Skelette in Form echter Karten (Farbe surface-2, leichtes Pulsieren) */
export function ListSkeleton({ rows = 5, kpis = 0 }: { rows?: number; kpis?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-live="polite">
      {kpis > 0 && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${kpis}, minmax(0, 1fr))` }}>
          {Array.from({ length: kpis }, (_, i) => (
            <div key={i} className="skeleton h-24" />
          ))}
        </div>
      )}
      <div className="skeleton h-8 w-48" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton h-16" />
      ))}
    </div>
  );
}

export function CardsSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-3" aria-busy="true">
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-24" />
        <div className="skeleton h-24" />
      </div>
      {Array.from({ length: cards }, (_, i) => (
        <div key={i} className="skeleton h-48" />
      ))}
    </div>
  );
}

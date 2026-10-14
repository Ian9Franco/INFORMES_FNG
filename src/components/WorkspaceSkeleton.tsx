export default function WorkspaceSkeleton() {
  return <div className="loading-workspace screen" role="status" aria-label="Cargando tu espacio de trabajo" aria-busy="true">
    <div className="loading-topbar" aria-hidden="true"><div className="skeleton skeleton-brand" /><div className="skeleton skeleton-nav" /></div>
    <main className="loading-content" aria-hidden="true">
      <div className="skeleton skeleton-caption" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-subtitle" />
      <div className="skeleton skeleton-action" />
      <div className="skeleton-hero"><div className="skeleton skeleton-title" /><div className="skeleton skeleton-subtitle" /><div className="skeleton skeleton-orbit" /></div>
      <div className="skeleton-metrics">{[0, 1, 2].map(item => <div className="skeleton" key={item} />)}</div>
      <div className="skeleton-list">{[0, 1, 2, 3, 4].map(item => <div className="skeleton skeleton-row" key={item} />)}</div>
    </main>
    <div className="loading-dock" aria-hidden="true">{[0, 1, 2, 3].map(item => <span className="skeleton" key={item} />)}</div>
    <span className="sr-only">Cargando tu espacio de trabajo…</span>
  </div>
}

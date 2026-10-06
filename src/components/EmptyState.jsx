export default function EmptyState({ query, onReset }) {
  return (
    <div className="glass rounded-2xl px-6 py-14 text-center" role="status">
      <p className="text-lg font-semibold">No instruments found{query ? ` for “${query}”` : ''}</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-mute">Check the spelling, try a ticker like AAPL or a theme like “tech”, or remove some filters.</p>
      <button type="button" className="btn-primary mt-5" onClick={onReset}>Reset search and filters</button>
    </div>
  );
}

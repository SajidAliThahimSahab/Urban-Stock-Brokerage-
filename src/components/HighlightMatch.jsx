/**
 * Wraps the first case-insensitive occurrence of `query` in <mark>.
 * Display aid only: the real match may be stemmed or trigram-based.
 */
export default function HighlightMatch({ text, query }) {
  const q = query?.trim();
  if (!q || !text) return <>{text}</>;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-volt/25 px-0.5 text-volt-soft">{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

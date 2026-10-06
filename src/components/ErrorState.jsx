export default function ErrorState({ message, onRetry }) {
  return (
    <div className="glass rounded-2xl border-loss/40 px-6 py-12 text-center" role="alert">
      <p className="text-lg font-semibold text-loss">We couldn’t load results</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-mute">{message}</p>
      <button type="button" className="btn-primary mt-5" onClick={onRetry}>Try again</button>
    </div>
  );
}

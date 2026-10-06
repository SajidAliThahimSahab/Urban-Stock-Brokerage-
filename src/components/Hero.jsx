export default function Hero({ children }) {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-6 pt-10 sm:px-6 sm:pt-14" aria-labelledby="hero-title">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.22em] text-volt">Search &amp; Discovery</p>
      <h1 id="hero-title" className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
        Every instrument. One search.
      </h1>
      <p className="mt-3 max-w-2xl text-base text-mute">
        Stocks, ETFs, bonds, mutual funds and IPOs. Type a ticker or a theme and get ranked results with typo tolerance in milliseconds.
      </p>
      <div className="mt-7 max-w-3xl">{children}</div>
    </section>
  );
}

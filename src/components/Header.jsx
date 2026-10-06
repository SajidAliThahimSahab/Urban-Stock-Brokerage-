export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-obsidian">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <a href="/" className="flex items-center gap-2.5" aria-label="Urban Brokerage home">
          <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
            <defs>
              <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#38D6FF" />
                <stop offset="1" stopColor="#8B7BFF" />
              </linearGradient>
            </defs>
            <rect x="3" y="14" width="5" height="12" rx="1.5" fill="url(#lg)" />
            <rect x="13.5" y="6" width="5" height="20" rx="1.5" fill="url(#lg)" />
            <rect x="24" y="10" width="5" height="16" rx="1.5" fill="url(#lg)" />
          </svg>
          <span className="text-[15px] font-semibold tracking-tight">
            Urban<span className="text-mute font-normal"> Brokerage</span>
          </span>
        </a>
        <nav aria-label="Primary" className="hidden items-center gap-6 text-sm text-mute sm:flex">
          <a className="hover:text-ink" href="#markets">Markets</a>
          <a className="hover:text-ink" href="#vault">Featured</a>
          <a className="text-ink" href="#instruments">Instruments</a>
        </nav>
        <span className="chip border-gain/30 text-gain">
          <span className="h-1.5 w-1.5 rounded-full bg-gain" aria-hidden="true" />
          Demo data
        </span>
      </div>
    </header>
  );
}

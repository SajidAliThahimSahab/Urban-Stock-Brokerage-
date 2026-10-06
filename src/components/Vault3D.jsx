import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CATEGORY_DOT, formatChange, formatPrice, toneClass } from '../lib/format.js';
import { sparkPath } from '../lib/series.js';

const DEG_PER_PX = 0.32; 
const DRAG_THRESHOLD = 6; 
const AUTO_INTERVAL = 2000; 
const RESUME_DELAY = 1500; 

function Vault3D({ items: rawItems, onSelect }) {
  const items = useMemo(
    () => (rawItems ? [...rawItems].sort((a, b) => a.ticker.localeCompare(b.ticker, 'en')) : rawItems),
    [rawItems],
  );
  const n = items?.length || 0;
  const angle = n ? 360 / n : 45;
  
  const [front, setFront] = useState(0);
  const stageRef = useRef(null);
  const ringRef = useRef(null);
  const rot = useRef(0); 
  const frontRef = useRef(0);
  const drag = useRef(null);
  const suppressClick = useRef(false);
  const tiltFrame = useRef(0);
  const hoverOrFocus = useRef(false); 
  const pausedUntil = useRef(0); 
  const inView = useRef(true);
  const stageRectRef = useRef({ left: 0, top: 0, width: 300, height: 300 });
  
  // Radius is pure CSS (container query units) driven by this constant: no ResizeObserver,
  // no JS geometry reads, no style writes on resize.
  const radiusK = n ? (0.4 / Math.tan(Math.PI / n)).toFixed(4) : 1;

  useEffect(() => {
    if (!n || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
    const el = stageRef.current;
    const io = el && 'IntersectionObserver' in window
      ? new IntersectionObserver(([entry]) => { inView.current = entry.isIntersecting; }, { threshold: 0.2 })
      : null;
    io?.observe(el);
    const timer = setInterval(() => {
      if (
        document.hidden || !inView.current || hoverOrFocus.current || drag.current ||
        performance.now() < pausedUntil.current
      ) return;
      stepBy(1);
    }, AUTO_INTERVAL);
    return () => { clearInterval(timer); io?.disconnect(); };
  }, [n]);

  const holdAutoplay = (ms = RESUME_DELAY) => { pausedUntil.current = performance.now() + ms; };

  function applyRot(deg, animate) {
    const el = stageRef.current;
    if (!el) return;
    rot.current = deg;
    el.classList.toggle('is-dragging', !animate);
    el.style.setProperty('--rot', deg.toFixed(2));
    const f = (((Math.round(deg / angle) % n) + n) % n);
    if (f !== frontRef.current) {
      frontRef.current = f;
      setFront(f);
    }
  }

  function snapTo(i) {
    const base = i * angle;
    const turns = Math.round((rot.current - base) / 360);
    applyRot(base + 360 * turns, true);
  }
  const stepBy = (dir) => snapTo((((frontRef.current + dir) % n) + n) % n);

  function onPointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    holdAutoplay(60_000); 
    drag.current = { id: e.pointerId, x: e.clientX, rot: rot.current, moved: false, v: 0, lastT: performance.now(), lastRot: rot.current };
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.x;
      if (!d.moved) {
        if (Math.abs(dx) < DRAG_THRESHOLD) return;
        d.moved = true;
        stageRef.current.setPointerCapture?.(e.pointerId);
        stageRef.current.classList.add('is-grabbing');
      }
      const next = d.rot - dx * DEG_PER_PX; 
      const now = performance.now();
      const dt = now - d.lastT;
      if (dt > 0) d.v = 0.7 * d.v + 0.3 * ((next - d.lastRot) / dt);
      d.lastT = now;
      d.lastRot = next;
      applyRot(next, false);
      return;
    }
    if (e.pointerType !== 'mouse' || tiltFrame.current) return;
    const { clientX, clientY } = e;
    tiltFrame.current = requestAnimationFrame(() => {
      tiltFrame.current = 0;
      const el = stageRef.current;
      if (!el) return;
      const r = stageRectRef.current;
      el.style.setProperty('--ry', (((clientX - (r.left || 0)) / (r.width || 300) - 0.5) * 10).toFixed(2));
      el.style.setProperty('--rx', (-((clientY - (r.top || 0)) / (r.height || 300) - 0.5) * 6).toFixed(2));
    });
  }

  function endDrag(e, cancelled) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    stageRef.current.classList.remove('is-grabbing');
    holdAutoplay();
    if (!d.moved) return;
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 0);
    const fling = cancelled ? 0 : Math.max(-2 * angle, Math.min(2 * angle, d.v * 160));
    applyRot(Math.round((rot.current + fling) / angle) * angle, true);
  }

  function onPointerEnter(e) {
    if (e.pointerType === 'mouse') {
      hoverOrFocus.current = true;
      // One read, inside an event handler (layout is already clean here), cached for the tilt.
      const r = stageRef.current?.getBoundingClientRect();
      if (r) stageRectRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
    }
  }

  function onPointerLeave(e) {
    if (drag.current && !drag.current.moved) { drag.current = null; holdAutoplay(); } 
    if (e.pointerType === 'mouse') {
      hoverOrFocus.current = false;
      holdAutoplay(); 
    }
    stageRef.current?.style.setProperty('--ry', '0');
    stageRef.current?.style.setProperty('--rx', '0');
  }

  function handleCardClick(i) {
    if (suppressClick.current || drag.current?.moved) return;
    holdAutoplay(4000);
    if (i === frontRef.current) {
      onSelect(items[i]);
    } else {
      snapTo(i);
    }
  }

  function onKeyDown(e) {
    holdAutoplay(4000);
    if (e.key === 'ArrowRight') { e.preventDefault(); stepBy(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepBy(-1); }
    else if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault();
      onSelect(items[frontRef.current]);
    }
  }

  // Memoize rendered cards to completely eliminate unnecessary script execution and layout recalculation
  const renderedCards = useMemo(() => {
    if (!items) return null;
    return items.map((it, i) => {
      const isFront = i === front;
      const up = Number(it.change_pct) >= 0;
      const pathData = sparkPath(it.ticker, it.change_pct, 160, 44);
      return (
        <div 
          key={it.id} 
          className={`vault-card ${isFront ? 'is-front' : ''}`} 
          style={{ '--i': i }}
          onClick={() => handleCardClick(i)}
        >
          <div className="vault-face" aria-hidden={isFront ? undefined : 'true'}>
            <span className="flex items-center justify-between">
              <span className="font-mono text-lg font-bold">{it.ticker}</span>
              <span className="chip !px-2 !py-0.5">
                <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[it.category]}`} aria-hidden="true" />
                {it.category}
              </span>
            </span>
            <span className="line-clamp-2 text-xs text-mute">{it.title}</span>
            <svg viewBox="0 0 160 44" className="h-11 w-full" aria-hidden="true" preserveAspectRatio="none">
              <path d={pathData} fill="none" stroke={up ? '#2FE6A8' : '#FF6B86'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="flex items-end justify-between">
              <span className="font-mono text-xl font-semibold">{formatPrice(it.price)}</span>
              <span className={`font-mono text-sm ${toneClass(it.change_pct)}`}>{formatChange(it.change_pct)}</span>
            </span>
          </div>
        </div>
      );
    });
  }, [items, front]);

  if (!n) {
    return <div className="glass vault-stage rounded-3xl"><div className="skeleton m-8 h-48" /></div>;
  }

  return (
    <div className="glass vault-wrap relative overflow-hidden rounded-3xl" id="vault">
      <div className="flex items-center justify-between px-5 pt-4">
        <h2 className="text-sm font-semibold">Featured vault</h2>
        <span className="text-[11px] text-dim" aria-hidden="true">A to Z · auto-play</span>
      </div>
      <div
        ref={stageRef}
        className="vault-stage"
        style={{ '--angle': `${angle}deg`, '--k': radiusK }}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={`Featured instruments, ${items[front].ticker} in front. Use the left and right arrow keys or drag to rotate. Press Enter to open details.`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onFocus={() => { hoverOrFocus.current = true; }}
        onBlur={() => { hoverOrFocus.current = false; holdAutoplay(); }}
        onKeyDown={onKeyDown}
      >
        <div className="vault-floor" aria-hidden="true" />
        <div className="vault-core" aria-hidden="true" />
        <div className="vault-tilt">
          <div className="vault-ring" ref={ringRef}>
            {renderedCards}
          </div>
        </div>
      </div>
      <p className="px-5 pb-3 text-center text-[11px] text-dim">Auto-plays A to Z; hover, focus or drag to pause. Drag or use ← → to rotate. Click the front card for details. Trend lines are illustrative.</p>
    </div>
  );
}

export default memo(Vault3D);
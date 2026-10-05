/** Deterministic helpers for hand-drawn chalk shapes. */

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** A wobbly rectangle path drawn like a child would with chalk. */
export function roughRectPath(w: number, h: number, seed: number, wobble = 3, inset = 4): string {
  const r = rng(seed);
  const j = () => (r() - 0.5) * 2 * wobble;
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
  const side = (ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(2, Math.round(len / 90));
    let d = "";
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const mx = ax + (bx - ax) * (t - 0.5 / steps) + j();
      const my = ay + (by - ay) * (t - 0.5 / steps) + j();
      const ex = ax + (bx - ax) * t + (i === steps ? j() * 0.6 : j());
      const ey = ay + (by - ay) * t + (i === steps ? j() * 0.6 : j());
      d += ` Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    }
    return d;
  };
  // start a little past the corner and overshoot at the end, like real chalk
  let d = `M${(x0 + j()).toFixed(1)} ${(y0 + j()).toFixed(1)}`;
  d += side(x0, y0, x1, y0);
  d += side(x1, y0, x1, y1);
  d += side(x1, y1, x0, y1);
  d += side(x0, y1, x0 + j() * 0.5, y0 + 10 + r() * 8);
  return d;
}

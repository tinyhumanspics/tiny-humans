"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react";
import css from "./Waiver.module.css";

export interface SignaturePadHandle {
  clear: () => void;
  /** The signature as a small PNG data URL (900 px wide), or null when nothing was drawn. */
  toPng: () => string | null;
}

type Point = { x: number; y: number };

const INK = "#1d2a20";
const EXPORT_WIDTH = 900;

/**
 * Sign with a finger (or mouse/stylus): pointer events, `touch-action: none` so the page doesn't scroll while
 * signing. Strokes are kept as 0–1 coordinates, so turning the iPad redraws the same signature at the new size.
 * `onInk` reports how many points were drawn (the form wants a real signature, not a dot).
 */
export default function SignaturePad({ ref, label, onInk }: { ref?: Ref<SignaturePadHandle>; label: string; onInk: (points: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Point[][]>([]);
  const drawing = useRef(false);

  const paint = useCallback((canvas: HTMLCanvasElement, width: number, height: number, lineWidth: number) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = INK;
    ctx.fillStyle = INK;
    for (const stroke of strokes.current) {
      const pts = stroke.map((p) => ({ x: p.x * width, y: p.y * height }));
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mid = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mid.x, mid.y);
      }
      ctx.lineTo(pts.at(-1)!.x, pts.at(-1)!.y);
      ctx.stroke();
    }
  }, []);

  /** Matches the canvas to its box (sharp on Retina) and redraws. */
  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const box = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    canvas.getContext("2d")?.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint(canvas, box.width, box.height, 2.6);
  }, [paint]);

  const count = () => strokes.current.reduce((n, s) => n + s.length, 0);

  useEffect(() => {
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
    };
  }, [fit]);

  useImperativeHandle(ref, () => ({
    clear: () => {
      strokes.current = [];
      fit();
      onInk(0);
    },
    toPng: () => {
      const canvas = canvasRef.current;
      if (!canvas || !count()) return null;
      const box = canvas.getBoundingClientRect();
      const out = document.createElement("canvas");
      out.width = EXPORT_WIDTH;
      out.height = Math.round((EXPORT_WIDTH * box.height) / box.width);
      paint(out, out.width, out.height, 2.6 * (EXPORT_WIDTH / box.width));
      return out.toDataURL("image/png");
    },
  }));

  const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const box = e.currentTarget.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)), y: Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)) };
  };

  return (
    <canvas
      ref={canvasRef}
      className={css.pad}
      role="img"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        drawing.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* some browsers refuse capture for mouse; drawing still works */
        }
        strokes.current.push([point(e)]);
        fit();
        onInk(count());
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return;
        e.preventDefault();
        strokes.current.at(-1)?.push(point(e));
        const canvas = e.currentTarget;
        const box = canvas.getBoundingClientRect();
        paint(canvas, box.width, box.height, 2.6);
      }}
      onPointerUp={() => {
        drawing.current = false;
        onInk(count());
      }}
      onPointerCancel={() => {
        drawing.current = false;
        onInk(count());
      }}
    />
  );
}

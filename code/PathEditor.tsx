"use client";

/**
 * Live SVG path editor for the /sharelocalhost hero animation.
 *
 * Activate by appending `?editPath=1` to the URL. Replaces the normal
 * animated hero demo with this editor so you can drag waypoints, watch
 * a live plane preview, and copy out the resulting `d` string.
 *
 * Path representation: M anchor, then any number of cubic-Bezier
 * segments. Each cubic = control1 + control2 + endAnchor (3 points).
 * Anchors render as circles, control points as squares with a dashed
 * tangent line back to their owning anchor — same convention as Figma
 * / Illustrator / SvgPathEditor.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Copy, RotateCcw, Plus, Minus, Check, Sparkles } from "lucide-react";

const VB_W = 800;
const VB_H = 400;
// Match production's HeroDemo exactly so the preview reflects what the
// real animation will look like.
const FLIGHT_MS = 4100;
const DOT_SPACING = 11;

// Plane geometry — must match HeroDemo's vertex anatomy exactly.
const PLANE_OUTLINE_D = "M15 0 L-12 -10 L-3 0 L-9 7 Z";
const PLANE_TOP_WING_D = "M15 0 L-12 -10 L-3 0 Z";
const PLANE_BOTTOM_FLAP_D = "M15 0 L-3 0 L-9 7 Z";
const PLANE_SPINE_D = "M15 0 L-3 0";

type Kind = "anchor" | "control";
type Pt = { x: number; y: number; kind: Kind };

/* ─── Default path (matches the production hero) ──────────────────── */

function makeDefaultRaw(): Pt[] {
  // Spawn coords mirror the in-button plane's typical center.
  const sx = 685;
  const sy = 94;
  const apexX = 360;
  const apexY = -240;
  const r = 44;
  const k = (4 * r) / 3;
  const entryX = apexX;
  const entryY = apexY + r;
  const exitX = apexX - 4;
  const exitY = apexY + r + 6;
  const endX = 80;
  const endY = sy + 360;

  return [
    { x: sx, y: sy, kind: "anchor" },
    // C1
    { x: sx + 10, y: sy - 60, kind: "control" },
    { x: sx - 80, y: sy - 130, kind: "control" },
    { x: sx - 160, y: sy - 170, kind: "anchor" },
    // C2
    { x: sx - 250, y: sy - 210, kind: "control" },
    { x: apexX + 110, y: apexY + r + 60, kind: "control" },
    { x: entryX, y: entryY, kind: "anchor" },
    // C3 (loop right)
    { x: apexX + k, y: apexY + r, kind: "control" },
    { x: apexX + k, y: apexY - r, kind: "control" },
    { x: apexX, y: apexY - r, kind: "anchor" },
    // C4 (loop left)
    { x: apexX - k, y: apexY - r, kind: "control" },
    { x: apexX - k, y: apexY + r, kind: "control" },
    { x: exitX, y: exitY, kind: "anchor" },
    // C5
    { x: apexX - 30, y: apexY + r + 90, kind: "control" },
    { x: apexX - 70, y: sy - 80, kind: "control" },
    { x: apexX - 130, y: sy + 20, kind: "anchor" },
    // C6
    { x: apexX - 200, y: sy + 130, kind: "control" },
    { x: endX + 100, y: endY - 100, kind: "control" },
    { x: endX, y: endY, kind: "anchor" },
  ];
}

function makeDefault(): Pt[] {
  return smoothAllAnchors(makeDefaultRaw());
}

/** Make every internal anchor's two control points collinear through it
 *  (smooth tangent) while preserving each control's original distance from
 *  the anchor. Eliminates direction kinks that cause the plane to snap at
 *  segment boundaries. */
function smoothAllAnchors(pts: Pt[]): Pt[] {
  const next = pts.slice();
  for (let i = 3; i + 2 < next.length; i += 3) {
    const a = next[i];
    const cIn = next[i - 1];
    const cOut = next[i + 1];
    if (
      cIn.kind !== "control" ||
      cOut.kind !== "control" ||
      a.kind !== "anchor"
    )
      continue;

    // Direction vectors at the anchor, treating cIn as arriving and cOut as leaving.
    const inX = a.x - cIn.x;
    const inY = a.y - cIn.y;
    const outX = cOut.x - a.x;
    const outY = cOut.y - a.y;
    const inLen = Math.hypot(inX, inY);
    const outLen = Math.hypot(outX, outY);
    if (inLen < 0.001 || outLen < 0.001) continue;

    // Average the two unit tangents to get a single smooth tangent direction.
    const ux = inX / inLen + outX / outLen;
    const uy = inY / inLen + outY / outLen;
    const ulen = Math.hypot(ux, uy);
    if (ulen < 0.001) continue;
    const dx = ux / ulen;
    const dy = uy / ulen;

    next[i - 1] = {
      ...cIn,
      x: Math.round(a.x - dx * inLen),
      y: Math.round(a.y - dy * inLen),
    };
    next[i + 1] = {
      ...cOut,
      x: Math.round(a.x + dx * outLen),
      y: Math.round(a.y + dy * outLen),
    };
  }
  return next;
}

/** For a control point at idx, return the indices of its owning anchor and
 *  partner control (the control on the other side of that anchor). Returns
 *  -1 for either if not present (e.g. start/end of path). */
function controlNeighbors(
  pts: Pt[],
  idx: number,
): { anchorIdx: number; partnerIdx: number } {
  // Layout: A0 c c A1 c c A2 c c A3 ...
  // Within a cubic at segment k (anchor at index 3k, controls at 3k+1, 3k+2, end anchor at 3k+3):
  //   - A control at 3k+1 is the OUTGOING control of A_(3k); partner is the INCOMING control
  //     of A_(3k), which sits at index 3k-1 (only exists if k>0).
  //   - A control at 3k+2 is the INCOMING control of A_(3k+3); partner is the OUTGOING control
  //     of A_(3k+3), which sits at index 3k+4 (only exists if there's a next cubic).
  if (idx <= 0 || idx >= pts.length) return { anchorIdx: -1, partnerIdx: -1 };
  if (pts[idx].kind !== "control") return { anchorIdx: -1, partnerIdx: -1 };
  const before = pts[idx - 1];
  const after = idx + 1 < pts.length ? pts[idx + 1] : null;
  if (before?.kind === "anchor") {
    // outgoing control; anchor at idx-1, partner at idx-2
    const partnerIdx =
      idx - 2 >= 0 && pts[idx - 2]?.kind === "control" ? idx - 2 : -1;
    return { anchorIdx: idx - 1, partnerIdx };
  }
  if (after?.kind === "anchor") {
    // incoming control; anchor at idx+1, partner at idx+2
    const partnerIdx =
      idx + 2 < pts.length && pts[idx + 2]?.kind === "control" ? idx + 2 : -1;
    return { anchorIdx: idx + 1, partnerIdx };
  }
  return { anchorIdx: -1, partnerIdx: -1 };
}

/* ─── Path string ↔ point list ────────────────────────────────────── */

function pointsToD(pts: Pt[]): string {
  if (pts.length === 0) return "";
  const parts = [`M ${fmt(pts[0].x)} ${fmt(pts[0].y)}`];
  for (let i = 1; i + 2 < pts.length; i += 3) {
    const c1 = pts[i];
    const c2 = pts[i + 1];
    const a = pts[i + 2];
    parts.push(
      `C ${fmt(c1.x)} ${fmt(c1.y)}, ${fmt(c2.x)} ${fmt(c2.y)}, ${fmt(a.x)} ${fmt(a.y)}`,
    );
  }
  return parts.join(" ");
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Parse only the absolute cubic-Bezier paths this editor produces.
 *  Returns null if the input has commands we don't support. */
function parseD(d: string): Pt[] | null {
  const tokens = d.match(/[MmCc]|-?\d+(?:\.\d+)?/g);
  if (!tokens) return null;
  const pts: Pt[] = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i];
    if (cmd === "M") {
      i++;
      const x = parseFloat(tokens[i++]);
      const y = parseFloat(tokens[i++]);
      if (Number.isNaN(x) || Number.isNaN(y)) return null;
      pts.push({ x, y, kind: "anchor" });
    } else if (cmd === "C") {
      i++;
      for (let j = 0; j < 3; j++) {
        const x = parseFloat(tokens[i++]);
        const y = parseFloat(tokens[i++]);
        if (Number.isNaN(x) || Number.isNaN(y)) return null;
        pts.push({ x, y, kind: j < 2 ? "control" : "anchor" });
      }
    } else if (/-?\d/.test(cmd)) {
      // Bare numbers between commands — skip (shouldn't happen in our output).
      i++;
    } else {
      // Unsupported command (m, c, S, Q, A, etc.).
      return null;
    }
  }
  return pts;
}

/* ─── Editor ──────────────────────────────────────────────────────── */

export default function PathEditor() {
  const [points, setPoints] = useState<Pt[]>(makeDefault);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const planeGroupRef = useRef<SVGGElement>(null);
  const planeBodyRef = useRef<SVGGElement>(null);
  const planeTopWingRef = useRef<SVGGElement>(null);
  const planeBottomFlapRef = useRef<SVGGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const dotRefs = useRef<Array<SVGCircleElement | null>>([]);

  const [dots, setDots] = useState<Array<{ x: number; y: number; t: number }>>(
    [],
  );

  const d = useMemo(() => pointsToD(points), [points]);

  /* Drag handler — document-level so drags work even when the pointer
   * leaves the SVG bounds. Behavior:
   *   - Anchor drag: anchor + both flanking controls translate together,
   *     preserving the curve's local shape.
   *   - Control drag: the partner control across the shared anchor stays
   *     collinear (smooth tangent), preserving its own distance from the
   *     anchor. Hold Alt to break symmetry and create a sharp corner. */
  useEffect(() => {
    if (dragIdx === null) return;
    const move = (e: PointerEvent) => {
      const c = containerRef.current;
      if (!c) return;
      const cb = c.getBoundingClientRect();
      const vbX = Math.round(((e.clientX - cb.left) / cb.width) * VB_W);
      const vbY = Math.round(((e.clientY - cb.top) / cb.height) * VB_H);
      const altKey = e.altKey;

      setPoints((p) => {
        const next = p.slice();
        const old = next[dragIdx];
        if (!old) return p;

        if (old.kind === "anchor") {
          const dx = vbX - old.x;
          const dy = vbY - old.y;
          next[dragIdx] = { ...old, x: vbX, y: vbY };
          // Translate flanking controls by the same delta.
          const before = next[dragIdx - 1];
          if (before && before.kind === "control") {
            next[dragIdx - 1] = {
              ...before,
              x: before.x + dx,
              y: before.y + dy,
            };
          }
          const after = next[dragIdx + 1];
          if (after && after.kind === "control") {
            next[dragIdx + 1] = {
              ...after,
              x: after.x + dx,
              y: after.y + dy,
            };
          }
          return next;
        }

        // Control point.
        next[dragIdx] = { ...old, x: vbX, y: vbY };

        if (altKey) return next; // corner mode — no mirroring

        const { anchorIdx, partnerIdx } = controlNeighbors(next, dragIdx);
        if (anchorIdx === -1 || partnerIdx === -1) return next;
        const anchor = next[anchorIdx];
        const partner = next[partnerIdx];
        // Preserve partner's existing distance from anchor; mirror direction.
        const dragVecX = vbX - anchor.x;
        const dragVecY = vbY - anchor.y;
        const dragLen = Math.hypot(dragVecX, dragVecY);
        if (dragLen < 0.001) return next;
        const partnerLen = Math.hypot(
          partner.x - anchor.x,
          partner.y - anchor.y,
        );
        const ux = -dragVecX / dragLen;
        const uy = -dragVecY / dragLen;
        next[partnerIdx] = {
          ...partner,
          x: Math.round(anchor.x + ux * partnerLen),
          y: Math.round(anchor.y + uy * partnerLen),
        };
        return next;
      });
    };
    const up = () => setDragIdx(null);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("pointercancel", up);
    return () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("pointercancel", up);
    };
  }, [dragIdx]);

  /* Re-sample dot positions whenever the path changes. */
  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    if (total === 0) {
      setDots([]);
      return;
    }
    const sampled: Array<{ x: number; y: number; t: number }> = [];
    for (let len = 0; len <= total; len += DOT_SPACING) {
      const pt = path.getPointAtLength(len);
      sampled.push({ x: pt.x, y: pt.y, t: len / total });
    }
    setDots(sampled);
  }, [d]);

  /* Live plane preview — loops along the current path so you can see the
     motion at the same speed as the real animation. */
  useLayoutEffect(() => {
    const g = planeGroupRef.current;
    const path = pathRef.current;
    if (!g || !path) return;
    let raf = 0;
    const total = path.getTotalLength();
    const dotsList = dots;
    // Hide all dots before paint — RAF reveals progressively.
    for (const el of dotRefs.current) {
      if (el) el.style.opacity = "0";
    }

    // Centered-difference tangent — matches the production demo for
    // an accurate preview of the plane's rotation.
    const tangentAt = (len: number) => {
      const w = 6;
      const back = path.getPointAtLength(Math.max(len - w, 0));
      const fwd = path.getPointAtLength(Math.min(len + w, total));
      return (Math.atan2(fwd.y - back.y, fwd.x - back.x) * 180) / Math.PI;
    };

    // Dynamic speed (gravity-flavored) — exact same physics as production.
    const baseSpeed = total / (FLIGHT_MS / 1000);
    const GRAVITY = 0.75;
    const RESPONSIVENESS = 2.5;
    const MIN_FACTOR = 0.35;
    const MAX_FACTOR = 1.95;
    // Match production: speed kick + decoupled stability ramp.
    const LAUNCH_KICK_MS = 360;
    const LAUNCH_KICK_BOOST = 1.3;
    const STABILITY_MS = 200;
    // Bank + pitch — same constants as production HeroDemo.
    const BANK_INTENSITY = 55;
    const BANK_CAP = 16;
    const BANK_SKEW = 0.5;
    const BANK_RESPONSE = 4.2;
    const BANK_WINDOW = 12;
    const PITCH_TOP_AMT = 0.2;
    const PITCH_BOTTOM_AMT = 0.32;
    const PITCH_RESPONSE = 3.5;

    let lastFrameTime = performance.now();
    let loopStart = lastFrameTime;
    let currentLen = 0;
    let speedFactor = 1;
    let lastDotIdx = -1;
    let bankAngle = 0;
    let pitchValue = 0;

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      const w = 6;
      const back = path.getPointAtLength(Math.max(currentLen - w, 0));
      const fwd = path.getPointAtLength(Math.min(currentLen + w, total));
      const dx = fwd.x - back.x;
      const dy = fwd.y - back.y;
      const dirLen = Math.hypot(dx, dy);
      const dyNorm = dirLen > 0 ? dy / dirLen : 0;

      const targetFactor = Math.max(
        MIN_FACTOR,
        Math.min(MAX_FACTOR, 1 + GRAVITY * dyNorm),
      );
      speedFactor +=
        (targetFactor - speedFactor) * (1 - Math.exp(-RESPONSIVENESS * dt));

      // Launch kick + stability ramp — same as production.
      const elapsedSinceLoopStart = now - loopStart;
      const kickT = Math.min(1, elapsedSinceLoopStart / LAUNCH_KICK_MS);
      const launchKick = 1 + LAUNCH_KICK_BOOST * Math.pow(1 - kickT, 2);
      const stabilityT = Math.min(1, elapsedSinceLoopStart / STABILITY_MS);
      const stability = 1 - Math.pow(1 - stabilityT, 2);

      currentLen += baseSpeed * speedFactor * launchKick * dt;

      // Loop: when past the end, reset and hide all dots.
      if (currentLen >= total) {
        currentLen = 0;
        speedFactor = 1;
        lastDotIdx = -1;
        loopStart = now;
        bankAngle = 0;
        pitchValue = 0;
        for (const el of dotRefs.current) {
          if (el) el.style.opacity = "0";
        }
      }

      const pt = path.getPointAtLength(currentLen);
      const angle = tangentAt(currentLen);

      // Bank: derived from path curvature × speed × stability.
      const tBack = path.getPointAtLength(
        Math.max(currentLen - BANK_WINDOW, 0),
      );
      const tFwd = path.getPointAtLength(
        Math.min(currentLen + BANK_WINDOW, total),
      );
      const aAhead =
        (Math.atan2(tFwd.y - back.y, tFwd.x - back.x) * 180) / Math.PI;
      const aBehind =
        (Math.atan2(fwd.y - tBack.y, fwd.x - tBack.x) * 180) / Math.PI;
      let dTheta = aAhead - aBehind;
      while (dTheta > 180) dTheta -= 360;
      while (dTheta < -180) dTheta += 360;
      const curvature = dTheta / (BANK_WINDOW * 2);
      const bankTarget = Math.max(
        -BANK_CAP,
        Math.min(
          BANK_CAP,
          curvature * BANK_INTENSITY * speedFactor * stability,
        ),
      );
      bankAngle +=
        (bankTarget - bankAngle) * (1 - Math.exp(-BANK_RESPONSE * dt));

      // Pitch: -dyNorm so positive = climbing.
      const pitchTarget = -dyNorm * stability;
      pitchValue +=
        (pitchTarget - pitchValue) * (1 - Math.exp(-PITCH_RESPONSE * dt));

      g.setAttribute(
        "transform",
        `translate(${pt.x} ${pt.y}) rotate(${angle})`,
      );

      if (planeBodyRef.current) {
        planeBodyRef.current.setAttribute(
          "transform",
          `skewX(${bankAngle * BANK_SKEW})`,
        );
      }
      if (planeTopWingRef.current) {
        const topScale = 1 - pitchValue * PITCH_TOP_AMT;
        planeTopWingRef.current.setAttribute(
          "transform",
          `scale(1 ${topScale})`,
        );
      }
      if (planeBottomFlapRef.current) {
        const bottomScale = 1 + pitchValue * PITCH_BOTTOM_AMT;
        planeBottomFlapRef.current.setAttribute(
          "transform",
          `scale(1 ${bottomScale})`,
        );
      }

      const progress = currentLen / total;
      while (
        lastDotIdx < dotsList.length - 1 &&
        progress >= dotsList[lastDotIdx + 1].t
      ) {
        lastDotIdx++;
        const el = dotRefs.current[lastDotIdx];
        if (el) el.style.opacity = "1";
      }

      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [d, dots]);

  /* Reset typing-output state on import / reset. */
  const reset = () => setPoints(makeDefault());

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(d);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const importPath = () => {
    const trimmed = importText.trim();
    if (!trimmed) {
      setImportError("Paste a path d string first.");
      return;
    }
    const parsed = parseD(trimmed);
    if (!parsed || parsed.length === 0) {
      setImportError(
        "Couldn't parse — only absolute M and C commands are supported.",
      );
      return;
    }
    setPoints(parsed);
    setImportError(null);
    setImportText("");
  };

  const addSegment = () => {
    setPoints((p) => {
      if (p.length === 0) return p;
      const last = p[p.length - 1];
      return [
        ...p,
        { x: last.x - 60, y: last.y + 30, kind: "control" },
        { x: last.x - 120, y: last.y + 70, kind: "control" },
        { x: last.x - 180, y: last.y + 100, kind: "anchor" },
      ];
    });
  };

  const removeSegment = () => {
    setPoints((p) => (p.length > 1 ? p.slice(0, p.length - 3) : p));
  };

  const smoothAll = () => {
    setPoints((p) => smoothAllAnchors(p));
  };

  /* Map each control point to its owning anchor for tangent lines. */
  const tangents: { from: Pt; to: Pt; key: string }[] = [];
  for (let i = 1; i + 2 < points.length; i += 3) {
    tangents.push({
      from: points[i - 1],
      to: points[i],
      key: `t-${i}-a`,
    });
    tangents.push({
      from: points[i + 2],
      to: points[i + 1],
      key: `t-${i}-b`,
    });
  }

  return (
    <div className="relative w-full">
      <div className="text-center mb-4 text-xs uppercase tracking-widest font-medium text-[var(--accent)]">
        Path editor mode — drag any handle, then copy below
      </div>

      {/* Editor mode only: bump the entire editor stack to z-50 so that
          handles which render above the demo's bounding box (the path
          can extend up into the headline area) aren't blocked by the
          page's text-wrapper (zIndex: 30) or any other element. */}
      <div
        ref={containerRef}
        className="relative w-full max-w-[760px] mx-auto z-50"
        style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
      >
        {/* Faint chrome outline for spatial reference */}
        <div
          aria-hidden
          className="absolute pointer-events-none"
          style={{
            left: "5%",
            right: "5%",
            top: "10%",
            height: "22%",
          }}
        >
          <div className="w-full h-full rounded-xl border border-dashed border-[#c4bfb9] bg-white/40 flex items-center px-4 gap-3">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e3dfd9]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#e3dfd9]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#e3dfd9]" />
            </div>
            <div className="flex-1 h-7 rounded-md border border-[#e3dfd9] bg-white/60" />
            <div className="h-7 w-16 rounded-md bg-[var(--accent-subtle)] border border-[var(--accent)]/30" />
          </div>
        </div>

        {/* SVG: path + plane preview + tangent lines + handles */}
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="absolute inset-0 w-full h-full"
          style={{ overflow: "visible" }}
        >
          <defs>
            <filter
              id="pe-planeBlur"
              x="-50%"
              y="-50%"
              width="200%"
              height="200%"
            >
              <feGaussianBlur stdDeviation="2" />
            </filter>
            {/* Lit upper face — radial from the tip outward */}
            <radialGradient
              id="pe-planeLitFace"
              cx="0.95"
              cy="0.55"
              r="1.05"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#f3eef9" />
              <stop offset="100%" stopColor="#dcd4eb" />
            </radialGradient>
            {/* Shaded lower face — linear, lighter near spine */}
            <linearGradient
              id="pe-planeShadedFace"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
              gradientUnits="objectBoundingBox"
            >
              <stop offset="0%" stopColor="#bcb3d2" />
              <stop offset="100%" stopColor="#8c83ad" />
            </linearGradient>
          </defs>

          {/* Tangent lines */}
          {tangents.map((t) => (
            <line
              key={t.key}
              x1={t.from.x}
              y1={t.from.y}
              x2={t.to.x}
              y2={t.to.y}
              stroke="rgba(120,120,120,0.45)"
              strokeWidth={1}
              strokeDasharray="3 3"
              pointerEvents="none"
            />
          ))}

          {/* Faint full-path reference (always visible while editing). */}
          <path
            ref={pathRef}
            d={d}
            fill="none"
            stroke="rgba(79,70,229,0.22)"
            strokeWidth={1.5}
            strokeLinecap="round"
            pointerEvents="none"
          />

          {/* Trail dots — sampled at constant arc-length intervals. Each
              dot becomes visible when the plane crosses its parametric t,
              which makes self-intersecting paths reveal correctly. */}
          {dots.map((dot, i) => (
            <circle
              key={i}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              cx={dot.x}
              cy={dot.y}
              r={1.7}
              fill="rgba(79,70,229,0.7)"
              style={{ opacity: 0 }}
              pointerEvents="none"
            />
          ))}

          {/* Plane preview — same layered structure as production. The
              editor loops continuously, so there's no flat-icon → rich
              cross-fade; the plane stays in its rich state. Bank and
              pitch dynamics are driven from the RAF and apply to the
              body / wing groups. */}
          <g ref={planeGroupRef}>
            {/* Drop shadow */}
            <path
              d={PLANE_OUTLINE_D}
              fill="rgba(40, 30, 80, 0.24)"
              transform="translate(0.6 1.8)"
              filter="url(#pe-planeBlur)"
            />
            <g ref={planeBodyRef}>
              <g ref={planeBottomFlapRef}>
                <path d={PLANE_BOTTOM_FLAP_D} fill="url(#pe-planeShadedFace)" />
              </g>
              <g ref={planeTopWingRef}>
                <path d={PLANE_TOP_WING_D} fill="url(#pe-planeLitFace)" />
              </g>
              <path
                d={PLANE_SPINE_D}
                stroke="rgba(60, 50, 100, 0.30)"
                strokeWidth="0.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d={PLANE_SPINE_D}
                stroke="rgba(255, 255, 255, 0.55)"
                strokeWidth="0.45"
                strokeLinecap="round"
                fill="none"
                transform="translate(0 -0.55)"
                opacity="0.85"
              />
              <circle
                cx="10"
                cy="-1.8"
                r="1.5"
                fill="rgba(255, 255, 255, 0.6)"
                filter="url(#pe-planeBlur)"
              />
            </g>
          </g>
        </svg>

        {/* Handles overlay (HTML) — sits above the SVG so handles outside
            the SVG bounds remain clickable. */}
        <div className="absolute inset-0" style={{ overflow: "visible" }}>
          {points.map((p, i) => (
            <button
              key={i}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                (e.currentTarget as HTMLElement).setPointerCapture?.(
                  e.pointerId,
                );
                setDragIdx(i);
              }}
              className="absolute"
              style={{
                left: `${(p.x / VB_W) * 100}%`,
                top: `${(p.y / VB_H) * 100}%`,
                translate: "-50% -50%",
                width: 24,
                height: 24,
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: dragIdx === i ? "grabbing" : "grab",
                touchAction: "none",
              }}
              aria-label={`${p.kind} ${i}`}
              title={`${p.kind} #${i} — (${Math.round(p.x)}, ${Math.round(p.y)})`}
            >
              {p.kind === "anchor" ? (
                <span
                  className="block rounded-full border-2 border-[var(--accent)] bg-white"
                  style={{
                    width: 14,
                    height: 14,
                    margin: "5px auto",
                    boxShadow:
                      dragIdx === i
                        ? "0 0 0 4px rgba(79,70,229,0.25)"
                        : "0 1px 2px rgba(0,0,0,0.15)",
                  }}
                />
              ) : (
                <span
                  className="block bg-white border border-[#9ca3af]"
                  style={{
                    width: 10,
                    height: 10,
                    margin: "7px auto",
                    boxShadow:
                      dragIdx === i
                        ? "0 0 0 3px rgba(120,120,120,0.25)"
                        : "0 1px 2px rgba(0,0,0,0.15)",
                  }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Output + import panel */}
      <div className="mt-12 max-w-[760px] mx-auto rounded-lg border border-[#e3dfd9] bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-medium text-foreground">Path data</div>
            <div className="text-xs text-[var(--text-secondary)]">
              {points.length} pts •{" "}
              {Math.max(0, Math.floor((points.length - 1) / 3))} cubics
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={removeSegment}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-[#e3dfd9] rounded hover:bg-[#f8f6f3]"
            >
              <Minus size={12} /> Segment
            </button>
            <button
              type="button"
              onClick={addSegment}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-[#e3dfd9] rounded hover:bg-[#f8f6f3]"
            >
              <Plus size={12} /> Segment
            </button>
            <button
              type="button"
              onClick={smoothAll}
              title="Make every internal anchor's tangents collinear (smooth)"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-[#e3dfd9] rounded hover:bg-[#f8f6f3]"
            >
              <Sparkles size={12} /> Smooth all
            </button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-[#e3dfd9] rounded hover:bg-[#f8f6f3]"
            >
              <RotateCcw size={12} /> Reset
            </button>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-[var(--accent)] text-white rounded hover:bg-[var(--accent-hover)]"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <textarea
          readOnly
          value={d}
          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          className="w-full h-28 p-2.5 text-[11px] font-mono bg-[#faf9f7] border border-[#e3dfd9] rounded resize-none text-foreground"
        />

        <div className="pt-3 border-t border-[#f0edea] space-y-2">
          <div className="text-xs font-medium text-foreground">
            Import a path
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportError(null);
              }}
              placeholder="Paste an SVG path d string (M / C only)"
              className="flex-1 px-2.5 py-1.5 text-[11px] font-mono bg-[#faf9f7] border border-[#e3dfd9] rounded text-foreground"
            />
            <button
              type="button"
              onClick={importPath}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs border border-[#e3dfd9] rounded hover:bg-[#f8f6f3]"
            >
              Load
            </button>
          </div>
          {importError && (
            <div className="text-[11px] text-[#c43d2e]">{importError}</div>
          )}
        </div>

        <div className="pt-3 border-t border-[#f0edea] text-[11px] leading-relaxed text-[var(--text-secondary)]">
          <div>
            <strong className="text-foreground">ViewBox</strong> {VB_W}×{VB_H}.
            Origin (0, 0) is top-left of the chrome area. The path freely
            extends above and below — handles outside the box are still
            draggable.
          </div>
          <div className="mt-1">
            <strong className="text-foreground">Anchors</strong> (circles) are
            points the path passes through.{" "}
            <strong className="text-foreground">Control points</strong>{" "}
            (squares) shape the curvature on either side of an anchor — the
            dashed line shows which anchor each control belongs to.
          </div>
          <div className="mt-1">
            <strong className="text-foreground">Drag an anchor</strong> to move
            it with both flanking controls. Drag a{" "}
            <strong className="text-foreground">control</strong> and its partner
            across the anchor stays collinear (smooth tangent) — this prevents
            the plane from snapping at anchor points. Hold{" "}
            <kbd className="px-1 py-0.5 rounded border border-[#e3dfd9] bg-[#faf9f7] text-[10px] font-mono">
              Alt
            </kbd>{" "}
            while dragging to break symmetry and make a sharp corner.
          </div>
          <div className="mt-1">
            When happy, hit <em>Copy</em> and paste the string back to Claude.
          </div>
        </div>
      </div>
    </div>
  );
}

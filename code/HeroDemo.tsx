"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useInView,
} from "framer-motion";
import { Lock, Globe } from "lucide-react";
import PathEditor from "./PathEditor";

/**
 * Animated hero graphic for /sharelocalhost.
 *
 * Story:
 *   1. A clean browser-chrome strip fades up: localhost:3000 + a Share
 *      button containing a paper plane.
 *   2. Share is pressed. The button label switches to "● Live"; the URL
 *      morphs from localhost to a public withstoa.com address.
 *   3. The plane lifts off the button and follows a hand-authored flight
 *      path — drawn in the path editor at /sharelocalhost?editPath=1 —
 *      that swoops through the headline space, performs loops, and exits
 *      past the bottom of the section.
 *
 * Plays once when scrolled into view; no replay.
 *
 * Reduced motion: jumps straight to the public-URL end-state.
 */

type Stage = "init" | "frameIn" | "idle" | "shareClicked" | "live" | "done";

const PRIVATE_URL = "localhost:3000";
const PUBLIC_URL = "abc123.share.withstoa.com";

// Container viewBox. SVG renders with overflow:visible so the plane can
// fly above (into headline space) and below (into the section beneath).
const VB_W = 800;
const VB_H = 400;

// Pacing — slow and deliberate. The flight is the showpiece.
const FLIGHT_MS = 4100;

// Hand-authored flight path (drawn in the path editor at /sharelocalhost?editPath=1).
// Origin = first M anchor; we translate the whole path at runtime so the
// origin lines up with the measured button position.
const FLIGHT_PATH =
  "M 716 77 C 918 75, 1081 -14, 1114 -70 C 1160 -148, 1158 -261, 1030 -294 C 889 -330, 779 -97, 379 -65 C 306 -59, 12 -56, -68 -84 C -125 -104, -152 -134, -150 -167 C -149 -191, -120 -254, 24 -162 C 79 -127, 201 -4, 256 69 C 343 185, 410 380, 405 529";
const FLIGHT_PATH_ORIGIN_X = 716;
const FLIGHT_PATH_ORIGIN_Y = 77;

// Spacing between dots along the path's arc length. Smaller = denser trail.
const DOT_SPACING = 11;
// How long the share button is visibly held down after the click before
// the response (morph, URL type, plane takeoff) begins. Pacing matters
// here — too short and the click is imperceptible; too long and it drags.
const PRESS_HOLD_MS = 220;
const URL_TYPE_MS = 540;
const URL_TYPE_INTERVAL_MS = Math.max(
  20,
  Math.round(URL_TYPE_MS / PUBLIC_URL.length),
);

/* ─── Paper plane (centered at origin, pointing right) ────────────
 *
 * Vertex anatomy:
 *   tip       ( 15,  0)  — front point
 *   wingBack  (-12,-10)  — back of top wing (above spine)
 *   spineBack ( -3,  0)  — where the fold ends
 *   tailBack  ( -9,  7)  — back of bottom flap (below spine)
 *
 * The shape is asymmetric on purpose: the top wing extends further back
 * than the tail flap, giving the 3/4 above-side perspective that reads
 * as "paper plane" rather than "kite". Proportions are deliberately
 * stubby (aspect ~1.6:1) for a friendlier feel than a fighter-jet
 * silhouette.
 *
 * In flight, the plane is split into separate top-wing, bottom-flap,
 * and spine paths so we can independently animate each face for pitch
 * (climb/dive) response. Bank (turn rolling) is applied as a skewX on
 * a wrapping body group. The flat full-outline shape is shared with the
 * in-button icon (via PaperPlaneFlatShape) so the cross-fade at takeoff
 * is literally the same component fading between contexts. */

const PLANE_OUTLINE_D = "M15 0 L-12 -10 L-3 0 L-9 7 Z";
const PLANE_TOP_WING_D = "M15 0 L-12 -10 L-3 0 Z";
const PLANE_BOTTOM_FLAP_D = "M15 0 L-3 0 L-9 7 Z";
const PLANE_SPINE_D = "M15 0 L-3 0";

// ViewBox for the inline icon: encompasses the path bounds (x ∈ [-12, 15],
// y ∈ [-10, 7]) with 1-unit margins. Width 29, height 19.
const ICON_VIEWBOX_W = 29;
const ICON_VIEWBOX_H = 19;
// Native plane width in viewBox units — used to compute the launch scale
// that matches the icon's rendered size pixel-for-pixel at takeoff.
const PLANE_NATIVE_W = 27;
const ICON_DEFAULT_PX = 16;

/** Bare plane silhouette — no outer <svg>, used as the flat layer in
 *  both the in-button icon AND the flight plane's pre-rich state. Single
 *  source of truth for the "icon look", so the cross-fade at takeoff is
 *  literally the same DOM shape fading between two parents. */
function PaperPlaneFlatShape() {
  return (
    <>
      <path d={PLANE_OUTLINE_D} fill="white" />
      <path
        d={PLANE_SPINE_D}
        stroke="rgba(0,0,0,0.18)"
        strokeWidth="0.5"
        strokeLinecap="round"
        fill="none"
      />
    </>
  );
}

/** Inline icon used inside the share button. Wraps PaperPlaneFlatShape
 *  in a sized <svg>; the shape itself is identical to the flight plane's
 *  flat layer, ensuring a seamless visual handoff. */
function PaperPlaneIcon({ size = ICON_DEFAULT_PX }: { size?: number }) {
  const ratio = ICON_VIEWBOX_H / ICON_VIEWBOX_W;
  return (
    <svg
      width={size}
      height={size * ratio}
      viewBox={`-13 -11 ${ICON_VIEWBOX_W} ${ICON_VIEWBOX_H}`}
      style={{ overflow: "visible", display: "block" }}
      aria-hidden
    >
      <PaperPlaneFlatShape />
    </svg>
  );
}

/* ─── Click ripple at the share button ────────────────────────────── */

function ClickRipple({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.span
          key="ripple"
          aria-hidden
          className="absolute rounded-full pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            translate: "-50% -50%",
            width: 18,
            height: 18,
            background: "rgba(255,255,255,0.5)",
          }}
          initial={{ scale: 0, opacity: 0.7 }}
          animate={{ scale: 8, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.2, 0.6, 0.3, 1] }}
        />
      )}
    </AnimatePresence>
  );
}

/* ─── Main demo ───────────────────────────────────────────────────── */

export default function HeroDemo() {
  // Toggle the live path editor with `?editPath=1`. Reading the URL after
  // mount keeps this SSR-safe; the brief flash before mount is acceptable
  // for a dev-only tool.
  const [editPath, setEditPath] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditPath(new URLSearchParams(window.location.search).has("editPath"));
  }, []);
  if (editPath) return <PathEditor />;

  return <HeroDemoInner />;
}

function HeroDemoInner() {
  const containerRef = useRef<HTMLDivElement>(null);
  const planeIconRef = useRef<HTMLSpanElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const planeGroupRef = useRef<SVGGElement>(null);
  // Sub-refs for the layered flight plane.
  // body: outer transform stack (skew applied here for bank)
  // flat / rich: cross-faded layers — flat matches the icon, rich is shaded
  // shadow: drop shadow that fades in with the rich layer
  // topWing / bottomFlap: pitched independently for climb/dive response
  const planeBodyRef = useRef<SVGGElement>(null);
  const planeFlatRef = useRef<SVGGElement>(null);
  const planeRichRef = useRef<SVGGElement>(null);
  const planeShadowRef = useRef<SVGPathElement>(null);
  const planeTopWingRef = useRef<SVGGElement>(null);
  const planeBottomFlapRef = useRef<SVGGElement>(null);
  const dotRefs = useRef<Array<SVGCircleElement | null>>([]);

  // Trail dots — sampled along the flight path at constant arc-length
  // intervals. Each dot stores its parametric t (0..1); the RAF reveals
  // dots in order as the plane crosses each t. This sidesteps the
  // self-intersection problem inherent to mask-based reveals.
  const [dots, setDots] = useState<Array<{ x: number; y: number; t: number }>>(
    [],
  );

  // Effective end-of-flight length along the path. By default the plane
  // flies the full path; once we've measured the install card's top edge
  // (via a `data-flight-target` element below the demo) we trim this so
  // the plane lands exactly there.
  const [flightEndLen, setFlightEndLen] = useState<number | null>(null);

  const [stage, setStage] = useState<Stage>("init");
  const [typedUrl, setTypedUrl] = useState("");
  // The click sequence has two beats. The button is first *held down* for
  // PRESS_HOLD_MS so the user reads the click clearly, then it releases
  // and the response (button morph, URL type, plane takeoff) begins.
  const [pressFlash, setPressFlash] = useState(false);
  const [morphAndLaunch, setMorphAndLaunch] = useState(false);

  // Plane spawn — measured from the rendered position of the in-button
  // plane icon so takeoff lines up exactly with the button.
  const [planeStart, setPlaneStart] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // The flight path is a static curve; we translate the plane's rendered
  // position by the offset from the path's origin to the measured spawn
  // so it visually lifts off from the live button.
  const planePath = FLIGHT_PATH;
  const ox = planeStart ? planeStart.x - FLIGHT_PATH_ORIGIN_X : 0;
  const oy = planeStart ? planeStart.y - FLIGHT_PATH_ORIGIN_Y : 0;

  const reducedMotion = useReducedMotion();
  const inView = useInView(containerRef, { once: true, margin: "-15% 0px" });

  /* ── Measure plane spawn ─────────────────────────────────────── */
  useLayoutEffect(() => {
    const measure = () => {
      const container = containerRef.current;
      const icon = planeIconRef.current;
      if (!container || !icon) return;
      const cb = container.getBoundingClientRect();
      const ib = icon.getBoundingClientRect();
      const cx = ((ib.left + ib.width / 2 - cb.left) / cb.width) * VB_W;
      const cy = ((ib.top + ib.height / 2 - cb.top) / cb.height) * VB_H;
      setPlaneStart({ x: cx, y: cy });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  /* ── Sample dot positions along the flight path ─────────────── */
  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const total = path.getTotalLength();
    if (total === 0) return;
    const sampled: Array<{ x: number; y: number; t: number }> = [];
    for (let len = 0; len <= total; len += DOT_SPACING) {
      const pt = path.getPointAtLength(len);
      sampled.push({ x: pt.x, y: pt.y, t: len / total });
    }
    setDots(sampled);
  }, []);

  /* ── Trim the flight to land exactly at the install card ──────
   * Find the element marked `data-flight-target` (the glass card below
   * the hero) and compute the path length at which the trail crosses
   * the card's top edge. Re-runs on resize so it stays accurate at any
   * viewport. Without a target element, the plane flies the full path. */
  useLayoutEffect(() => {
    const path = pathRef.current;
    const container = containerRef.current;
    if (!path || !container) return;
    const total = path.getTotalLength();
    if (total === 0 || planeStart == null) return;

    const target = document.querySelector<HTMLElement>("[data-flight-target]");
    if (!target) {
      setFlightEndLen(total);
      return;
    }

    const compute = () => {
      const cb = container.getBoundingClientRect();
      const tb = target.getBoundingClientRect();
      // Card top relative to demo container, in CSS px
      const offsetPx = tb.top - cb.top;
      // Convert px → viewBox units (container scales the viewBox to its width)
      const cardTopVB = (offsetPx * VB_W) / cb.width;
      // The path is rendered translated by (ox, oy), so the path-local y
      // corresponding to card top is cardTopVB - oy.
      const targetY = cardTopVB - oy;

      // Walk backward from the path's end. The plane lands at the
      // first crossing (counting backward from the end) where path y
      // drops above target — that's the last point on the path where
      // y == targetY before continuing on to the actual end.
      const STEP = 2;
      let endLen = total;
      for (let len = total; len > 0; len -= STEP) {
        const pt = path.getPointAtLength(len);
        if (pt.y < targetY) {
          // Linear interp between this point (above target) and the
          // next-toward-end point (below target) for sub-step accuracy.
          const ptNext = path.getPointAtLength(Math.min(len + STEP, total));
          const denom = ptNext.y - pt.y;
          if (Math.abs(denom) > 0.001) {
            const t = (targetY - pt.y) / denom;
            endLen = len + STEP * Math.max(0, Math.min(1, t));
          } else {
            endLen = len;
          }
          break;
        }
      }
      setFlightEndLen(endLen);
    };

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    ro.observe(target);
    return () => ro.disconnect();
  }, [planeStart, oy]);

  /* ── Stage timeline ───────────────────────────────────────────
   * shareClicked and live overlap with plane flight: the plane
   * starts flying when shareClicked begins and finishes when done. */
  useEffect(() => {
    if (!inView) return;
    if (reducedMotion) {
      setStage("done");
      return;
    }
    const cancels: number[] = [];
    const at = (ms: number, fn: () => void) =>
      cancels.push(window.setTimeout(fn, ms));

    setStage("frameIn");
    at(600, () => setStage("idle"));
    at(1200, () => setStage("shareClicked"));
    // After the press releases AND the URL finishes typing, settle to
    // "live". The "done" transition is signaled from the flight RAF when
    // the plane actually reaches the end of its path.
    at(1200 + PRESS_HOLD_MS + URL_TYPE_MS, () => setStage("live"));

    return () => cancels.forEach((c) => clearTimeout(c));
  }, [inView, reducedMotion]);

  /* ── URL typing — kicks off when the button releases ──────────── */
  useEffect(() => {
    if (!morphAndLaunch) return;
    setTypedUrl("");
    let i = 0;
    const intervalId = window.setInterval(() => {
      i++;
      setTypedUrl(PUBLIC_URL.slice(0, i));
      if (i >= PUBLIC_URL.length) clearInterval(intervalId);
    }, URL_TYPE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [morphAndLaunch]);

  /* Reset typed URL when looping back to the start. */
  useEffect(() => {
    if (stage === "init" || stage === "frameIn" || stage === "idle") {
      setTypedUrl("");
    }
  }, [stage]);

  /* Reset the trail dots before the timeline starts. After
   * flight ends, the RAF leaves dot opacities at 1 and they persist. */
  useLayoutEffect(() => {
    if (stage === "init" || stage === "frameIn" || stage === "idle") {
      for (const el of dotRefs.current) {
        if (el) el.style.opacity = "0";
      }
    }
  }, [stage]);

  /* ── Plane flight ─────────────────────────────────────────────
   * Runs while the plane should be visible and animating. The RAF
   * tracks its own elapsed time, so the effect doesn't need to
   * re-run when stage transitions from shareClicked → live. */
  // Plane only takes off once the click press has released. During the
  // press-hold beat, no plane is moving — gives the click clarity.
  const planeShouldFly =
    (stage === "shareClicked" && morphAndLaunch) || stage === "live";
  useEffect(() => {
    const g = planeGroupRef.current;
    const path = pathRef.current;
    if (!g || !path) return;
    if (!planeShouldFly) {
      g.style.opacity = "0";
      return;
    }

    const total = path.getTotalLength();
    const dotsList = dots;
    // Centered-difference tangent estimate: samples a small window on
    // either side of the plane's current position, dampening any tiny
    // direction kinks at segment boundaries.
    const tangentAt = (len: number) => {
      const w = 6;
      const back = path.getPointAtLength(Math.max(len - w, 0));
      const fwd = path.getPointAtLength(Math.min(len + w, total));
      return (Math.atan2(fwd.y - back.y, fwd.x - back.x) * 180) / Math.PI;
    };

    // Effective end of flight — usually trimmed by flightEndLen so the
    // plane lands at the install card's top edge. Falls back to `total`
    // if no target was measured.
    const endLen = flightEndLen != null ? Math.min(flightEndLen, total) : total;

    // Dynamic speed (gravity-flavored): the plane slows climbing and
    // accelerates diving. baseSpeed uses `total` (not endLen) so the
    // px-per-second velocity stays constant regardless of trim — and
    // matches the editor preview exactly. Trimming just makes the flight
    // finish sooner; speed is unchanged.
    const baseSpeed = total / (FLIGHT_MS / 1000); // viewBox units per second
    const GRAVITY = 0.75; // strength of vertical influence on speed factor
    const RESPONSIVENESS = 2.5; // s⁻¹; how quickly speed adapts to direction
    const MIN_FACTOR = 0.35;
    const MAX_FACTOR = 1.95;

    let raf = 0;
    const launchStart = performance.now();
    let lastFrameTime = launchStart;
    let currentLen = 0;
    let speedFactor = 1;
    // Tracks the highest dot index that has been revealed so far.
    let lastDotIdx = -1;
    let wobblePhase = 0;
    // Bank angle (degrees, positive = banking right). Smoothed toward
    // a target derived from path curvature × current speed.
    let bankAngle = 0;
    // Pitch effect (-1 .. +1). Positive = climbing, negative = diving.
    // Drives wing scaleY for the climb/dive perspective shift.
    let pitchValue = 0;

    // Launch scale: plane starts at icon-size (matching the in-button
    // icon it "is") and grows to flight size. The starting scale is
    // computed dynamically so the rendered widths match pixel-for-pixel
    // at takeoff — the cross-fade is truly seamless at any viewport.
    //   icon visual width  = ICON_DEFAULT_PX × (PLANE_NATIVE_W / ICON_VIEWBOX_W)
    //   flight @ scale 1   = PLANE_NATIVE_W × (containerWidth / VB_W)
    // Setting LAUNCH_SCALE_FROM = (icon width) / (flight @1 width)
    // means the plane appears at exact icon size at t=0.
    const LAUNCH_DURATION_MS = 280;
    const containerWidth =
      containerRef.current?.getBoundingClientRect().width ?? VB_W;
    const iconRenderedWidth =
      ICON_DEFAULT_PX * (PLANE_NATIVE_W / ICON_VIEWBOX_W);
    const flightFullWidth = PLANE_NATIVE_W * (containerWidth / VB_W);
    const LAUNCH_SCALE_FROM =
      flightFullWidth > 0 ? iconRenderedWidth / flightFullWidth : 0.55;
    const LAUNCH_SCALE_TO = 1;
    // Launch kick — starts the plane well above baseline speed and
    // decays back to cruise. Reads as "thrown hard" — the plane bursts
    // out of the button rather than gently lifting.
    const LAUNCH_KICK_MS = 360;
    const LAUNCH_KICK_BOOST = 1.3;
    // Stability ramp — bank and pitch start at 0 (the plane hasn't
    // "settled" into dynamic motion yet) and ease in over this short
    // window. Decoupled from speed so the kick doesn't over-drive the
    // dynamic effects.
    const STABILITY_MS = 200;
    // Bank tuning. INTENSITY converts curvature (deg/unit-length) into
    // a target bank angle. CAP limits how dramatic the lean gets. SKEW
    // is the visual coefficient — multiplies bankAngle to a skewX in
    // degrees (skew is the 2D shorthand for roll). RESPONSE governs how
    // quickly bank tracks curvature; a small lag gives bank "weight".
    const BANK_INTENSITY = 55;
    const BANK_CAP = 16;
    const BANK_SKEW = 0.5;
    const BANK_RESPONSE = 4.2;
    // Pitch tuning. Top wing shrinks/grows ±20% with climb/dive; bottom
    // flap is the smaller surface so a slightly bigger swing reads
    // better. PITCH_RESPONSE is similar to BANK_RESPONSE.
    const PITCH_TOP_AMT = 0.2;
    const PITCH_BOTTOM_AMT = 0.32;
    const PITCH_RESPONSE = 3.5;

    const step = (now: number) => {
      // Clamp dt to handle background-tab catch-up (otherwise a giant dt
      // would teleport the plane forward when the tab refocuses).
      const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
      lastFrameTime = now;

      // Path direction at current position. dyNorm: +1 = pure down, -1 = pure up.
      const w = 6;
      const back = path.getPointAtLength(Math.max(currentLen - w, 0));
      const fwd = path.getPointAtLength(Math.min(currentLen + w, total));
      const dx = fwd.x - back.x;
      const dy = fwd.y - back.y;
      const dirLen = Math.hypot(dx, dy);
      const dyNorm = dirLen > 0 ? dy / dirLen : 0;

      // Target speed factor based on direction; smooth toward it so the
      // plane has a sense of momentum.
      const targetFactor = Math.max(
        MIN_FACTOR,
        Math.min(MAX_FACTOR, 1 + GRAVITY * dyNorm),
      );
      speedFactor +=
        (targetFactor - speedFactor) * (1 - Math.exp(-RESPONSIVENESS * dt));

      // Launch kick: speed boost that decays. At t=0 the plane moves at
      // (1 + LAUNCH_KICK_BOOST)× baseline; by LAUNCH_KICK_MS it's back
      // to cruise. Reads as the plane being thrown forward.
      const elapsedMs = now - launchStart;
      const kickT = Math.min(1, elapsedMs / LAUNCH_KICK_MS);
      const launchKick = 1 + LAUNCH_KICK_BOOST * Math.pow(1 - kickT, 2);
      // Stability ramp 0 → 1 (ease-out) — gates dynamic effects (bank,
      // pitch) so they don't fire at full strength during the kick.
      const stabilityT = Math.min(1, elapsedMs / STABILITY_MS);
      const stability = 1 - Math.pow(1 - stabilityT, 2);

      const speed = baseSpeed * speedFactor * launchKick;
      currentLen = Math.min(endLen, currentLen + speed * dt);

      // Plane visual updates
      const pt = path.getPointAtLength(currentLen);
      const angle = tangentAt(currentLen);
      // Mild airflow wobble, perpendicular to direction of travel.
      wobblePhase += dt * 8.5;
      const wobble = Math.sin(wobblePhase) * 0.6;
      const rad = (angle * Math.PI) / 180;
      const wx = Math.cos(rad + Math.PI / 2) * wobble;
      const wy = Math.sin(rad + Math.PI / 2) * wobble;

      // Fade based on remaining distance, not elapsed time.
      const remaining = (endLen - currentLen) / endLen;
      const fade = remaining < 0.12 ? Math.max(0, remaining / 0.12) : 1;

      // Launch scale + cross-fade: the plane starts icon-size and
      // matches the in-button icon's flat fill, then grows to flight
      // size while the rich (gradient + spine highlight + tip specular)
      // layer fades in. By the time the scale settles at 1, the rich
      // detail has fully filled in — single unified "transformation".
      const launchT = Math.min(1, (now - launchStart) / LAUNCH_DURATION_MS);
      const launchEased = 1 - Math.pow(1 - launchT, 3);
      const launchScale =
        LAUNCH_SCALE_FROM + (LAUNCH_SCALE_TO - LAUNCH_SCALE_FROM) * launchEased;

      // Bank: target derived from path curvature (rate of tangent change
      // over a small window). Multiplied by speed and stability so that
      // bank starts at 0 and ramps in cleanly without being amplified
      // by the launch kick.
      const BANK_WINDOW = 12;
      const tBack = path.getPointAtLength(
        Math.max(currentLen - BANK_WINDOW, 0),
      );
      const tFwd = path.getPointAtLength(
        Math.min(currentLen + BANK_WINDOW, total),
      );
      const angleAhead =
        (Math.atan2(tFwd.y - back.y, tFwd.x - back.x) * 180) / Math.PI;
      const angleBehind =
        (Math.atan2(fwd.y - tBack.y, fwd.x - tBack.x) * 180) / Math.PI;
      let dTheta = angleAhead - angleBehind;
      // Wrap to (-180, 180] so curvature is always the shortest arc.
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

      // Pitch: -dyNorm so positive = climbing. Multiplied by stability
      // so the wing flex at takeoff is 0 and ramps in cleanly.
      const pitchTarget = -dyNorm * stability;
      pitchValue +=
        (pitchTarget - pitchValue) * (1 - Math.exp(-PITCH_RESPONSE * dt));

      // Outer transform: position + yaw + scale.
      g.setAttribute(
        "transform",
        `translate(${pt.x + ox + wx} ${pt.y + oy + wy}) rotate(${angle}) scale(${launchScale})`,
      );
      g.style.opacity = String(fade);

      // Body skewX = bank (roll). Doesn't apply to the shadow.
      if (planeBodyRef.current) {
        planeBodyRef.current.setAttribute(
          "transform",
          `skewX(${bankAngle * BANK_SKEW})`,
        );
      }

      // Pitch: wings scale around the spine (y=0 in plane-local coords).
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

      // Cross-fade flat → rich; shadow rides the same curve.
      if (planeFlatRef.current) {
        planeFlatRef.current.style.opacity = String(1 - launchEased);
      }
      if (planeRichRef.current) {
        planeRichRef.current.style.opacity = String(launchEased);
      }
      if (planeShadowRef.current) {
        planeShadowRef.current.style.opacity = String(launchEased);
      }

      // Reveal trail dots whose parametric t is now behind the plane.
      const progress = currentLen / total;
      while (
        lastDotIdx < dotsList.length - 1 &&
        progress >= dotsList[lastDotIdx + 1].t
      ) {
        lastDotIdx++;
        const el = dotRefs.current[lastDotIdx];
        if (el) el.style.opacity = "1";
      }

      if (currentLen < endLen) {
        raf = requestAnimationFrame(step);
      } else {
        // Flight complete — signal the timeline to advance and broadcast
        // a window event so the install area below can light up in
        // response. (Decoupled via window event so page.tsx stays a
        // server component.)
        setStage((s) => (s === "shareClicked" || s === "live" ? "done" : s));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("hero-flight-complete"));
        }
      }
    };

    g.style.opacity = "1";
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [planeShouldFly, planeStart, ox, oy, dots, flightEndLen]);

  /* Drive the press / release beats from the stage timeline. */
  useEffect(() => {
    if (stage === "shareClicked") {
      setPressFlash(true);
      const release = window.setTimeout(() => {
        setPressFlash(false);
        setMorphAndLaunch(true);
      }, PRESS_HOLD_MS);
      return () => clearTimeout(release);
    }
    if (stage === "init" || stage === "frameIn" || stage === "idle") {
      setPressFlash(false);
      setMorphAndLaunch(false);
    }
  }, [stage]);

  /* ── Derived UI flags ─────────────────────────────────────── */
  // `isPublic` flips once the user has clicked AND the press has released —
  // the button label, URL display, and lock/globe icon all key off it.
  const isPublic = morphAndLaunch || stage === "live" || stage === "done";
  const showShareLive = isPublic;
  const buttonPressed = stage === "shareClicked";
  const inButtonPlaneVisible =
    stage === "init" || stage === "frameIn" || stage === "idle";
  const showCaret =
    stage === "shareClicked" &&
    morphAndLaunch &&
    typedUrl.length < PUBLIC_URL.length;
  const frameVisible = stage !== "init";

  const displayedUrl = (() => {
    if (stage === "shareClicked") return typedUrl;
    if (isPublic) return PUBLIC_URL;
    return PRIVATE_URL;
  })();

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[760px] mx-auto"
      style={{ aspectRatio: `${VB_W} / ${VB_H}` }}
    >
      {/* Soft glow underneath the chrome */}
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          left: "50%",
          top: "30%",
          translate: "-50% 0",
          width: "75%",
          height: "30%",
          background:
            "radial-gradient(ellipse at center, rgba(79,70,229,0.10) 0%, rgba(79,70,229,0) 70%)",
          filter: "blur(10px)",
        }}
      />

      {/* SVG overlay: flight path + plane.
          overflow:visible lets the plane render above and below the
          container — into the headline space and the section beneath. */}
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
        style={{ overflow: "visible" }}
        aria-hidden
      >
        <defs>
          <filter id="planeBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
          {/* Top-wing fill — lit face. Radial gradient from the tip
              outward, so the leading edge catches the brightest light. */}
          <radialGradient
            id="planeLitFace"
            cx="0.95"
            cy="0.55"
            r="1.05"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f3eef9" />
            <stop offset="100%" stopColor="#dcd4eb" />
          </radialGradient>
          {/* Bottom-flap fill — shaded underside. Linear gradient from
              spine (lighter, near the camera) to the far edge (darker). */}
          <linearGradient
            id="planeShadedFace"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor="#bcb3d2" />
            <stop offset="100%" stopColor="#8c83ad" />
          </linearGradient>
          {/* Hides the plane/trail inside the chrome rectangle so they
              don't visually overlap the URL bar.

              Note: the explicit x/y/width/height are critical. The default
              mask region (≈ -10% / 120% of the viewport) is too small to
              contain a flight path that extends far above and to either
              side of the viewBox; areas outside the mask region are
              treated as hidden, which would clip large chunks of the
              trail. */}
          <mask
            id="chromeMask"
            maskUnits="userSpaceOnUse"
            x="-2000"
            y="-2000"
            width="4000"
            height="4000"
          >
            <rect x="-2000" y="-2000" width="4000" height="4000" fill="white" />
            <rect
              x={VB_W * 0.05}
              y={VB_H * 0.1}
              width={VB_W * 0.9}
              height={VB_H * 0.22}
              rx="14"
              fill="black"
            />
          </mask>
        </defs>

        {/* Trail — one circle per sampled point along the path. Each dot's
            visibility is driven by the plane's parametric progress, so
            self-intersecting paths reveal correctly (the spatial pixel
            isn't shared between crossings — each crossing is its own
            dots with their own t values). */}
        <g mask="url(#chromeMask)" pointerEvents="none">
          {dots.map((dot, i) => (
            <circle
              key={i}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              cx={dot.x + ox}
              cy={dot.y + oy}
              r={1.6}
              fill="rgba(79,70,229,0.65)"
              style={{ opacity: 0 }}
            />
          ))}
        </g>

        {/* Flight plane — masked so it slides "behind" the chrome strip
            when its path crosses through that region.

            The plane is a layered structure so we can drive each piece
            from the RAF independently:

              outer (planeGroupRef): translate + rotate(yaw) + scale(launch)
                shadow (planeShadowRef): drop shadow, opacity-faded with launch
                body (planeBodyRef): skewX(bank) — bank doesn't deform shadow
                  flat layer (planeFlatRef): icon-style flat fill, fades out
                  rich layer (planeRichRef): gradient + spine + tip light, fades in
                    bottomFlap (planeBottomFlapRef): scaleY for pitch
                    topWing (planeTopWingRef): scaleY for pitch */}
        <g ref={planeGroupRef} style={{ opacity: 0 }} mask="url(#chromeMask)">
          {/* Drop shadow — outside the body so banking doesn't skew it */}
          <path
            ref={planeShadowRef}
            d={PLANE_OUTLINE_D}
            fill="rgba(40, 30, 80, 0.24)"
            transform="translate(0.6 1.8)"
            filter="url(#planeBlur)"
            style={{ opacity: 0 }}
          />
          <g ref={planeBodyRef}>
            {/* Flat layer — literally the same component as the in-button
                icon, so the cross-fade is the same shape transitioning
                from one parent to another (no visual discontinuity). */}
            <g ref={planeFlatRef}>
              <PaperPlaneFlatShape />
            </g>
            {/* Rich layer — gradients, spine highlight, tip specular */}
            <g ref={planeRichRef} style={{ opacity: 0 }}>
              <g ref={planeBottomFlapRef}>
                <path d={PLANE_BOTTOM_FLAP_D} fill="url(#planeShadedFace)" />
              </g>
              <g ref={planeTopWingRef}>
                <path d={PLANE_TOP_WING_D} fill="url(#planeLitFace)" />
              </g>
              {/* Spine fold — dark line marking the crease */}
              <path
                d={PLANE_SPINE_D}
                stroke="rgba(60, 50, 100, 0.30)"
                strokeWidth="0.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Spine highlight — soft white line just above the fold,
                  reads as the lit edge of the ridge */}
              <path
                d={PLANE_SPINE_D}
                stroke="rgba(255, 255, 255, 0.55)"
                strokeWidth="0.45"
                strokeLinecap="round"
                fill="none"
                transform="translate(0 -0.55)"
                opacity="0.85"
              />
              {/* Tip specular — paper catching front light. Positioned
                  on the upper-front face (between tip and wing edge). */}
              <circle
                cx="10"
                cy="-1.8"
                r="1.5"
                fill="rgba(255, 255, 255, 0.6)"
                filter="url(#planeBlur)"
              />
            </g>
          </g>
        </g>

        {/* Hidden path used for getPointAtLength. */}
        {planePath && (
          <path ref={pathRef} d={planePath} fill="none" stroke="none" />
        )}
      </svg>

      {/* Browser chrome strip */}
      <motion.div
        className="absolute z-10"
        style={{
          left: "5%",
          right: "5%",
          top: "10%",
          height: "22%",
        }}
        initial={{ opacity: 0, y: 16, scale: 0.985 }}
        animate={{
          opacity: frameVisible ? 1 : 0,
          y: frameVisible ? 0 : 16,
          scale: frameVisible ? 1 : 0.985,
        }}
        transition={{
          duration: 0.65,
          ease: [0.22, 1, 0.36, 1],
        }}
      >
        <div className="relative w-full h-full rounded-xl border border-[#dcd7d1] bg-white shadow-[0_30px_70px_-18px_rgba(42,37,32,0.30),0_8px_18px_-8px_rgba(42,37,32,0.14)] overflow-hidden">
          {/* Top inner highlight */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white to-transparent opacity-80 rounded-t-xl"
          />

          <div className="relative flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-full">
            {/* URL bar */}
            <motion.div
              className="flex-1 min-w-0 flex items-center gap-2 sm:gap-2.5 h-9 sm:h-10 px-2.5 sm:px-4 rounded-lg bg-[#f8f6f3] border font-mono"
              animate={{
                borderColor: isPublic ? "rgba(79,70,229,0.45)" : "#e3dfd9",
                boxShadow: isPublic
                  ? "0 0 0 4px rgba(79,70,229,0.10), inset 0 1px 0 rgba(0,0,0,0.02)"
                  : "0 0 0 0 rgba(79,70,229,0), inset 0 1px 0 rgba(0,0,0,0.02)",
                backgroundColor: isPublic ? "#ffffff" : "#f8f6f3",
              }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isPublic ? (
                  <motion.span
                    key="globe"
                    initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.6, rotate: 90 }}
                    transition={{
                      duration: 0.32,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="flex shrink-0"
                  >
                    <Globe size={14} className="text-[var(--accent)]" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="lock"
                    initial={{ opacity: 0, scale: 0.6, rotate: -90 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    exit={{ opacity: 0, scale: 0.6, rotate: 90 }}
                    transition={{
                      duration: 0.32,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="flex shrink-0"
                  >
                    <Lock size={13} className="text-[#9b9590]" />
                  </motion.span>
                )}
              </AnimatePresence>
              <span
                className="truncate text-[12px] sm:text-[15px] tracking-tight text-[#2d2926] tabular-nums"
                style={{ minWidth: 0 }}
              >
                {displayedUrl}
                {showCaret && (
                  <motion.span
                    className="inline-block w-[2px] h-[16px] align-middle ml-[2px] bg-[var(--accent)] rounded-[1px]"
                    animate={{ opacity: [1, 0.15, 1] }}
                    transition={{
                      duration: 0.7,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                )}
              </span>
            </motion.div>

            {/* Share button — contains the plane icon, morphs to "● Live"
                when clicked. Uses framer-motion's `layout` so the width
                animates smoothly between the two states.

                Once the button has morphed to Live, clicking it scrolls
                to the install card below — the obvious next step for
                someone who's just watched the demo. During the animated
                Share state it stays decorative (the demo auto-presses
                it, manual clicks are a no-op). */}
            <motion.button
              type="button"
              tabIndex={showShareLive ? 0 : -1}
              aria-hidden={showShareLive ? undefined : true}
              aria-label={showShareLive ? "Jump to install steps" : undefined}
              onClick={
                showShareLive
                  ? () => {
                      const target = document.querySelector(
                        "[data-flight-target]",
                      );
                      if (target) {
                        target.scrollIntoView({
                          behavior: "smooth",
                          block: "center",
                        });
                      }
                    }
                  : undefined
              }
              layout
              className={`relative inline-flex items-center justify-center h-9 sm:h-10 px-3 sm:px-4 rounded-lg text-[12px] sm:text-[14px] font-sans font-medium text-white overflow-hidden shrink-0 ${
                showShareLive ? "cursor-pointer" : ""
              }`}
              style={{
                background:
                  "linear-gradient(180deg, #6960ed 0%, #4f46e5 55%, #4338ca 100%)",
              }}
              animate={{
                scale: pressFlash ? 0.9 : 1,
                boxShadow: showShareLive
                  ? "0 0 0 4px rgba(79,70,229,0.18), 0 6px 16px -4px rgba(79,70,229,0.40), inset 0 2px 4px rgba(0,0,0,0.20)"
                  : pressFlash
                    ? "0 1px 3px rgba(79,70,229,0.40), inset 0 3px 6px rgba(0,0,0,0.30)"
                    : "0 4px 12px -4px rgba(79,70,229,0.50), inset 0 1px 0 rgba(255,255,255,0.25)",
              }}
              transition={{
                scale: pressFlash
                  ? { duration: 0.14, ease: [0.4, 0, 0.4, 1] }
                  : {
                      type: "spring",
                      stiffness: 320,
                      damping: 14,
                      mass: 0.8,
                    },
                boxShadow: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                layout: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
              }}
            >
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-white/40"
              />
              <ClickRipple active={buttonPressed} />

              <AnimatePresence mode="popLayout" initial={false}>
                {showShareLive ? (
                  <motion.span
                    key="live"
                    className="flex items-center gap-1.5 relative text-white"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <motion.span
                      className="w-1.5 h-1.5 rounded-full bg-white"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                    />
                    Live
                  </motion.span>
                ) : (
                  <motion.span
                    key="share"
                    className="flex items-center gap-2 relative text-white"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  >
                    Share
                    {/* In-button plane icon — measured for the flight
                        spawn point so takeoff is pixel-perfect. The flight
                        plane in the SVG overlay uses the same shape, so the
                        cross-fade reads as "the icon flew out". */}
                    <motion.span
                      ref={planeIconRef}
                      className="inline-flex"
                      animate={{
                        opacity: inButtonPlaneVisible ? 1 : 0,
                      }}
                      transition={{
                        duration: 0.18,
                        ease: [0.4, 0, 0.6, 1],
                      }}
                    >
                      <PaperPlaneIcon size={16} />
                    </motion.span>
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Soft purple radial blur that "ignites" behind the install steps once
 * the hero flight animation reaches its end. Listens for the
 * `hero-flight-complete` window event dispatched by HeroDemo.
 *
 * Visual story: the plane carries the user's attention down to the
 * install area; on landing, the area blooms with brand-color light and
 * settles into a soft ambient glow.
 */
export default function InstallGlow() {
  const [lit, setLit] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const handler = () => setLit(true);
    window.addEventListener("hero-flight-complete", handler);
    return () => window.removeEventListener("hero-flight-complete", handler);
  }, []);

  // With reduced motion: skip the bloom; show the ambient glow only.
  const animate = lit
    ? reducedMotion
      ? { opacity: 0.55, scale: 1 }
      : {
          opacity: [0, 1, 0.6],
          scale: [0.6, 1.18, 1],
        }
    : { opacity: 0, scale: 0.6 };

  const transition = reducedMotion
    ? { duration: 0.4 }
    : {
        duration: 1.6,
        times: [0, 0.38, 1],
        ease: [0.22, 1, 0.36, 1] as const,
      };

  return (
    <>
      {/* Outer atmospheric bloom — sits well outside the glass card so it
          reads as a halo around the whole quickstart, not clipped by the
          card's edges. Heavy blur, soft falloff. */}
      <motion.div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: "-110px",
          background:
            "radial-gradient(ellipse 70% 60% at 50% 30%, rgba(79, 70, 229, 0.50) 0%, rgba(99, 90, 240, 0.24) 35%, rgba(79, 70, 229, 0.06) 60%, transparent 78%)",
          filter: "blur(44px)",
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={animate}
        transition={transition}
      />
      {/* Inner core — tighter and brighter, sits directly behind the
          glass so the saturate-150 backdrop filter amplifies it into a
          visible indigo wash through the card. */}
      <motion.div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: "-30px",
          background:
            "radial-gradient(ellipse 60% 50% at 50% 35%, rgba(79, 70, 229, 0.55) 0%, rgba(124, 113, 245, 0.22) 45%, transparent 75%)",
          filter: "blur(20px)",
        }}
        initial={{ opacity: 0, scale: 0.7 }}
        animate={animate}
        transition={transition}
      />
    </>
  );
}

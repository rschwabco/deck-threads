"use client";

import { useEffect } from "react";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function VisualParallax() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const visuals = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-parallax]"));
    if (!visuals.length) return;

    let frame = 0;

    const render = () => {
      frame = 0;
      const viewportCenter = window.innerHeight / 2;

      for (const visual of visuals) {
        const rect = visual.getBoundingClientRect();
        const visualCenter = rect.top + rect.height / 2;
        const speed = Number(visual.dataset.parallaxSpeed ?? 0.08);
        const maxOffset = Number(visual.dataset.parallaxMax ?? 72);
        const offset = clamp((viewportCenter - visualCenter) * speed, -maxOffset, maxOffset);

        visual.style.setProperty("--parallax-y", `${offset.toFixed(2)}px`);
      }
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    render();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      for (const visual of visuals) visual.style.removeProperty("--parallax-y");
    };
  }, []);

  return null;
}

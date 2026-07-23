"use client";

import { useEffect, useRef } from "react";

const INSTALLER_DOWNLOAD = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1-beta.1/Deck-Threads-Installer.dmg";
const COMPANION_DOWNLOAD = "https://github.com/rschwabco/deck-threads/releases/download/v1.0.1-beta.1/Deck-Threads-Companion.dmg";

const keys = [
  { label: "DT1", title: "Deck Threads site", state: "working" },
  { label: "MP1", title: "Marketplace plan", state: "read" },
  { label: "QA2", title: "Review release", state: "unread" },
  { label: "?", title: "Needs your input", state: "question" },
  { label: "NX1", title: "Nexus integration", state: "read" },
  { label: "DT2", title: "Package companion", state: "working" },
  { label: "AS1", title: "Stand up QA", state: "read" },
  { label: "MP2", title: "Fix support routing", state: "read" },
];

export default function HeroStage() {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let pointerX = 0;
    let pointerY = 0;

    const render = () => {
      frame = 0;
      const rect = hero.getBoundingClientRect();
      const scrollProgress = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)));

      hero.style.setProperty("--copy-x", `${pointerX * -5}px`);
      hero.style.setProperty("--copy-y", `${(pointerY * -4) - (scrollProgress * 42)}px`);
      hero.style.setProperty("--visual-x", `${pointerX * 18}px`);
      hero.style.setProperty("--visual-y", `${(pointerY * 12) - (scrollProgress * 108)}px`);
      hero.style.setProperty("--glow-x", `${pointerX * -28}px`);
      hero.style.setProperty("--glow-y", `${pointerY * -20}px`);
      hero.style.setProperty("--deck-rotate-x", `${56 - (pointerY * 4)}deg`);
      hero.style.setProperty("--deck-rotate-y", `${pointerX * 4}deg`);
      hero.style.setProperty("--deck-rotate-z", `${-18 + (pointerX * 2)}deg`);
    };

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(render);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = hero.getBoundingClientRect();
      pointerX = ((event.clientX - rect.left) / Math.max(rect.width, 1) - 0.5) * 2;
      pointerY = ((event.clientY - rect.top) / Math.max(rect.height, 1) - 0.5) * 2;
      schedule();
    };

    const onPointerLeave = () => {
      pointerX = 0;
      pointerY = 0;
      schedule();
    };

    render();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    hero.addEventListener("pointermove", onPointerMove, { passive: true });
    hero.addEventListener("pointerleave", onPointerLeave);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      hero.removeEventListener("pointermove", onPointerMove);
      hero.removeEventListener("pointerleave", onPointerLeave);
    };
  }, []);

  return (
    <section className="hero" id="top" ref={heroRef} data-parallax-root>
      <div className="hero-copy" data-parallax-copy>
        <div className="eyebrow"><span className="live-dot" /> Built for desktop coding agents</div>
        <h1>Your tasks.<br /><span>Within reach.</span></h1>
        <p className="hero-lede">
          Deck Threads puts eight active coding-agent tasks on Stream Deck. See what needs you and press a key to open the exact task.
        </p>
        <div className="hero-actions">
          <a className="button button-primary" href={INSTALLER_DOWNLOAD} download>
            <span>Download app + plugin (.dmg)</span><span aria-hidden="true">↓</span>
          </a>
          <a className="button button-secondary" href={COMPANION_DOWNLOAD} download>
            Companion app only (.dmg)
          </a>
        </div>
        <p className="requirements">Universal macOS beta · Developer ID signed · Apple notarization pending</p>
      </div>

      <div className="hero-visual" role="img" aria-label="Eight active coding-agent tasks mapped to Stream Deck keys" data-parallax-visual>
        <div className="deck-glow" aria-hidden="true" />
        <div className="deck-shell" data-parallax-shell>
          <div className="deck-topline"><span>8 ACTIVE TASKS</span><span className="connection"><i /> CONNECTED</span></div>
          <div className="key-grid">
            {keys.map((key) => (
              <div className={`task-key ${key.state}`} key={`${key.label}-${key.title}`}>
                <span className="key-label">{key.label}</span>
                <span className="key-title">{key.title}</span>
                {key.state === "working" && <span className="working-wave" aria-hidden="true" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

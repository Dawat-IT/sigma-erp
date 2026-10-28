"use client";

import { useEffect } from "react";
import gsap from "gsap";

export function animateIn(
  el: HTMLElement | null,
  opts?: { y?: number; delay?: number; duration?: number },
) {
  if (!el) return;
  gsap.fromTo(
    el,
    { opacity: 0, y: opts?.y ?? 20 },
    {
      opacity: 1,
      y: 0,
      duration: opts?.duration ?? 0.8,
      delay: opts?.delay ?? 0,
      ease: "expo.out",
    },
  );
}

export function animateStagger(
  els: HTMLElement[] | NodeListOf<Element>,
  opts?: { y?: number; stagger?: number; duration?: number },
) {
  if (!els.length) return;
  gsap.fromTo(
    els,
    { opacity: 0, y: opts?.y ?? 20 },
    {
      opacity: 1,
      y: 0,
      duration: opts?.duration ?? 0.8,
      stagger: opts?.stagger ?? 0.05,
      ease: "expo.out",
    },
  );
}

export function animateCardsIn(container: HTMLElement | null) {
  if (!container) return;
  const cards = container.querySelectorAll<HTMLElement>("[data-animate='card']");
  if (!cards.length) {
    animateIn(container, { y: 20 });
    return;
  }
  gsap.fromTo(
    cards,
    { opacity: 0, y: 24, scale: 0.95 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.8,
      stagger: 0.05,
      ease: "expo.out",
    },
  );
}

export function animateModalIn(backdrop: HTMLElement | null, panel: HTMLElement | null) {
  if (!backdrop || !panel) return;
  gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power2.out" });
  gsap.fromTo(
    panel,
    { opacity: 0, y: 30, scale: 0.95 },
    { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: "expo.out" },
  );
}

export function animateModalOut(
  backdrop: HTMLElement | null,
  panel: HTMLElement | null,
  onDone: () => void,
) {
  if (!backdrop || !panel) {
    onDone();
    return;
  }
  gsap.to(backdrop, { opacity: 0, duration: 0.2, ease: "power2.in" });
  gsap.to(panel, {
    opacity: 0,
    y: 15,
    scale: 0.97,
    duration: 0.2,
    ease: "power2.in",
    onComplete: onDone,
  });
}

export function usePageEnter(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    animateIn(ref.current, { y: 16 });
  }, [ref]);
}

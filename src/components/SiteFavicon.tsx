"use client";

import { useEffect } from "react";

export function applySiteFavicon() {
  if (typeof document === "undefined") return;
  const href = `/api/favicon?t=${Date.now()}`;
  const links = document.querySelectorAll<HTMLLinkElement>("link[rel='icon'], link[rel='shortcut icon']");
  if (links.length) {
    links.forEach((link) => {
      link.type = "image/png";
      link.href = href;
    });
    return;
  }
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = href;
  document.head.appendChild(link);
}

export function SiteFavicon() {
  useEffect(() => {
    applySiteFavicon();
  }, []);
  return null;
}

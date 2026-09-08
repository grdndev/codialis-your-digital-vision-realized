"use client";

import { useEffect, useRef } from "react";

const SCRIPT_SRC = "https://assets.calendly.com/assets/external/widget.js";

export function CalendlyEmbed({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const themedUrl = `${url}?background_color=111a2b&text_color=e7edf5&primary_color=2bf08a&hide_gdpr_banner=1`;

  return (
    <div
      ref={containerRef}
      className="calendly-inline-widget overflow-hidden rounded-lg"
      data-url={themedUrl}
      style={{ minWidth: "320px", height: "700px" }}
    />
  );
}

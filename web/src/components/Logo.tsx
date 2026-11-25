import { useId } from "react";

export const APP_NAME = "Cookie Scraping Tools";

/** Logo aplikasi: cookie tergigit dengan "remah data" yang keluar. Samakan dengan web/public/favicon.svg. */
export function Logo({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#14b3a9" />
          <stop offset="0.55" stopColor="#007c7e" />
          <stop offset="1" stopColor="#3a4481" />
        </linearGradient>
        <mask id={`${id}bite`}>
          <rect width="40" height="40" fill="#fff" />
          <circle cx="29.5" cy="13.5" r="5.5" fill="#000" />
          <circle cx="23" cy="8.5" r="3.5" fill="#000" />
        </mask>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${id}bg)`} />
      <circle cx="19" cy="21" r="12" fill="#fff" mask={`url(#${id}bite)`} />
      <g fill="#0f4f55">
        <circle cx="14.5" cy="17" r="2.1" />
        <circle cx="20.5" cy="22.5" r="2.4" />
        <circle cx="14" cy="26" r="1.6" />
        <circle cx="24.5" cy="28" r="1.4" />
      </g>
      <g fill="#fff">
        <rect x="29.5" y="8" width="3.6" height="3.6" rx="1" />
        <rect x="34" y="14" width="2.4" height="2.4" rx="0.7" opacity="0.75" />
        <rect x="31" y="4" width="2" height="2" rx="0.6" opacity="0.55" />
      </g>
    </svg>
  );
}

/**
 * src/components/kit/Icon.tsx
 *
 * The prototype's icon set, copied path-for-path. They are drawn to sit inside
 * the sticker construction (1.7 stroke, square joins) — a general icon pack
 * reads a degree softer than everything around it, so these stay as they were.
 */
const PATHS = {
  home: (
    <><path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1V10.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></>
  ),
  trophy: (
    <><path d="M6 3h12v4a6 6 0 0 1-12 0V3Z" stroke="currentColor" strokeWidth="1.7"/><path d="M6 5H3v2a4 4 0 0 0 4 4M18 5h3v2a4 4 0 0 1-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M12 13v4M9 21h6M10 17h4v4h-4v-4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></>
  ),
  team: (
    <><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7"/><circle cx="17" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.7"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.7"/><path d="M15.5 14.2c2.4.4 4.5 2.4 4.5 5.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></>
  ),
  match: (
    <><path d="M4 6h7l-2 6 2 6H4V6ZM20 6h-7l2 6-2 6h7V6Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></>
  ),
  user: (
    <><circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7"/><path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" stroke="currentColor" strokeWidth="1.7"/></>
  ),
  bell: (
    <><path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5 1.5 5h-15S6 14 6 10Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M10 18a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.7"/></>
  ),
  search: (
    <><circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.7"/><path d="m19 19-4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></>
  ),
  check: (
    <><path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>
  ),
  plus: (
    <><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></>
  ),
  chev: (
    <><path d="m8 5 8 7-8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>
  ),
  chevL: (
    <><path d="m16 5-8 7 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></>
  ),
  warn: (
    <><path d="M12 4 2.5 20h19L12 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></>
  ),
  clock: (
    <><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7"/><path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></>
  ),
  star: (
    <><path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 9.8l5.9-.8L12 3.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></>
  ),
  shield: (
    <><path d="M12 3.5 5 6v6c0 4.2 3 7.4 7 8.5 4-1.1 7-4.3 7-8.5V6l-7-2.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></>
  ),
  cog: (
    <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7"/><path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4 5.6 5.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></>
  ),
  pin: (
    <><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.7"/></>
  ),
  out: (
    <><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M10 8l-4 4 4 4M6 12h9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></>
  ),
  sun: (
    <><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.7"/><path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></>
  ),
  moon: (
    <><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></>
  ),
}

export type IconName = keyof typeof PATHS

interface IconProps {
  name: IconName
  size?: number
  className?: string
}

export function Icon({ name, size = 15, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      {PATHS[name]}
    </svg>
  )
}

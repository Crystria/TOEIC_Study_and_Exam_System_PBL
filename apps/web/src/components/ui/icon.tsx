import type { SVGProps } from 'react';

const paths = {
  book: 'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4V4Zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3V4Z',
  grid: 'M3 3h7v7H3V3Zm11 0h7v7h-7V3ZM3 14h7v7H3v-7Zm11 0h7v7h-7v-7Z',
  layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
  headphones: 'M4 14v-3a8 8 0 0 1 16 0v3M4 13H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Z',
  clipboard: 'M9 5H5v16h14V5h-4M9 3h6v4H9V3Zm0 9h6m-6 4h4',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  chart: 'M4 3v17h17M8 15l4-5 4 2 5-7',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  menu: 'M4 6h16M4 12h16M4 18h16',
  flame: 'M13 3c1 6-4 6-2 10 1-1 3-2 3-5 4 3 6 6 4 10-3 6-13 4-13-3 0-4 4-6 8-12Z',
  target: 'M21 12a9 9 0 1 1-9-9m6 9a6 6 0 1 1-6-6m3 6a3 3 0 1 1-3-3m0 3 9-9m-5 0h5v5',
  sparkles: 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  eyeOff:
    'm3 3 18 18M10 5a12 12 0 0 1 12 7s-1 2-3 4M6 6a19 19 0 0 0-4 6s4 7 10 7c2 0 3-.5 4-1M10 10a3 3 0 0 0 4 4',
  mail: 'M3 5h18v14H3V5Zm0 1 9 7 9-7',
  lock: 'M6 10h12v11H6V10Zm2 0V7a4 4 0 0 1 8 0v3',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  info: 'M12 11v6m0-10v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6',
  calendar: 'M4 5h16v16H4V5Zm0 5h16M8 3v4m8-4v4M8 14h2m4 0h2m-8 3h2',
  logout: 'M10 4H4v16h6m4-13 5 5-5 5m-6-5h13',
  search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  volume: 'm3 9 5 0 5-5v16l-5-5H3V9Zm13-2a7 7 0 0 1 0 10m3-13a11 11 0 0 1 0 16',
  flip: 'M4 8h14l-4-4m4 16H4l4-4M20 8v5M2 16v-5',
  briefcase: 'M3 7h18v14H3V7Zm5 0V3h8v4M3 12l9 3 9-3m-9 1v4',
  plane: 'm3 11 7 1 7-9 3 1-5 9 5 3v2l-8-2-4 4H5l3-6-5-1v-2Z',
  bag: 'M4 7h16l1 14H3L4 7Zm4 0V5a4 4 0 0 1 8 0v2',
} satisfies Record<string, string>;

export type IconName = keyof typeof paths;

export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d={paths[name]} />
    </svg>
  );
}

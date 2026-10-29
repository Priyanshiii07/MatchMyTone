// Line icons drawn on a 24px grid; they inherit color from the surrounding text.
const PATHS = {
  "arrow-left": <path d="M19 12H5m6-6-6 6 6 6" />,
  "arrow-right": <path d="M5 12h14m-6-6 6 6-6 6" />,
  download: <><path d="M12 4v11m-5-5 5 5 5-5" /><path d="M5 20h14" /></>,
  refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></>,
  home: <><path d="m4 11 8-7 8 7" /><path d="M6 10v10h12V10" /></>,
  palette: <><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.1-.9-1.5-.9-2.5 0-1 .8-1.6 1.8-1.6H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3Z" /><circle cx="7.5" cy="11" r="1.1" /><circle cx="10.5" cy="7.2" r="1.1" /><circle cx="15" cy="7.5" r="1.1" /></>,
  droplet: <><path d="M12 3.5s6 6.6 6 10.8a6 6 0 0 1-12 0C6 10.1 12 3.5 12 3.5Z" /><path d="M9.2 14.6a2.9 2.9 0 0 0 2.6 2.6" /></>,
  face: <><path d="M12 3c4 0 6.5 3.2 6.5 7.6 0 5.2-3.2 9.9-6.5 9.9s-6.5-4.7-6.5-9.9C5.5 6.2 8 3 12 3Z" /><path d="M9.3 10.3h.01m5.4 0h.01M9.6 15c1.4 1.1 3.4 1.1 4.8 0" /></>,
  body: <><path d="M9 3.5c.4 1.4 1.5 2.2 3 2.2s2.6-.8 3-2.2" /><path d="M9 3.5 6.5 5.5l1.6 3L9 8v3.5l-2.5 9h11L15 11.5V8l.9.5 1.6-3L15 3.5" /></>,
  sparkle: <path d="M12 3.5c.6 4.2 2.3 5.9 6.5 6.5-4.2.6-5.9 2.3-6.5 6.5-.6-4.2-2.3-5.9-6.5-6.5 4.2-.6 5.9-2.3 6.5-6.5ZM18.5 15.5c.2 1.6.9 2.3 2.5 2.5-1.6.2-2.3.9-2.5 2.5-.2-1.6-.9-2.3-2.5-2.5 1.6-.2 2.3-.9 2.5-2.5Z" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  user: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.8 20c1.1-3.6 3.8-5.4 7.2-5.4s6.1 1.8 7.2 5.4" /></>,
  camera: <><path d="M4 8.5h3.2L9 6h6l1.8 2.5H20v10H4Z" /><circle cx="12" cy="13" r="3.3" /></>,
  sun: <><circle cx="12" cy="12" r="3.6" /><path d="M12 2.8v2.1m0 14.2v2.1M2.8 12h2.1m14.2 0h2.1M5.5 5.5 7 7m10 10 1.5 1.5m0-13L17 7M7 17l-1.5 1.5" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  journal: <><path d="M6 3.5h11a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5H6Z" /><path d="M6 3.5v17M9.5 8h5.5m-5.5 3.5h5.5" /></>,
  alert: <><path d="M12 4 21 19.5H3Z" /><path d="M12 10v4.2m0 2.6h.01" /></>,
  edit: <><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16Z" /><path d="m13.5 6.5 4 4" /></>,
  image: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4" /></>,
  sun_moon: <path d="M15.5 4.5a7.5 7.5 0 1 0 4 13.6 6.5 6.5 0 0 1-4-13.6Z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  heart:<path d="M12 20s-7.5-4.6-7.5-10.1A4.2 4.2 0 0 1 12 7.4a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20Z" />,
  hanger: <><path d="M12 8.5V7.4a1.9 1.9 0 1 0-1.9-1.9" /><path d="M12 8.5 3.5 15a1.2 1.2 0 0 0 .7 2.2h15.6a1.2 1.2 0 0 0 .7-2.2Z" /></>,
  scissors: <><circle cx="6.5" cy="17.5" r="2.5" /><circle cx="6.5" cy="6.5" r="2.5" /><path d="m8.6 8 11 9M8.6 16l11-9" /></>,
  glasses: <><circle cx="7" cy="14" r="3.5" /><circle cx="17" cy="14" r="3.5" /><path d="M10.5 14h3M3.5 14l1-5M20.5 14l-1-5" /></>,
  layers: <><path d="m12 4 8.5 4.5L12 13 3.5 8.5Z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" /></>,
};

export default function Icon({ name, size = 18, title, className = "" }) {
  return (
    <svg className={`icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden={title ? undefined : true} role={title ? "img" : undefined} focusable="false">
      {title && <title>{title}</title>}
      {PATHS[name]}
    </svg>
  );
}

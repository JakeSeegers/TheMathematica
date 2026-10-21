/**
 * Inline SVG icons for the level editor (20×20 grid, 1.6 px strokes in `currentColor`).
 * Every value is a complete `<svg>` string, so it can be dropped into innerHTML or used as a
 * tool's `icon`.
 */

const svg = (body, { fill = false } = {}) =>
  `<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  // ---------------------------------------------------------------- tools
  select: svg('<path d="M4.5 3.2 L15 10.3 L10.2 11.2 L12.9 16.4 L11 17.3 L8.3 12.1 L4.5 15.3 Z" fill="currentColor" fill-opacity=".18"/>'),
  brush: svg('<path d="M15.8 3.4 9.2 10.2"/><path d="M10.9 8.5 12.6 10.2"/><path d="M8.6 10.8c-1.7-.3-3.3.7-3.6 2.4-.2 1.4-.6 2.3-1.8 3.2 2.4.6 5.2.2 6.3-1.4.9-1.3.6-3.1-.9-4.2Z" fill="currentColor" fill-opacity=".2"/>'),
  fill: svg('<path d="M8.6 3.2 15.3 9.9 9.6 15.6a1.6 1.6 0 0 1-2.3 0L3.4 11.7a1.6 1.6 0 0 1 0-2.3Z" fill="currentColor" fill-opacity=".16"/><path d="M4.2 10.4h11"/><path d="M6.8 1.8 8.6 3.6"/><path d="M16.6 12.6c.9 1.3 1.4 2.2 1.4 2.9a1.4 1.4 0 0 1-2.8 0c0-.7.5-1.6 1.4-2.9Z" fill="currentColor"/>'),
  rect: svg('<rect x="3.5" y="4.5" width="13" height="11" rx="1" fill="currentColor" fill-opacity=".18"/><path d="M3.5 8.2h13M3.5 11.8h13M7.8 4.5v11M12.2 4.5v11" stroke-opacity=".45" stroke-width="1"/>'),
  height: svg('<path d="M2.5 16.5 7.6 8.2l2.6 3.8 2.2-2.9 5.1 7.4Z" fill="currentColor" fill-opacity=".18"/><path d="M14.6 7.4V2.8M12.6 4.8l2-2 2 2"/>'),
  stairs: svg('<path d="M3 16.5h3.6v-3.4h3.6V9.7h3.6V6.3h3.2" /><path d="M3 16.5h14V6.3" stroke-opacity=".35"/>'),
  place: svg('<path d="M10 2.8 16.2 6.3v7.2L10 17.2 3.8 13.5V6.3Z" fill="currentColor" fill-opacity=".15"/><path d="M3.8 6.3 10 9.9l6.2-3.6M10 9.9v7.3"/>'),
  spawn: svg('<path d="m10 2.6 2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L2.8 7.8l5-.6Z" fill="currentColor" fill-opacity=".2"/>'),
  eyedropper: svg('<path d="m12.3 3.9 3.8 3.8"/><path d="M14.9 2.9a1.9 1.9 0 0 1 2.7 2.7l-2.2 2.2-2.7-2.7Z" fill="currentColor" fill-opacity=".25"/><path d="M12.9 6.2 5.5 13.6l-.9 3-1 .9.9-.9 3-.9 7.4-7.4"/>'),
  erase: svg('<path d="m8.4 16.5 8.1-8.1a1.6 1.6 0 0 0 0-2.3l-2.6-2.6a1.6 1.6 0 0 0-2.3 0L3 12.1a1.6 1.6 0 0 0 0 2.3l2.1 2.1Z" fill="currentColor" fill-opacity=".14"/><path d="m6.4 8.7 4.9 4.9M8.4 16.5H17"/>'),

  // ---------------------------------------------------------------- actions
  play: svg('<path d="M6 3.8v12.4L16 10Z" fill="currentColor"/>', { fill: false }),
  undo: svg('<path d="M7.5 5.2 4 8.7l3.5 3.5"/><path d="M4.2 8.7h7.6a4.2 4.2 0 0 1 0 8.4H9"/>'),
  redo: svg('<path d="m12.5 5.2 3.5 3.5-3.5 3.5"/><path d="M15.8 8.7H8.2a4.2 4.2 0 0 0 0 8.4H11"/>'),
  newFile: svg('<path d="M11.5 2.8H5.6a1.4 1.4 0 0 0-1.4 1.4v11.6a1.4 1.4 0 0 0 1.4 1.4h8.8a1.4 1.4 0 0 0 1.4-1.4V7.1Z"/><path d="M11.5 2.8v4.3h4.3M10 9.6v5M7.5 12.1h5"/>'),
  open: svg('<path d="M2.8 15.6V4.8a1.3 1.3 0 0 1 1.3-1.3h3.6l1.7 1.9h6.2a1.3 1.3 0 0 1 1.3 1.3v1.6"/><path d="M2.8 15.6 5.2 9a1.3 1.3 0 0 1 1.2-.9h11a.9.9 0 0 1 .8 1.2l-2.2 6.3Z" fill="currentColor" fill-opacity=".15"/>'),
  save: svg('<path d="M4.3 3h9.3l3.1 3.1v9.6a1.3 1.3 0 0 1-1.3 1.3H4.3A1.3 1.3 0 0 1 3 15.7V4.3A1.3 1.3 0 0 1 4.3 3Z"/><path d="M6.4 3v4h6.2V3M6.2 17v-5.4h7.6V17"/>'),
  saveAs: svg('<path d="M10.6 17H4.3A1.3 1.3 0 0 1 3 15.7V4.3A1.3 1.3 0 0 1 4.3 3h9.3l3.1 3.1v3.3"/><path d="M6.4 3v4h6.2V3"/><path d="m15.8 11.4 1.8 1.8-4.4 4.4H11.4v-1.8Z" fill="currentColor" fill-opacity=".2"/>'),
  download: svg('<path d="M10 3v9.4M6.2 8.8 10 12.6l3.8-3.8"/><path d="M3.5 13.2v2.3a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2.3"/>'),
  upload: svg('<path d="M10 13V3.6M6.2 7.2 10 3.4l3.8 3.8"/><path d="M3.5 13.2v2.3a1.5 1.5 0 0 0 1.5 1.5h10a1.5 1.5 0 0 0 1.5-1.5v-2.3"/>'),
  folder: svg('<path d="M2.8 15.2V5a1.3 1.3 0 0 1 1.3-1.3h3.6l1.7 1.9h6.5a1.3 1.3 0 0 1 1.3 1.3v8.3a1.3 1.3 0 0 1-1.3 1.3H4.1a1.3 1.3 0 0 1-1.3-1.3Z" fill="currentColor" fill-opacity=".14"/>'),
  browser: svg('<ellipse cx="10" cy="4.8" rx="6" ry="2.2"/><path d="M4 4.8v10.4c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2V4.8"/><path d="M4 10c0 1.2 2.7 2.2 6 2.2s6-1 6-2.2"/>'),
  file: svg('<path d="M11.5 2.8H5.6a1.4 1.4 0 0 0-1.4 1.4v11.6a1.4 1.4 0 0 0 1.4 1.4h8.8a1.4 1.4 0 0 0 1.4-1.4V7.1Z" fill="currentColor" fill-opacity=".12"/><path d="M11.5 2.8v4.3h4.3M7 11h6M7 13.8h4"/>'),
  copy: svg('<rect x="6.8" y="6.8" width="10" height="10" rx="1.4"/><path d="M13.2 6.8V4.6a1.4 1.4 0 0 0-1.4-1.4H4.6a1.4 1.4 0 0 0-1.4 1.4v7.2a1.4 1.4 0 0 0 1.4 1.4h2.2"/>'),
  paste: svg('<path d="M7.2 4H5.4A1.4 1.4 0 0 0 4 5.4v10.2A1.4 1.4 0 0 0 5.4 17h9.2a1.4 1.4 0 0 0 1.4-1.4V5.4A1.4 1.4 0 0 0 14.6 4h-1.8"/><rect x="7.2" y="2.6" width="5.6" height="3" rx=".8"/>'),
  cut: svg('<circle cx="5.8" cy="14.2" r="2.4"/><circle cx="14.2" cy="14.2" r="2.4"/><path d="m7.6 12.6 7.7-9.6M12.4 12.6 4.7 3"/>'),
  duplicate: svg('<rect x="3" y="3" width="10" height="10" rx="1.4"/><path d="M7 17h8.6a1.4 1.4 0 0 0 1.4-1.4V7M10.9 5.6v4.8M8.5 8h4.8" />'),
  trash: svg('<path d="M3.6 5.4h12.8M8 5.4V3.6h4v1.8"/><path d="M5.2 5.4 6 16a1.3 1.3 0 0 0 1.3 1.2h5.4A1.3 1.3 0 0 0 14 16l.8-10.6"/><path d="M8.4 8.6v5.6M11.6 8.6v5.6"/>'),
  rotate: svg('<path d="M15.8 9.2A6 6 0 1 1 13.4 4.6"/><path d="M13.6 1.9v3.3h3.3" />'),
  rotateCcw: svg('<path d="M4.2 9.2A6 6 0 1 0 6.6 4.6"/><path d="M6.4 1.9v3.3H3.1" />'),
  focus: svg('<circle cx="10" cy="10" r="3"/><path d="M10 2.5v2.4M10 15.1v2.4M2.5 10h2.4M15.1 10h2.4"/>'),
  frame: svg('<path d="M3 7V4.3A1.3 1.3 0 0 1 4.3 3H7M13 3h2.7A1.3 1.3 0 0 1 17 4.3V7M17 13v2.7a1.3 1.3 0 0 1-1.3 1.3H13M7 17H4.3A1.3 1.3 0 0 1 3 15.7V13"/><rect x="7" y="7" width="6" height="6" rx=".8" fill="currentColor" fill-opacity=".2"/>'),
  grid: svg('<rect x="3" y="3" width="14" height="14" rx="1.4"/><path d="M3 7.7h14M3 12.3h14M7.7 3v14M12.3 3v14" stroke-opacity=".6"/>'),
  texture: svg('<rect x="3" y="3" width="14" height="14" rx="1.4"/><path d="M3 10h7V3M10 17v-7h7" /><rect x="3" y="3" width="7" height="7" fill="currentColor" fill-opacity=".3" stroke="none"/><rect x="10" y="10" width="7" height="7" fill="currentColor" fill-opacity=".3" stroke="none"/>'),
  eye: svg('<path d="M1.8 10S4.8 4.4 10 4.4 18.2 10 18.2 10 15.2 15.6 10 15.6 1.8 10 1.8 10Z"/><circle cx="10" cy="10" r="2.5"/>'),
  eyeOff: svg('<path d="M8.1 4.6A8.5 8.5 0 0 1 10 4.4c5.2 0 8.2 5.6 8.2 5.6a14.7 14.7 0 0 1-2.2 2.9M5.7 5.9A14.4 14.4 0 0 0 1.8 10s3 5.6 8.2 5.6a8 8 0 0 0 4.2-1.2"/><path d="M8.3 8.2a2.5 2.5 0 0 0 3.5 3.6M2.8 2.8l14.4 14.4"/>'),
  settings: svg('<circle cx="10" cy="10" r="2.6"/><path d="M10 2.4v2M10 15.6v2M4.6 4.6 6 6M14 14l1.4 1.4M2.4 10h2M15.6 10h2M4.6 15.4 6 14M14 6l1.4-1.4"/>'),
  resize: svg('<rect x="3" y="3" width="9" height="9" rx="1" fill="currentColor" fill-opacity=".15"/><path d="M12 17h3.7a1.3 1.3 0 0 0 1.3-1.3V12M17 7.5V4.3A1.3 1.3 0 0 0 15.7 3H15M3 15v.7A1.3 1.3 0 0 0 4.3 17H7M11.6 11.6l4.2 4.2M15.8 12.4v3.4h-3.4"/>'),
  keyboard: svg('<rect x="2" y="5" width="16" height="10.5" rx="1.6"/><path d="M5 8.2h.01M8 8.2h.01M11 8.2h.01M14 8.2h.01M5 11h.01M15 11h.01M7.6 12.6h4.8" stroke-width="1.9"/>'),
  help: svg('<circle cx="10" cy="10" r="7.4"/><path d="M7.8 7.8a2.3 2.3 0 0 1 4.4.9c0 1.6-2.2 2-2.2 3.2M10 14.4h.01" />'),
  info: svg('<circle cx="10" cy="10" r="7.4"/><path d="M10 9.2v4.6M10 6.4h.01"/>'),
  close: svg('<path d="m5 5 10 10M15 5 5 15"/>'),
  check: svg('<path d="m4.4 10.4 3.7 3.7 7.6-8"/>'),
  warning: svg('<path d="M8.7 3.6 2.4 14.7a1.5 1.5 0 0 0 1.3 2.2h12.6a1.5 1.5 0 0 0 1.3-2.2L11.3 3.6a1.5 1.5 0 0 0-2.6 0Z"/><path d="M10 8v3.8M10 14.5h.01"/>'),
  error: svg('<circle cx="10" cy="10" r="7.4"/><path d="M10 6.2v4.6M10 13.8h.01"/>'),
  search: svg('<circle cx="8.8" cy="8.8" r="5.2"/><path d="m12.7 12.7 4.3 4.3"/>'),
  chevronDown: svg('<path d="m5.5 7.8 4.5 4.5 4.5-4.5"/>'),
  chevronRight: svg('<path d="m7.8 5.5 4.5 4.5-4.5 4.5"/>'),
  plus: svg('<path d="M10 4v12M4 10h12"/>'),
  minus: svg('<path d="M4 10h12"/>'),
  layers: svg('<path d="m10 3 7.4 3.8L10 10.6 2.6 6.8Z"/><path d="m2.6 10.2 7.4 3.8 7.4-3.8M2.6 13.4 10 17.2l7.4-3.8"/>'),
  map: svg('<path d="M2.8 5.2 7.4 3.2l5.2 2 4.6-2v11.6l-4.6 2-5.2-2-4.6 2Z"/><path d="M7.4 3.2v11.6M12.6 5.2v11.6"/>'),
  cube: svg('<path d="M10 2.8 16.2 6.3v7.2L10 17.2 3.8 13.5V6.3Z"/><path d="M3.8 6.3 10 9.9l6.2-3.6M10 9.9v7.3"/>'),
  layoutSplit: svg('<rect x="2.6" y="3.6" width="14.8" height="12.8" rx="1.5"/><path d="M11.4 3.6v12.8"/><rect x="2.6" y="3.6" width="8.8" height="12.8" rx="1.5" fill="currentColor" fill-opacity=".22" stroke="none"/>'),
  layout3d: svg('<rect x="2.6" y="3.6" width="14.8" height="12.8" rx="1.5" fill="currentColor" fill-opacity=".22"/><path d="m10 6.4 3.2 1.8v3.6L10 13.6l-3.2-1.8V8.2Z"/>'),
  layout2d: svg('<rect x="2.6" y="3.6" width="14.8" height="12.8" rx="1.5" fill="currentColor" fill-opacity=".22"/><path d="M6 7h8v6H6Z" stroke-opacity=".8"/><path d="M8.7 7v6M11.3 7v6M6 10h8" stroke-width="1" stroke-opacity=".7"/>'),
  magnet: svg('<path d="M4.4 3.6h3.4v6.2a2.2 2.2 0 0 0 4.4 0V3.6h3.4v6.2a5.6 5.6 0 0 1-11.2 0Z"/><path d="M4.4 6.8h3.4M12.2 6.8h3.4"/>'),
  sun: svg('<circle cx="10" cy="10" r="3.2"/><path d="M10 2.4v1.8M10 15.8v1.8M2.4 10h1.8M15.8 10h1.8M4.6 4.6l1.3 1.3M14.1 14.1l1.3 1.3M4.6 15.4l1.3-1.3M14.1 5.9l1.3-1.3"/>'),
  clock: svg('<circle cx="10" cy="10" r="7.2"/><path d="M10 5.6V10l3 1.9"/>'),
  link: svg('<path d="M8.4 11.6a3 3 0 0 0 4.3 0l2.6-2.6a3 3 0 0 0-4.3-4.3l-1 1"/><path d="M11.6 8.4a3 3 0 0 0-4.3 0L4.7 11a3 3 0 0 0 4.3 4.3l1-1"/>'),
  pencil: svg('<path d="M12.9 3.6a1.8 1.8 0 0 1 2.6 2.6L7 14.7l-3.4.8.8-3.4Z" fill="currentColor" fill-opacity=".15"/><path d="m11.6 5 2.5 2.5"/>'),
  water: svg('<path d="M2.6 7.4c1.2 0 1.8-1.2 3.7-1.2s2.5 1.2 3.7 1.2 1.8-1.2 3.7-1.2 2.5 1.2 3.7 1.2M2.6 12c1.2 0 1.8-1.2 3.7-1.2S8.8 12 10 12s1.8-1.2 3.7-1.2 2.5 1.2 3.7 1.2M2.6 16.4c1.2 0 1.8-1.2 3.7-1.2s2.5 1.2 3.7 1.2 1.8-1.2 3.7-1.2 2.5 1.2 3.7 1.2"/>'),
  validate: svg('<path d="M10 2.6 16 5v4.8c0 3.6-2.6 6.2-6 7.6-3.4-1.4-6-4-6-7.6V5Z"/><path d="m7.2 10 2 2 3.8-4"/>'),
  external: svg('<path d="M11.5 3.5h5v5M16.5 3.5 9.6 10.4"/><path d="M14.6 11.6v3.6a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3V6.7a1.3 1.3 0 0 1 1.3-1.3h3.6"/>'),
  selectAll: svg('<rect x="3" y="3" width="14" height="14" rx="1.4" stroke-dasharray="2.4 2"/><rect x="6.5" y="6.5" width="7" height="7" rx=".8" fill="currentColor" fill-opacity=".25"/>'),
  tag: svg('<path d="M3 9.4V3.8a.8.8 0 0 1 .8-.8h5.6l7.6 7.6-6.4 6.4Z"/><circle cx="6.6" cy="6.6" r="1.2"/>'),
};

/** A small inline logo mark (the Luminati ember), coloured. */
export const LOGO_SVG = `<svg viewBox="0 0 16 16" width="18" height="18" shape-rendering="crispEdges" aria-hidden="true"><path fill="#c9a45c" d="M7 2h2v1h1v2h1v2h1v4h-1v1h-1v1H6v-1H5v-1H4V7h1V5h1V3h1z"/><path fill="#f59a2e" d="M7 5h2v2h1v3H9v1H7v-1H6V7h1z"/><path fill="#fff6d0" d="M7 8h2v2H7z"/></svg>`;

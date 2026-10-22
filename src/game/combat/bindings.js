/**
 * Combat bindings and legends of the turn-based GLAIVE combat (docs/specs/GLAIVE.md §8.1).
 * Registered at runtime on combat levels only (`input.addBindings(COMBAT_BINDINGS,
 * COMBAT_PAD_BINDINGS)`), so peaceful levels keep today's bindings exactly. A fight is played with
 * the core actions (move, confirm, cancel: the menus, the target picker and the ground cursor); the
 * one combat action is `attack`, which strikes an unaware foe first (an ambush) between fights and
 * confirms a target or a spot in one. On the pad photo mode moves to an LS click (`photoPad`,
 * ignored while the stick is deflected) and zoom to the right stick, as before.
 */

/** Keyboard + mouse (the `Mouse*` codes need `input.enableMouseButtons(canvas)`). */
export const COMBAT_BINDINGS = Object.freeze({
  attack: ['KeyJ', 'Mouse0'],
  // the research overlay's field ledger (does nothing without `?research=`)
  ledger: ['KeyL'],
});

/** Gamepad. */
export const COMBAT_PAD_BINDINGS = Object.freeze({
  attack: ['GamepadX'], ledger: [], zoomIn: [], zoomOut: [], photo: [], photoPad: ['GamepadLS'],
});

/**
 * HUD legend on combat levels (keyboard / mouse). `label` is the English; `id` names the row (tests
 * find rows by it, and GlaiveCombat shows `t('combat.controls.<id>')`).
 */
export const COMBAT_CONTROLS = Object.freeze([
  { keys: 'WASD', label: 'Move', id: 'move' },
  { keys: 'Shift', label: 'Run', id: 'run' },
  { keys: 'J/Mouse0', label: 'Strike first (ambush)', id: 'attack' },
  { keys: 'Space', label: 'Talk / Rest / Open · Choose', id: 'interact' },
  { keys: 'Esc', label: 'Back (in a fight)', id: 'back' },
  { keys: 'Q/E', label: 'Rotate camera', id: 'rotate' },
  { keys: 'Z/X', label: 'Zoom (or wheel)', id: 'zoom' },
  { keys: 'N/Tab', label: 'World map', id: 'map' },
  { keys: 'T/R/P/M', label: 'Time / Weather / Photo / Music', id: 'toggles' },
]);

/** HUD legend while `input.lastDevice === 'gamepad'` (`id` as above). */
export const COMBAT_PAD_CONTROLS = Object.freeze([
  { keys: 'LS', label: 'Move', id: 'move' },
  { keys: 'RT', label: 'Run', id: 'run' },
  { keys: 'X', label: 'Strike first (ambush)', id: 'attack' },
  { keys: 'A', label: 'Talk / Rest / Open · Choose', id: 'interact' },
  { keys: 'B', label: 'Back (in a fight)', id: 'back' },
  { keys: 'LB/RB', label: 'Rotate camera', id: 'rotate' },
  { keys: 'R-Stick', label: 'Zoom', id: 'zoomPad' },
  { keys: 'Back', label: 'World map', id: 'map' },
  { keys: 'LS-Click', label: 'Photo', id: 'photo' },
]);

/** Shown once, on the first gamepad input of the session on a combat level (the English of `t('combat.padHint')`). */
export const PAD_HINT = 'Pad: X strike first · A choose · B back · right stick zoom · LS click photo';

/** Photo on the pad: ignored while the move vector is longer than this, and for PHOTO_PAD_QUIET s after. */
export const PHOTO_PAD_DEFLECT = 0.35;
export const PHOTO_PAD_QUIET = 0.3;

/** Right-stick zoom speed on combat levels (u/s at full deflection, `rig.stickZoom`). */
export const STICK_ZOOM = 14;

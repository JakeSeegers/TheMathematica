// Type-check only (tsconfig.json, `npm run typecheck`); nothing here reaches a bundle.
// The EditorState event map (event name → listener arguments), which types the EditorState's
// `on` / `once` / `off` / `emit` by module augmentation (EventEmitter itself takes any name).
import type { TileRect } from '../engine/level/types.js';
import './EditorState.js';
import type { EditorState } from './EditorState.js';

/** The `change` event: what a commit / undo / redo / load changed (EditorState.js header). */
export interface EditorChange {
  /** 'edit' (inside a transaction), 'undo', 'redo' or 'load'. */
  source: string;
  /** Tiles or heights changed. */
  terrain: boolean;
  /** The changed tiles; null: unknown / all. */
  rect: TileRect | null;
  /** Objects changed. */
  objects: boolean;
  /** The changed object ids; null: unknown / all. */
  ids: string[] | null;
  /** Level metadata (name, environment, spawn …) changed. */
  meta: boolean;
}

/** EditorState events: name → listener arguments. */
export interface EditorEvents {
  change: [info: EditorChange];
  selection: [ids: string[]];
  /** After undo / redo / cancel: the ids of the restored selection that `selectionFilter` left out. */
  selectionFiltered: [ids: string[]];
  history: [h: { canUndo: boolean; canRedo: boolean }];
  dirty: [dirty: boolean];
  tool: [id: string];
  toolOptions: [options: EditorState['toolOptions']];
  view: [view: EditorState['view']];
  hover: [hover: EditorState['hover']];
  /** opts.stale: asked while the message shows; true drops it (`EditorState.notify`). */
  status: [message: string, opts?: { stale?: () => boolean }];
  preview: [];
}

declare module './EditorState.js' {
  interface EditorState {
    on<K extends keyof EditorEvents>(event: K, fn: (...args: EditorEvents[K]) => void): () => void;
    once<K extends keyof EditorEvents>(event: K, fn: (...args: EditorEvents[K]) => void): () => void;
    off<K extends keyof EditorEvents>(event: K, fn?: Function): void;
    emit<K extends keyof EditorEvents>(event: K, ...args: EditorEvents[K]): boolean;
  }
}

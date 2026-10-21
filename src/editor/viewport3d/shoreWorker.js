/**
 * Web Worker of the editor's 3D preview: bakes windows of the water shore texture
 * (WaterShore.bakeShore — the very code Water.js runs) off the main thread, so painting water or
 * sculpting river banks never stalls a frame. Messages: { id, input, a0, b0, W, H } → { id, out }.
 */
import { bakeShore } from '../../engine/world/WaterShore.js';

self.onmessage = (e) => {
  const { id, input, a0, b0, W, H } = e.data;
  let out = null;
  try {
    out = bakeShore(input, a0, b0, W, H);
  } catch (err) {
    self.postMessage({ id, error: String(err?.stack ?? err) });
    return;
  }
  // @ts-expect-error self is the worker scope, typed as Window (no webworker lib): the transfer is right
  self.postMessage({ id, out }, [out.buffer]);
};

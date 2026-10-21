// Type-check only (tsconfig.json, `npm run typecheck`); nothing here reaches a bundle.
// Module augmentation for src/engine/audio: fields created lazily (`this._x ??= …`) or by another
// module, which the class body cannot declare without a runtime change.
import './AudioSystem.js';

declare module './AudioSystem.js' {
  interface AudioSystem {
    /** SFX names already warned about as unknown (created on the first unknown name). */
    _warnedSfx?: Set<string>;
  }
}

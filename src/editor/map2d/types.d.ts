// Type-check only (tsconfig.json, `npm run typecheck`); nothing here reaches a bundle.
// Module augmentation for src/editor/map2d: fields created lazily (`this._x ??= …`) or by another
// module, which the class body cannot declare without a runtime change.
import './Map2DView.js';

declare module './Map2DView.js' {
  interface Map2DView {
    /** The water shimmer pattern's transform, created by the first `_drawWater`. */
    _shimmerMatrix?: DOMMatrix;
  }
}

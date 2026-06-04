/**
 * @module overlay-lib
 * Public API surface for the Map Overlay library.
 *
 * Framework-agnostic core:
 *   import { OverlayManager, KmlExporter } from './lib';
 *
 * Vue integration:
 *   import { useOverlayManager } from './composables/useOverlayManager';
 */

// Core engine
export { OverlayManager } from './OverlayManager.js';

// KML export
export { KmlExporter } from './KmlExporter.js';
export { KmzExporter } from './KmzExporter.js';
export { KmzImporter } from './KmzImporter.js';

// Event system (for extension/composition)
export { EventEmitter } from './EventEmitter.js';

// Configuration defaults (for consumer overrides)
export {
  TOOL_TYPES,
  TOOL_TO_OL_TYPE,
  DEFAULT_TOOL_STYLES,
  BASE_FEATURE_DEFAULTS,
  DEFAULT_EMOJI_PALETTE,
  DEFAULT_EXPORT_OPTIONS,
} from './defaults.js';

// Utilities (for consumer reuse)
export {
  hexToRgba,
  hexToKmlColor,
  escapeXml,
  getCirclePolygonCoords,
  formatCoordinates,
} from './helpers.js';

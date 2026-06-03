/**
 * @module defaults
 * Single source of truth for all default configuration values.
 * Consumers can override any of these via the OverlayManager options API
 * or the MapOverlay component props.
 */

/**
 * Supported drawing tool types.
 * @type {string[]}
 */
export const TOOL_TYPES = ['polygon', 'circle', 'marker', 'annotation', 'emoji', 'image'];

/**
 * Map from OL geometry type string to internal tool type.
 * Used during drawing interaction setup.
 * @type {Record<string, string>}
 */
export const TOOL_TO_OL_TYPE = {
  polygon: 'Polygon',
  circle: 'Circle',
  marker: 'Point',
  annotation: 'Point',
  emoji: 'Point',
  image: 'Polygon',
};

/**
 * Default styling properties applied when a new feature is drawn.
 * Keyed by tool type — each key provides its full set of defaults.
 * @type {Record<string, object>}
 */
export const DEFAULT_TOOL_STYLES = {
  polygon: {
    color: '#a855f7',
    strokeColor: '#000000',
    strokeWidth: 2,
    opacity: 0.3,
  },
  circle: {
    color: '#10b981',
    strokeColor: '#000000',
    strokeWidth: 2,
    opacity: 0.3,
  },
  marker: {
    color: '#ef4444',
    strokeColor: '#ffffff',
    strokeWidth: 2,
  },
  annotation: {
    color: '#3b82f6',
    textSize: 16,
    text: 'Label',
  },
  emoji: {
    emoji: '🚀',
    emojiSize: 32,
  },
  image: {
    opacity: 0.7,
  },
};

/**
 * Base/fallback properties applied to every feature regardless of type.
 * Tool-specific defaults from DEFAULT_TOOL_STYLES are merged on top.
 * @type {object}
 */
export const BASE_FEATURE_DEFAULTS = {
  color: '#a855f7',
  strokeColor: '#ffffff',
  strokeWidth: 2,
  opacity: 0.3,
  text: 'Annotation',
  textSize: 14,
  emoji: '🚀',
  emojiSize: 32,
};

/**
 * Default emoji palette shown in the property editor.
 * @type {string[]}
 */
export const DEFAULT_EMOJI_PALETTE = [
  '🌟', '📍', '⚠️', '🛑', '🚀',
  '🔥', '🚁', '✈️', '⚓', '🚧',
  '🏁', '🎯', '💬', '❌', '✅',
];

/**
 * Default KML export configuration.
 * @type {object}
 */
export const DEFAULT_EXPORT_OPTIONS = {
  documentName: 'Mission Overlay',
  documentDescription: 'Exported overlay data',
  filename: 'overlay.kml',
};

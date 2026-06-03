/**
 * @module helpers
 * Pure utility functions for color conversion, XML escaping,
 * geometry approximation, and coordinate formatting.
 * Zero external dependencies — safe to import anywhere.
 */

/**
 * Convert a HEX color string and opacity to an RGBA CSS string.
 * @param {string} hex - HEX color (e.g. '#a855f7' or '#fff')
 * @param {number} [opacity=1] - Opacity value between 0 and 1
 * @returns {string} RGBA string (e.g. 'rgba(168, 85, 247, 0.3)')
 */
export function hexToRgba(hex, opacity = 1) {
  const normalized = normalizeHex(hex);
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamp(opacity, 0, 1)})`;
}

/**
 * Convert a HEX color string and opacity to KML color format (aabbggrr).
 * KML uses a reversed byte order: Alpha, Blue, Green, Red.
 * @param {string} hex - HEX color (e.g. '#a855f7')
 * @param {number} [opacity=1] - Opacity value between 0 and 1
 * @returns {string} KML color string (e.g. 'f7f755a8')
 */
export function hexToKmlColor(hex, opacity = 1) {
  const normalized = normalizeHex(hex);
  const r = normalized.slice(0, 2);
  const g = normalized.slice(2, 4);
  const b = normalized.slice(4, 6);
  const a = Math.round(clamp(opacity, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0');

  // KML order: Alpha, Blue, Green, Red
  return `${a}${b}${g}${r}`.toLowerCase();
}

/**
 * Escape special characters for XML/KML validity.
 * @param {*} unsafe - Value to escape (coerced to string)
 * @returns {string} XML-safe string
 */
export function escapeXml(unsafe) {
  if (unsafe == null) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Approximate a circle as a polygon ring in EPSG:3857 projection coordinates.
 * @param {number[]} center - Circle center [x, y] in map projection units
 * @param {number} radius - Circle radius in map projection units (meters)
 * @param {number} [segments=64] - Number of polygon vertices
 * @returns {number[][][]} Polygon coordinate rings (single outer ring)
 */
export function getCirclePolygonCoords(center, radius, segments = 64) {
  const coords = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    coords.push([
      center[0] + radius * Math.cos(angle),
      center[1] + radius * Math.sin(angle),
    ]);
  }
  // Close the ring
  coords.push([coords[0][0], coords[0][1]]);
  return [coords];
}

/**
 * Format a [lon, lat] coordinate pair into a human-readable string
 * with hemisphere suffixes (e.g. "48.85660°N, 2.35220°E").
 * @param {number[]} coords - [longitude, latitude]
 * @param {number} [precision=5] - Decimal places
 * @returns {string} Formatted coordinate string
 */
export function formatCoordinates(coords, precision = 5) {
  if (!coords || coords.length < 2) return '0.00000, 0.00000';
  const [lon, lat] = coords;
  const latStr = lat >= 0
    ? `${lat.toFixed(precision)}°N`
    : `${Math.abs(lat).toFixed(precision)}°S`;
  const lonStr = lon >= 0
    ? `${lon.toFixed(precision)}°E`
    : `${Math.abs(lon).toFixed(precision)}°W`;
  return `${latStr}, ${lonStr}`;
}

// ── Internal helpers ──────────────────────────────────────────────

/**
 * Normalize a HEX string: strip '#' and expand shorthand (e.g. 'fff' → 'ffffff').
 * @param {string} hex
 * @returns {string} 6-character hex string
 */
function normalizeHex(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  return h;
}

/**
 * Clamp a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

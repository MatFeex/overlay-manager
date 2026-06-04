/**
 * @module KmzImporter
 * Utility for parsing KMZ archives and KML files into clean feature property objects.
 */

import JSZip from 'jszip';
import { BASE_FEATURE_DEFAULTS, DEFAULT_TOOL_STYLES } from './defaults.js';

// Helper to determine image mime type
function getMimeType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'svg') return 'image/svg+xml';
  return 'image/png';
}

// Helper to parse KML color (aabbggrr) to hex (#rrggbb) and opacity (0-1)
export function kmlColorToHexAndOpacity(kmlColor) {
  if (!kmlColor || typeof kmlColor !== 'string') {
    return { color: null, opacity: null };
  }
  let clean = kmlColor.trim().replace(/^#/, '').toLowerCase();
  if (clean.length === 6) {
    clean = 'ff' + clean;
  }
  if (clean.length !== 8) {
    return { color: null, opacity: null };
  }
  const a = clean.substring(0, 2);
  const b = clean.substring(2, 4);
  const g = clean.substring(4, 6);
  const r = clean.substring(6, 8);

  const color = `#${r}${g}${b}`;
  const opacity = parseFloat((parseInt(a, 16) / 255).toFixed(2));
  return { color, opacity };
}

// Helper to find child elements namespace-independently
function getChildElement(parent, tagName) {
  if (!parent) return null;
  const el = parent.querySelector(tagName);
  if (el) return el;

  for (let i = 0; i < parent.children.length; i++) {
    const child = parent.children[i];
    if (child.localName === tagName) {
      return child;
    }
  }
  return null;
}

// Helper to parse a single Placemark element
function parsePlacemark(pm) {
  const name = getChildElement(pm, 'name')?.textContent || '';
  const description = getChildElement(pm, 'description')?.textContent || '';

  // Determine tool type
  let type = 'polygon';
  const descLower = description.toLowerCase();
  if (descLower.includes('circle')) {
    type = 'circle';
  } else if (descLower.includes('marker')) {
    type = 'marker';
  } else if (descLower.includes('annotation')) {
    type = 'annotation';
  } else if (descLower.includes('emoji')) {
    type = 'emoji';
  } else if (descLower.includes('polygon')) {
    type = 'polygon';
  } else {
    // Heuristic detection based on elements and styles
    if (getChildElement(pm, 'Polygon')) {
      if (name.toLowerCase().startsWith('circle')) {
        type = 'circle';
      } else {
        type = 'polygon';
      }
    } else if (getChildElement(pm, 'Point')) {
      const styleEl = getChildElement(pm, 'Style');
      const iconStyle = getChildElement(styleEl, 'IconStyle');
      const scaleEl = getChildElement(iconStyle, 'scale');
      const hasZeroScaleIcon = scaleEl && parseFloat(scaleEl.textContent) === 0;

      if (hasZeroScaleIcon || !iconStyle) {
        // Check if name contains a single emoji
        const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
        if (emojiRegex.test(name) && name.length <= 5) {
          type = 'emoji';
        } else {
          type = 'annotation';
        }
      } else {
        type = 'marker';
      }
    }
  }

  // Parse Coordinates
  let coordinates = null;
  if (type === 'polygon' || type === 'circle') {
    const polygonEl = getChildElement(pm, 'Polygon');
    if (polygonEl) {
      const outerBoundary = getChildElement(polygonEl, 'outerBoundaryIs');
      const ring = getChildElement(outerBoundary, 'LinearRing');
      const coordsStr = getChildElement(ring, 'coordinates')?.textContent || '';
      coordinates = coordsStr
        .trim()
        .split(/\s+/)
        .map((line) => {
          const parts = line.split(',');
          return [parseFloat(parts[0]), parseFloat(parts[1])];
        })
        .filter((coord) => !isNaN(coord[0]) && !isNaN(coord[1]));
    }
  } else {
    const pointEl = getChildElement(pm, 'Point');
    if (pointEl) {
      const coordsStr = getChildElement(pointEl, 'coordinates')?.textContent || '';
      const parts = coordsStr.trim().split(',');
      if (parts.length >= 2) {
        coordinates = [parseFloat(parts[0]), parseFloat(parts[1])];
      }
    }
  }

  if (!coordinates || (Array.isArray(coordinates[0]) && coordinates.length === 0)) {
    return null;
  }

  // Extract Style attributes
  const styleEl = getChildElement(pm, 'Style');
  let polyColor = null;
  let iconColor = null;
  let labelColor = null;
  let strokeColor = null;
  let strokeWidth = null;
  let opacity = null;
  let textSize = null;
  let text = name;
  let emoji = name;
  let emojiSize = null;

  if (styleEl) {
    const lineStyle = getChildElement(styleEl, 'LineStyle');
    if (lineStyle) {
      const lineColorKml = getChildElement(lineStyle, 'color')?.textContent;
      if (lineColorKml) {
        const parsed = kmlColorToHexAndOpacity(lineColorKml);
        strokeColor = parsed.color;
      }
      const widthStr = getChildElement(lineStyle, 'width')?.textContent;
      if (widthStr) {
        strokeWidth = parseInt(widthStr, 10);
      }
    }

    const polyStyle = getChildElement(styleEl, 'PolyStyle');
    if (polyStyle) {
      const polyColorKml = getChildElement(polyStyle, 'color')?.textContent;
      if (polyColorKml) {
        const parsed = kmlColorToHexAndOpacity(polyColorKml);
        polyColor = parsed.color;
        opacity = parsed.opacity;
      }
    }

    const iconStyle = getChildElement(styleEl, 'IconStyle');
    if (iconStyle) {
      const iconColorKml = getChildElement(iconStyle, 'color')?.textContent;
      if (iconColorKml) {
        const parsed = kmlColorToHexAndOpacity(iconColorKml);
        iconColor = parsed.color;
      }
    }

    const labelStyle = getChildElement(styleEl, 'LabelStyle');
    if (labelStyle) {
      const labelColorKml = getChildElement(labelStyle, 'color')?.textContent;
      if (labelColorKml) {
        const parsed = kmlColorToHexAndOpacity(labelColorKml);
        labelColor = parsed.color;
      }
      const scaleStr = getChildElement(labelStyle, 'scale')?.textContent;
      if (scaleStr) {
        const scale = parseFloat(scaleStr);
        if (type === 'annotation') {
          textSize = Math.round(scale * 14);
        } else if (type === 'emoji') {
          emojiSize = Math.round(scale * 32);
        }
      }
    }
  }

  // Merge with defaults
  const toolDefaults = DEFAULT_TOOL_STYLES[type] || {};
  const mergedProps = {
    ...BASE_FEATURE_DEFAULTS,
    ...toolDefaults,
    type,
    name,
    coordinates,
  };

  // Determine the primary color depending on type
  let finalColor = null;
  if (type === 'polygon' || type === 'circle') {
    finalColor = polyColor;
  } else if (type === 'marker') {
    finalColor = iconColor;
  } else if (type === 'annotation') {
    finalColor = labelColor;
  } else if (type === 'emoji') {
    finalColor = iconColor || labelColor;
  }

  if (finalColor !== null) mergedProps.color = finalColor;
  if (strokeColor !== null) mergedProps.strokeColor = strokeColor;
  if (strokeWidth !== null) mergedProps.strokeWidth = strokeWidth;
  if (opacity !== null) mergedProps.opacity = opacity;
  if (type === 'annotation') {
    if (textSize !== null) mergedProps.textSize = textSize;
    mergedProps.text = text || 'Label';
  }
  if (type === 'emoji') {
    if (emojiSize !== null) mergedProps.emojiSize = emojiSize;
    mergedProps.emoji = emoji || '🚀';
  }

  if (type === 'circle' && Array.isArray(coordinates) && Array.isArray(coordinates[0])) {
    // Reconstruct center and store polygon coords to compute radius later
    const lons = coordinates.map((c) => c[0]);
    const lats = coordinates.map((c) => c[1]);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const center = [(minLon + maxLon) / 2, (minLat + maxLat) / 2];

    mergedProps.coordinates = center;
    mergedProps._circlePolygonCoords = coordinates;
  }

  return mergedProps;
}

// Helper to parse a GroundOverlay element
async function parseGroundOverlay(go, zip) {
  const name = getChildElement(go, 'name')?.textContent || 'Image Overlay';
  const description = getChildElement(go, 'description')?.textContent || '';

  const iconEl = getChildElement(go, 'Icon');
  const href = getChildElement(iconEl, 'href')?.textContent || '';

  let imageUrl = href;
  if (zip && href) {
    const cleanHref = href.replace(/\\/g, '/').replace(/^\//, '');
    const imgFile = zip.file(cleanHref) || zip.file(href);
    if (imgFile) {
      const base64 = await imgFile.async('base64');
      const mimeType = getMimeType(cleanHref);
      imageUrl = `data:${mimeType};base64,${base64}`;
    }
  }

  // Parse opacity
  let opacity = 0.7;
  const colorKml = getChildElement(go, 'color')?.textContent;
  if (colorKml) {
    const parsed = kmlColorToHexAndOpacity(colorKml);
    if (parsed.opacity !== null) {
      opacity = parsed.opacity;
    }
  }

  // Parse LatLonBox
  const box = getChildElement(go, 'LatLonBox');
  if (!box) return null;

  const north = parseFloat(getChildElement(box, 'north')?.textContent || '0');
  const south = parseFloat(getChildElement(box, 'south')?.textContent || '0');
  const east = parseFloat(getChildElement(box, 'east')?.textContent || '0');
  const west = parseFloat(getChildElement(box, 'west')?.textContent || '0');
  const rotation = parseFloat(getChildElement(box, 'rotation')?.textContent || '0');

  // Outer ring of ground overlay
  const coordinates = [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];

  return {
    ...BASE_FEATURE_DEFAULTS,
    ...DEFAULT_TOOL_STYLES.image,
    type: 'image',
    name,
    imageUrl,
    opacity,
    coordinates,
    _rotation: rotation,
  };
}

export class KmzImporter {
  /**
   * Parse a KMZ (or direct KML) file into feature property snapshots.
   *
   * @param {File|Blob} fileOrBlob - KMZ/KML binary file or blob
   * @returns {Promise<object[]>} Array of feature properties objects compatible with edition panel
   */
  static async parse(fileOrBlob) {
    let kmlText = '';
    let zip = null;

    // Check if it is a ZIP (KMZ) file
    try {
      zip = await JSZip.loadAsync(fileOrBlob);
      // Find .kml file
      const kmlFile = zip.file('doc.kml') || Object.keys(zip.files).find((name) => name.endsWith('.kml'));
      if (!kmlFile) {
        throw new Error('No KML file found in the KMZ archive.');
      }
      kmlText = await zip.file(kmlFile.name).async('text');
    } catch (e) {
      // Fallback: treat as direct KML text file
      const reader = new FileReader();
      const readPromise = new Promise((resolve, reject) => {
        reader.onload = (event) => resolve(event.target.result);
        reader.onerror = (err) => reject(err);
      });
      reader.readAsText(fileOrBlob);
      kmlText = await readPromise;
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    
    // Check parser error
    const parseError = xmlDoc.getElementsByTagName('parsererror');
    if (parseError.length > 0) {
      throw new Error(`KML XML parse error: ${parseError[0].textContent}`);
    }

    const featuresList = [];

    // Parse standard Placemarks
    const placemarks = xmlDoc.getElementsByTagName('Placemark');
    for (let i = 0; i < placemarks.length; i++) {
      const pmProps = parsePlacemark(placemarks[i]);
      if (pmProps) {
        featuresList.push(pmProps);
      }
    }

    // Parse GroundOverlays
    const groundOverlays = xmlDoc.getElementsByTagName('GroundOverlay');
    for (let i = 0; i < groundOverlays.length; i++) {
      const goProps = await parseGroundOverlay(groundOverlays[i], zip);
      if (goProps) {
        featuresList.push(goProps);
      }
    }

    return featuresList;
  }

  /**
   * Import a KMZ/KML file directly into an OverlayManager instance.
   * This parses the file (accepting Files, Blobs, HTTP Response streams, or raw ReadableStreams),
   * populates the map overlay layer with corresponding OpenLayers features, and adjusts
   * the map viewport and editor panel state to make them fully responsive and active.
   *
   * @param {File|Blob|Response|ReadableStream} fileOrBlob - KMZ/KML data source
   * @param {object} overlayManager - The active OverlayManager instance
   * @param {object} [options] - Options passed to importKMZ (e.g. clearExisting)
   * @returns {Promise<object[]>} Resolves to the array of imported feature properties
   */
  static async importToManager(fileOrBlob, overlayManager, options = {}) {
    if (!overlayManager) {
      throw new Error('[KmzImporter] An OverlayManager instance is required to import features.');
    }
    if (typeof overlayManager.importKMZ !== 'function') {
      throw new Error('[KmzImporter] The provided object is not a valid OverlayManager instance.');
    }

    let inputData = fileOrBlob;

    // Handle standard Response objects (from fetch calls)
    if (fileOrBlob instanceof Response) {
      inputData = await fileOrBlob.blob();
    }
    // Handle raw ReadableStreams (or objects with getReader methods)
    else if (fileOrBlob && typeof fileOrBlob.getReader === 'function') {
      const response = new Response(fileOrBlob);
      inputData = await response.blob();
    }

    return await overlayManager.importKMZ(inputData, options);
  }
}

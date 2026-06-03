/**
 * @module KmlExporter
 * KML serialization and browser download utility.
 * Operates on plain feature-property objects — decoupled from OpenLayers.
 */

import { hexToKmlColor, escapeXml } from './helpers.js';
import { DEFAULT_EXPORT_OPTIONS } from './defaults.js';

export class KmlExporter {
  /**
   * Serialize an array of feature property objects into a KML document string.
   *
   * @param {object[]} features - Array of feature props (output of OverlayManager.getFeatures())
   * @param {object} [options]
   * @param {string} [options.documentName] - KML Document name
   * @param {string} [options.documentDescription] - KML Document description
   * @returns {string} Complete KML XML document
   */
  static serialize(features, options = {}) {
    const opts = { ...DEFAULT_EXPORT_OPTIONS, ...options };

    const placemarks = features.map((f) => KmlExporter._serializePlacemark(f));

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<kml xmlns="http://www.opengis.net/kml/2.2">',
      '  <Document>',
      `    <name>${escapeXml(opts.documentName)}</name>`,
      `    <description>${escapeXml(opts.documentDescription)}</description>`,
      ...placemarks,
      '  </Document>',
      '</kml>',
    ].join('\n');
  }

  /**
   * Trigger a browser download of a KML string.
   *
   * @param {string} kmlContent - KML XML string
   * @param {string} [filename] - Download filename
   */
  static download(kmlContent, filename) {
    const fname = filename || DEFAULT_EXPORT_OPTIONS.filename;
    const blob = new Blob([kmlContent], {
      type: 'application/vnd.google-earth.kml+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fname;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ── Private serialization helpers ────────────────────────────────

  /**
   * Serialize a single feature into a KML <Placemark> block.
   * @param {object} props - Feature property object
   * @returns {string} KML Placemark XML fragment (indented for document context)
   */
  static _serializePlacemark(props) {
    const { type } = props;
    const name = KmlExporter._getPlacemarkName(props);
    const description = `${type.charAt(0).toUpperCase() + type.slice(1)} Overlay Element`;

    const lines = [];
    lines.push('    <Placemark>');
    lines.push(`      <name>${escapeXml(name)}</name>`);
    lines.push(`      <description>${escapeXml(description)}</description>`);

    // Inline style
    lines.push(...KmlExporter._serializeStyle(props));

    // Geometry
    lines.push(...KmlExporter._serializeGeometry(props));

    lines.push('    </Placemark>');
    return lines.join('\n');
  }

  /**
   * Derive the display name for a placemark based on feature type.
   */
  static _getPlacemarkName(props) {
    switch (props.type) {
      case 'annotation': return props.text || props.name || 'Annotation';
      case 'emoji': return props.emoji || '🚀';
      default: return props.name || props.type;
    }
  }

  /**
   * Serialize the <Style> block for a feature.
   * @returns {string[]} Lines of KML XML
   */
  static _serializeStyle(props) {
    const { type } = props;
    const lines = ['      <Style>'];

    if (type === 'polygon' || type === 'circle') {
      const polyColor = hexToKmlColor(props.color, props.opacity);
      const lineColor = hexToKmlColor(props.strokeColor, 1);
      lines.push(
        '        <LineStyle>',
        `          <color>${lineColor}</color>`,
        `          <width>${props.strokeWidth}</width>`,
        '        </LineStyle>',
        '        <PolyStyle>',
        `          <color>${polyColor}</color>`,
        '        </PolyStyle>',
      );
    } else if (type === 'marker') {
      const markerColor = hexToKmlColor(props.color, 1);
      lines.push(
        '        <IconStyle>',
        `          <color>${markerColor}</color>`,
        '          <scale>1.1</scale>',
        '          <Icon>',
        '            <href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>',
        '          </Icon>',
        '        </IconStyle>',
        '        <LabelStyle>',
        '          <color>ffffffff</color>',
        '          <scale>0.9</scale>',
        '        </LabelStyle>',
      );
    } else if (type === 'annotation') {
      const textColor = hexToKmlColor(props.color, 1);
      const scale = (props.textSize / 14).toFixed(2);
      lines.push(
        '        <LabelStyle>',
        `          <color>${textColor}</color>`,
        `          <scale>${scale}</scale>`,
        '        </LabelStyle>',
        '        <IconStyle>',
        '          <scale>0.0</scale>',
        '        </IconStyle>',
      );
    } else if (type === 'emoji') {
      const scale = (props.emojiSize / 32).toFixed(2);
      lines.push(
        '        <LabelStyle>',
        `          <scale>${scale}</scale>`,
        '        </LabelStyle>',
        '        <IconStyle>',
        '          <scale>0.0</scale>',
        '        </IconStyle>',
      );
    }

    lines.push('      </Style>');
    return lines;
  }

  /**
   * Serialize the geometry block (<Polygon>, <Point>) for a feature.
   * @returns {string[]} Lines of KML XML
   */
  static _serializeGeometry(props) {
    const { type, coordinates } = props;
    const lines = [];

    if (type === 'polygon' || type === 'circle') {
      // Both polygon and circle-approximation use polygon coordinates
      const coords = (type === 'circle' && props.circlePolygonCoords)
        ? props.circlePolygonCoords
        : coordinates;

      lines.push(
        '      <Polygon>',
        '        <outerBoundaryIs>',
        '          <LinearRing>',
        '            <coordinates>',
      );
      coords.forEach(([lon, lat]) => {
        lines.push(`              ${lon.toFixed(6)},${lat.toFixed(6)},0`);
      });
      lines.push(
        '            </coordinates>',
        '          </LinearRing>',
        '        </outerBoundaryIs>',
        '      </Polygon>',
      );
    } else if (type === 'marker' || type === 'annotation' || type === 'emoji') {
      const [lon, lat] = coordinates;
      lines.push(
        '      <Point>',
        `        <coordinates>${lon.toFixed(6)},${lat.toFixed(6)},0</coordinates>`,
        '      </Point>',
      );
    }

    return lines;
  }
}

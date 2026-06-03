/**
 * @module KmzExporter
 * Packaging KMZ projects including vector features and raster overlays.
 */

import JSZip from 'jszip';
import { KmlExporter } from './KmlExporter.js';

export class KmzExporter {
  /**
   * Package features into a KMZ archive.
   *
   * @param {object[]} features - Extracted feature properties
   * @param {object} [options] - Export options
   * @returns {Promise<Blob>} The generated KMZ binary Blob
   */
  static async exportToKMZ(features, options = {}) {
    const zip = new JSZip();
    const assetMap = new Map();
    let imageIndex = 1;

    // Process features to package embedded base64 images
    for (const f of features) {
      if (f.type === 'image' && f.imageUrl) {
        let mime = 'image/png';
        let base64Data = '';
        let ext = 'png';

        if (f.imageUrl.startsWith('data:')) {
          const parts = f.imageUrl.split(',');
          const meta = parts[0];
          base64Data = parts[1];
          const match = meta.match(/data:(.*?);/);
          if (match) {
            mime = match[1];
            ext = mime.split('/')[1] || 'png';
          }
        } else {
          // Skip if not a base64 Data URL (e.g. standard remote URLs)
          continue;
        }

        const filename = `files/image_${imageIndex}.${ext}`;
        zip.file(filename, base64Data, { base64: true });
        assetMap.set(f.id, filename);
        imageIndex++;
      }
    }

    // Generate KML and pass the asset mapping for relative URLs
    const kmlContent = KmlExporter.serialize(features, {
      ...options,
      assetMap,
    });

    zip.file('doc.kml', kmlContent);

    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.google-earth.kmz',
    });

    return blob;
  }

  /**
   * Export features as KMZ and trigger a native browser download.
   *
   * @param {object[]} features - Extracted feature properties
   * @param {object} [options] - Export options
   */
  static async downloadKMZ(features, options = {}) {
    try {
      const blob = await KmzExporter.exportToKMZ(features, options);
      const filename = options.filename || 'overlay.kmz';

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[KmzExporter] Failed to export KMZ:', error);
    }
  }
}

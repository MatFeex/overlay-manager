/**
 * @module OverlayManager
 * Framework-agnostic map overlay drawing engine built on OpenLayers.
 * Manages vector features (polygons, circles, markers, annotations, emojis)
 * with drawing, selection, modification, and export capabilities.
 *
 * @example
 * import { OverlayManager } from './lib';
 *
 * const manager = new OverlayManager(olMap, { toolStyles: { polygon: { color: '#ff0000' } } });
 * manager.on('feature:select', (props) => console.log(props));
 * manager.startDrawing('polygon');
 *
 * // Cleanup
 * manager.destroy();
 *
 * @fires feature:select  - When a feature is selected/deselected. Payload: featureProps | null
 * @fires feature:add     - When a new feature is drawn. Payload: featureProps
 * @fires feature:update  - When a feature is modified (translate/reshape). Payload: featureProps
 * @fires feature:remove  - When a feature is deleted. Payload: id
 * @fires features:change - When the features list changes. Payload: featureProps[]
 * @fires draw:stop       - When drawing mode ends. No payload.
 */

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import Point from 'ol/geom/Point';
import Circle from 'ol/geom/Circle';
import { Draw, Modify, Translate, Select, Snap } from 'ol/interaction';
import Transform from 'ol-ext/interaction/Transform';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { toLonLat, fromLonLat } from 'ol/proj';
import { unByKey } from 'ol/Observable';

import { EventEmitter } from './EventEmitter.js';
import { hexToRgba, getCirclePolygonCoords } from './helpers.js';
import { KmlExporter } from './KmlExporter.js';
import { KmzImporter } from './KmzImporter.js';
import {
  TOOL_TO_OL_TYPE,
  DEFAULT_TOOL_STYLES,
  BASE_FEATURE_DEFAULTS,
  DEFAULT_EXPORT_OPTIONS,
} from './defaults.js';

// Module-level image cache for canvas overlays
const imageCache = new Map();

export class OverlayManager extends EventEmitter {
  /**
   * @param {import('ol/Map').default} map - An initialized OpenLayers Map instance
   * @param {object} [options]
   * @param {Record<string, object>} [options.toolStyles] - Per-tool style overrides (merged with DEFAULT_TOOL_STYLES)
   * @param {object} [options.exportOptions] - Default KML export options
   */
  constructor(map, options = {}) {
    super();

    if (!map) {
      throw new Error('[OverlayManager] A valid OpenLayers Map instance is required.');
    }

    this._map = map;
    this._options = options;

    // Merge tool style overrides with defaults
    this._toolStyles = { ...DEFAULT_TOOL_STYLES };
    if (options.toolStyles) {
      for (const [tool, overrides] of Object.entries(options.toolStyles)) {
        this._toolStyles[tool] = { ...DEFAULT_TOOL_STYLES[tool], ...overrides };
      }
    }

    this._exportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options.exportOptions };

    // Vector layer
    this._vectorSource = new VectorSource();
    this._vectorLayer = new VectorLayer({
      source: this._vectorSource,
      style: (feature) => this._computeStyle(feature),
    });

    // Interaction references
    this._drawInteraction = null;
    this._modifyInteraction = null;
    this._translateInteraction = null;
    this._selectInteraction = null;
    this._snapInteraction = null;
    this._transformInteraction = null;

    // State
    this._selectedFeature = null;
    this._featureCounter = 0;

    // OL event listener keys for proper cleanup via unByKey()
    this._olListenerKeys = [];

    this.attach(map);
  }

  // ── Public API: Drawing ────────────────────────────────────────

  /**
   * Start drawing a shape on the map.
   * @param {string} type - One of: 'polygon', 'circle', 'marker', 'annotation', 'emoji'
   * @param {object} [overrides] - Property overrides merged on top of tool defaults
   */
  startDrawing(type, overrides = {}) {
    const olType = TOOL_TO_OL_TYPE[type];
    if (!olType) {
      throw new Error(`[OverlayManager] Unknown tool type: "${type}". Expected one of: ${Object.keys(TOOL_TO_OL_TYPE).join(', ')}`);
    }

    this._clearDrawInteraction();

    // Disable selection/translation/transform during drawing
    this._selectInteraction.setActive(false);
    this._translateInteraction.setActive(false);
    if (this._modifyInteraction) this._modifyInteraction.setActive(false);
    if (this._transformInteraction) this._transformInteraction.setActive(false);

    this._drawInteraction = new Draw({
      source: this._vectorSource,
      type: olType,
    });

    this._map.addInteraction(this._drawInteraction);

    this._drawInteraction.on('drawend', (event) => {
      const feature = event.feature;
      const id = this._generateId(type);

      // Merge: base → tool defaults → consumer overrides
      const toolDefaults = this._toolStyles[type] || {};
      const properties = {
        ...BASE_FEATURE_DEFAULTS,
        ...toolDefaults,
        ...overrides,
        id,
        type,
        name: overrides.name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${this._featureCounter}`,
      };

      feature.setId(id);
      for (const [key, val] of Object.entries(properties)) {
        feature.set(key, val);
      }

      const currentInteraction = this._drawInteraction;

      // Finalize on next tick to let OL complete the draw interaction
      setTimeout(() => {
        if (this._drawInteraction === currentInteraction) {
          this.stopDrawing();
          this._selectInteraction.getFeatures().clear();
          this._selectInteraction.getFeatures().push(feature);
          this._setSelectedFeature(feature);
          this._syncFeatures();
          this.emit('feature:add', this._extractProps(feature));
        }
      }, 50);
    });
  }

  /**
   * Stop the active drawing interaction and re-enable selection.
   */
  stopDrawing() {
    this._clearDrawInteraction();
    this._selectInteraction.setActive(true);
    if (this._selectedFeature) {
      this._setSelectedFeature(this._selectedFeature);
    }
    this.emit('draw:stop');
  }

  /**
   * Add a programmatically imported image overlay centered in the view.
   * @param {string} dataUrl - Base64 Data URL or path of the image
   * @param {string} [name] - Desired overlay name
   */
  addImageOverlay(dataUrl, name = '') {
    const view = this._map.getView();
    const center = view.getCenter();
    const resolution = view.getResolution();

    // Default size: 300x300 pixels
    const halfWidth = resolution * 150;
    const halfHeight = resolution * 150;

    // Load image to preserve aspect ratio
    const img = new Image();
    img.onload = () => {
      const aspect = img.width / img.height;
      let w = halfWidth;
      let h = halfHeight;
      if (aspect > 1) {
        w = halfWidth * aspect;
      } else {
        h = halfHeight / aspect;
      }

      const minX = center[0] - w;
      const maxX = center[0] + w;
      const minY = center[1] - h;
      const maxY = center[1] + h;

      const geometry = new Polygon([
        [
          [minX, minY],
          [maxX, minY],
          [maxX, maxY],
          [minX, maxY],
          [minX, minY],
        ],
      ]);

      const id = this._generateId('image');
      const properties = {
        ...BASE_FEATURE_DEFAULTS,
        id,
        type: 'image',
        name: name || `Image ${this._featureCounter}`,
        imageUrl: dataUrl,
        opacity: 0.7,
        scale: 1.0,
        baseWidth: w,
        baseHeight: h,
      };

      const feature = new Feature({
        geometry,
      });
      feature.setId(id);
      for (const [key, val] of Object.entries(properties)) {
        feature.set(key, val);
      }

      this._vectorSource.addFeature(feature);

      // Select the newly added feature
      this._selectInteraction.getFeatures().clear();
      this._selectInteraction.getFeatures().push(feature);
      this._setSelectedFeature(feature);
      this._syncFeatures();
      this.emit('feature:add', this._extractProps(feature));
    };
    img.src = dataUrl;
  }

  // ── Public API: Selection ──────────────────────────────────────

  /**
   * Programmatically select a feature by its ID and pan the map to it.
   * @param {string} id - Feature ID
   */
  selectFeatureById(id) {
    const feature = this._vectorSource.getFeatureById(id);
    this._selectInteraction.getFeatures().clear();

    if (feature) {
      this._selectInteraction.getFeatures().push(feature);
      this._setSelectedFeature(feature);
      this._panToFeature(feature);
    } else {
      this._setSelectedFeature(null);
    }
  }

  /**
   * Deselect the currently selected feature.
   */
  deselectAll() {
    this._selectInteraction.getFeatures().clear();
    this._setSelectedFeature(null);
  }

  /**
   * Get the currently selected feature's properties.
   * @returns {object|null}
   */
  getSelectedFeature() {
    return this._selectedFeature ? this._extractProps(this._selectedFeature) : null;
  }

  // ── Public API: Feature CRUD ───────────────────────────────────

  /**
   * Update a property on a specific feature.
   * @param {string} id - Feature ID
   * @param {string} property - Property name
   * @param {*} value - New value
   */
  updateFeatureProperty(id, property, value) {
    const feature = this._vectorSource.getFeatureById(id);
    if (!feature) return;

    feature.set(property, value);

    // Dynamic scaling for image overlays centered on their current position
    if (property === 'scale' && feature.get('type') === 'image') {
      const scale = Number(value) || 1.0;
      const baseWidth = feature.get('baseWidth');
      const baseHeight = feature.get('baseHeight');
      if (baseWidth && baseHeight) {
        const geom = feature.getGeometry();
        let center;
        if (geom.getType() === 'Polygon') {
          const extent = geom.getExtent();
          center = [
            (extent[0] + extent[2]) / 2,
            (extent[1] + extent[3]) / 2,
          ];
        }

        if (center) {
          const w = baseWidth * scale;
          const h = baseHeight * scale;
          const minX = center[0] - w;
          const maxX = center[0] + w;
          const minY = center[1] - h;
          const maxY = center[1] + h;

          const newGeom = new Polygon([
            [
              [minX, minY],
              [maxX, minY],
              [maxX, maxY],
              [minX, maxY],
              [minX, minY],
            ],
          ]);
          feature.setGeometry(newGeom);
        }
      }
    }

    feature.changed();
    this._vectorSource.changed();
    this._syncFeatures();

    // Re-emit selection if the updated feature is currently selected
    if (this._selectedFeature && this._selectedFeature.getId() === id) {
      this.emit('feature:select', this._extractProps(feature));
    }
  }

  /**
   * Delete a feature by its ID.
   * @param {string} id - Feature ID
   */
  deleteFeatureById(id) {
    const feature = this._vectorSource.getFeatureById(id);
    if (!feature) return;

    // Clear selection if deleting the selected feature
    if (this._selectedFeature && this._selectedFeature.getId() === id) {
      this._selectInteraction.getFeatures().clear();
      this._setSelectedFeature(null);
    }

    this._vectorSource.removeFeature(feature);
    this._syncFeatures();
    this.emit('feature:remove', id);
  }

  /**
   * Remove all features from the overlay.
   */
  clearAll() {
    this._selectInteraction.getFeatures().clear();
    this._setSelectedFeature(null);
    this._vectorSource.clear();
    this._syncFeatures();
  }

  /**
   * Get a snapshot of all feature properties.
   * @returns {object[]}
   */
  getFeatures() {
    return this._vectorSource.getFeatures().map((f) => this._extractProps(f));
  }

  // ── Public API: Export ─────────────────────────────────────────

  /**
   * Export all features as a KML string.
   * @param {object} [options] - Export options (documentName, documentDescription)
   * @returns {string} KML document
   */
  exportToKML(options = {}) {
    const features = this.getFeatures();
    return KmlExporter.serialize(features, { ...this._exportOptions, ...options });
  }

  /**
   * Export and trigger a browser download of the KML file.
   * @param {object} [options] - Export options (documentName, documentDescription, filename)
   */
  downloadKML(options = {}) {
    const opts = { ...this._exportOptions, ...options };
    const kml = this.exportToKML(opts);
    KmlExporter.download(kml, opts.filename);
  }

  /**
   * Import features from a KMZ (or direct KML) file into the overlay.
   *
   * @param {File|Blob} fileOrBlob - KMZ or KML file blob
   * @param {object} [options]
   * @param {boolean} [options.clearExisting=true] - Clear current features before importing
   * @returns {Promise<object[]>} Resolves to the array of imported feature properties
   */
  async importKMZ(fileOrBlob, options = {}) {
    const opts = { clearExisting: true, ...options };
    
    // Parse KMZ / KML using the importer
    const parsedFeatures = await KmzImporter.parse(fileOrBlob);

    if (opts.clearExisting) {
      this.clearAll();
    }

    const importedFeatures = [];

    for (const item of parsedFeatures) {
      const { type, coordinates } = item;
      let geometry = null;

      if (type === 'polygon') {
        const coords3857 = coordinates.map((c) => fromLonLat(c));
        geometry = new Polygon([coords3857]);
      } else if (type === 'circle') {
        const center3857 = fromLonLat(coordinates);
        let radius = 100; // default fallback radius (meters)
        if (item._circlePolygonCoords && item._circlePolygonCoords.length > 0) {
          const firstPoint3857 = fromLonLat(item._circlePolygonCoords[0]);
          const dx = center3857[0] - firstPoint3857[0];
          const dy = center3857[1] - firstPoint3857[1];
          radius = Math.sqrt(dx * dx + dy * dy);
        }
        geometry = new Circle(center3857, radius);
      } else if (type === 'marker' || type === 'annotation' || type === 'emoji') {
        const coords3857 = fromLonLat(coordinates);
        geometry = new Point(coords3857);
      } else if (type === 'image') {
        const bl = fromLonLat(coordinates[0]);
        const br = fromLonLat(coordinates[1]);
        const tr = fromLonLat(coordinates[2]);
        const tl = fromLonLat(coordinates[3]);
        
        geometry = new Polygon([[bl, br, tr, tl, bl]]);

        if (item._rotation) {
          const center = [(bl[0] + tr[0]) / 2, (bl[1] + tr[1]) / 2];
          const angleRad = (item._rotation * Math.PI) / 180;
          geometry.rotate(-angleRad, center);
        }

        const widthMeters = Math.sqrt((bl[0] - br[0]) ** 2 + (bl[1] - br[1]) ** 2);
        const heightMeters = Math.sqrt((bl[0] - tl[0]) ** 2 + (bl[1] - tl[1]) ** 2);
        
        item.baseWidth = widthMeters / 2;
        item.baseHeight = heightMeters / 2;
      }

      if (geometry) {
        const id = this._generateId(type);
        const feature = new Feature({ geometry });
        feature.setId(id);

        const featureProps = {
          ...item,
          id,
        };

        delete featureProps._circlePolygonCoords;
        delete featureProps._rotation;

        for (const [key, val] of Object.entries(featureProps)) {
          feature.set(key, val);
        }

        this._vectorSource.addFeature(feature);
        importedFeatures.push(featureProps);
      }
    }

    this._syncFeatures();

    // Select the first imported feature to activate properties panel, and fit map view to enclose all elements
    if (importedFeatures.length > 0) {
      const firstFeature = this._vectorSource.getFeatureById(importedFeatures[0].id);
      if (firstFeature) {
        this._selectInteraction.getFeatures().clear();
        this._selectInteraction.getFeatures().push(firstFeature);
        this._setSelectedFeature(firstFeature);
      }

      const extent = this._vectorSource.getExtent();
      if (extent && !extent.some((val) => val === Infinity || val === -Infinity)) {
        this._map.getView().fit(extent, {
          padding: [80, 80, 80, 80],
          duration: 800,
          maxZoom: 18,
        });
      }
    }

    return importedFeatures;
  }

  // ── Public API: Lifecycle ──────────────────────────────────────

  /**
   * Attach the overlay manager (layer and interactions) to an OpenLayers Map.
   * @param {import('ol/Map').default} map
   */
  attach(map) {
    if (!map) return;
    this.detach(); // Safely detach from previous map first

    this._map = map;
    this._map.addLayer(this._vectorLayer);
    this._initInteractions();
  }

  /**
   * Detach the overlay manager (layer and interactions) from the map.
   * This cleans the map canvas completely but preserves all shapes in memory.
   */
  detach() {
    if (!this._map) return;

    this.stopDrawing();

    // Remove OL interactions
    const interactions = [
      this._selectInteraction,
      this._modifyInteraction,
      this._translateInteraction,
      this._snapInteraction,
      this._transformInteraction,
    ];
    for (const interaction of interactions) {
      if (interaction) {
        try {
          this._map.removeInteraction(interaction);
        } catch (_) {}
      }
    }

    // Remove vector layer
    if (this._vectorLayer) {
      try {
        this._map.removeLayer(this._vectorLayer);
      } catch (_) {}
    }

    // Unregister all OL event listeners using proper unByKey
    for (const key of this._olListenerKeys) {
      unByKey(key);
    }
    this._olListenerKeys = [];

    this._map = null;
  }

  /**
   * Tear down all interactions, layers, and event listeners.
   * Must be called when the overlay manager is no longer needed.
   */
  destroy() {
    this.detach();
    if (this._vectorSource) {
      this._vectorSource.clear();
    }
    this.removeAllListeners();
  }

  // ── Private: Interactions ──────────────────────────────────────

  /**
   * Initialize Select, Modify, Translate, and Snap interactions.
   */
  _initInteractions() {
    // 1. Select
    this._selectInteraction = new Select({
      layers: [this._vectorLayer],
      style: (feature) => this._computeStyle(feature, true),
    });
    this._map.addInteraction(this._selectInteraction);

    const selectKey = this._selectInteraction.on('select', (e) => {
      this._setSelectedFeature(e.selected[0] || null);
    });
    this._olListenerKeys.push(selectKey);

    // 2. Modify (reshape vertices)
    this._modifyInteraction = new Modify({
      features: this._selectInteraction.getFeatures(),
      style: new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#a855f7' }),
          stroke: new Stroke({ color: '#ffffff', width: 1.5 }),
        }),
      }),
    });
    this._map.addInteraction(this._modifyInteraction);

    const modifyKey = this._modifyInteraction.on('modifyend', () => {
      this._syncFeatures();
      if (this._selectedFeature) {
        this.emit('feature:update', this._extractProps(this._selectedFeature));
      }
    });
    this._olListenerKeys.push(modifyKey);

    // 3. Translate (drag features)
    this._translateInteraction = new Translate({
      features: this._selectInteraction.getFeatures(),
    });
    this._map.addInteraction(this._translateInteraction);

    const translateKey = this._translateInteraction.on('translateend', () => {
      this._syncFeatures();
      if (this._selectedFeature) {
        this.emit('feature:update', this._extractProps(this._selectedFeature));
      }
    });
    this._olListenerKeys.push(translateKey);

    // 4. Snap (align to existing vertices)
    this._snapInteraction = new Snap({
      source: this._vectorSource,
    });
    this._map.addInteraction(this._snapInteraction);

    // 5. Transform (scale, stretch, rotate, translate) from ol-ext
    this._transformInteraction = new Transform({
      enableRotatedTransform: true,
      addSign: true,
      features: this._selectInteraction.getFeatures(),
      translate: true,
      stretch: true,
      scale: true,
      rotate: true,
      keepAspectRatio: false,
    });
    this._map.addInteraction(this._transformInteraction);

    const transformKey = this._transformInteraction.on(['translateend', 'scaleend', 'rotateend'], () => {
      this._syncFeatures();
      if (this._selectedFeature) {
        this.emit('feature:update', this._extractProps(this._selectedFeature));
      }
    });
    this._olListenerKeys.push(transformKey);

    // Initially deactivate edit interactions until a selection occurs
    this._transformInteraction.setActive(false);
    this._modifyInteraction.setActive(false);
    this._translateInteraction.setActive(false);
  }

  /**
   * Remove any active Draw interaction from the map.
   */
  _clearDrawInteraction() {
    if (this._drawInteraction) {
      try {
        this._drawInteraction.abortDrawing();
      } catch (_) {
        // May throw if no drawing is in progress — safe to ignore
      }
      this._map.removeInteraction(this._drawInteraction);
      this._drawInteraction = null;
    }

    // Scan map interactions and remove any other leftover Draw interactions
    const interactions = this._map.getInteractions().getArray();
    const toRemove = interactions.filter((inter) => inter instanceof Draw);
    toRemove.forEach((inter) => {
      try {
        inter.abortDrawing();
      } catch (_) {}
      this._map.removeInteraction(inter);
    });
  }

  // ── Private: Selection ─────────────────────────────────────────

  /**
   * Update internal selected feature state and emit event.
   * @param {import('ol/Feature').default|null} feature
   */
  _setSelectedFeature(feature) {
    if (this._selectedFeature) {
      this._selectedFeature.set('_isSelected', false);
    }

    this._selectedFeature = feature;

    // Toggle interactions based on selection and feature type
    if (feature) {
      feature.set('_isSelected', true);
      const type = feature.get('type');

      if (type === 'polygon') {
        // For Polygons: Transform (scale/rotate/translate) AND Modify (individual vertices) are active
        if (this._transformInteraction) this._transformInteraction.setActive(true);
        if (this._modifyInteraction) this._modifyInteraction.setActive(true);
        if (this._translateInteraction) this._translateInteraction.setActive(false);
      } else if (type === 'image') {
        // For Images: Keep only Transform active (so the box remains a perfect rectangle for GroundOverlay bounds)
        if (this._transformInteraction) this._transformInteraction.setActive(true);
        if (this._modifyInteraction) this._modifyInteraction.setActive(false);
        if (this._translateInteraction) this._translateInteraction.setActive(false);
      } else if (type === 'circle') {
        // Modify (for radius resizing) and Translate (for moving) active, Transform inactive
        if (this._transformInteraction) this._transformInteraction.setActive(false);
        if (this._modifyInteraction) this._modifyInteraction.setActive(true);
        if (this._translateInteraction) this._translateInteraction.setActive(true);
      } else {
        // Point types (marker, annotation, emoji): Translate active, Transform/Modify inactive
        if (this._transformInteraction) this._transformInteraction.setActive(false);
        if (this._modifyInteraction) this._modifyInteraction.setActive(false);
        if (this._translateInteraction) this._translateInteraction.setActive(true);
      }

      this.emit('feature:select', this._extractProps(feature));
    } else {
      // Nothing selected: deactivate all
      if (this._transformInteraction) this._transformInteraction.setActive(false);
      if (this._modifyInteraction) this._modifyInteraction.setActive(false);
      if (this._translateInteraction) this._translateInteraction.setActive(false);

      this.emit('feature:select', null);
    }

    this._vectorSource.changed();
  }

  /**
   * Pan the map view to center on a feature.
   * @param {import('ol/Feature').default} feature
   */
  _panToFeature(feature) {
    const geom = feature.getGeometry();
    let center;

    switch (geom.getType()) {
      case 'Point':
        center = geom.getCoordinates();
        break;
      case 'Polygon':
        center = geom.getInteriorPoint().getCoordinates();
        break;
      case 'Circle':
        center = geom.getCenter();
        break;
    }

    if (center) {
      this._map.getView().animate({ center, duration: 600 });
    }
  }

  // ── Private: Feature data extraction ───────────────────────────

  /**
   * Extract a clean plain-object snapshot of a feature's properties.
   * This is the canonical data shape exposed to consumers.
   * @param {import('ol/Feature').default} feature
   * @returns {object}
   */
  _extractProps(feature) {
    if (!feature) return null;

    const geom = feature.getGeometry();
    const geomType = geom.getType();
    let coordinates = [];
    const extra = {};

    if (geomType === 'Point') {
      coordinates = toLonLat(geom.getCoordinates());
    } else if (geomType === 'Polygon') {
      coordinates = geom.getCoordinates()[0].map((c) => toLonLat(c));
    } else if (geomType === 'Circle') {
      coordinates = toLonLat(geom.getCenter());
      extra.radius = geom.getRadius();

      // Pre-compute polygon approximation for KML export
      const circleCoords = getCirclePolygonCoords(geom.getCenter(), geom.getRadius(), 64);
      extra.circlePolygonCoords = circleCoords[0].map((c) => toLonLat(c));
    }

    return {
      id: feature.getId(),
      type: feature.get('type'),
      name: feature.get('name'),
      color: feature.get('color'),
      strokeColor: feature.get('strokeColor'),
      strokeWidth: feature.get('strokeWidth'),
      opacity: feature.get('opacity'),
      text: feature.get('text'),
      textSize: feature.get('textSize'),
      emoji: feature.get('emoji'),
      emojiSize: feature.get('emojiSize'),
      imageUrl: feature.get('imageUrl'),
      scale: feature.get('scale'),
      baseWidth: feature.get('baseWidth'),
      baseHeight: feature.get('baseHeight'),
      coordinates,
      ...extra,
    };
  }

  /**
   * Rebuild the features list and emit change event.
   */
  _syncFeatures() {
    const features = this.getFeatures();
    this.emit('features:change', features);
  }

  // ── Private: Styling ───────────────────────────────────────────

  /**
   * Compute the OL Style array for a feature.
   * @param {import('ol/Feature').default} feature
   * @param {boolean} [isSelectStyle=false] - Whether this is called from the Select interaction
   * @returns {Style[]}
   */
  _computeStyle(feature, isSelectStyle = false) {
    const type = feature.get('type') || 'polygon';
    const color = feature.get('color') || '#a855f7';
    const strokeColor = feature.get('strokeColor') || '#ffffff';
    const strokeWidth = Number(feature.get('strokeWidth')) || 2;
    const rawOpacity = Number(feature.get('opacity'));
    const opacity = isNaN(rawOpacity) ? 0.3 : rawOpacity;
    const isSelected = feature.get('_isSelected') || isSelectStyle;

    const styles = [];

    // Selection highlight: dashed glow stroke
    if (isSelected) {
      styles.push(new Style({
        stroke: new Stroke({
          color: '#a855f7',
          width: strokeWidth + 4,
          lineDash: [6, 6],
        }),
      }));
    }

    switch (type) {
      case 'polygon':
      case 'circle':
        styles.push(new Style({
          fill: new Fill({ color: hexToRgba(color, opacity) }),
          stroke: new Stroke({ color: strokeColor, width: strokeWidth }),
        }));
        break;

      case 'marker':
        styles.push(new Style({
          image: new CircleStyle({
            radius: 9,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#ffffff', width: 2 }),
          }),
          text: new Text({
            text: feature.get('name') || '',
            font: '12px Outfit, sans-serif',
            fill: new Fill({ color: '#ffffff' }),
            stroke: new Stroke({ color: '#090a10', width: 3 }),
            offsetY: -18,
          }),
        }));
        break;

      case 'annotation': {
        const textVal = feature.get('text') || 'Text';
        const textSize = feature.get('textSize') || 14;
        styles.push(new Style({
          image: new CircleStyle({
            radius: isSelected ? 4 : 2,
            fill: new Fill({ color }),
          }),
          text: new Text({
            text: textVal,
            font: `bold ${textSize}px Outfit, sans-serif`,
            fill: new Fill({ color }),
            stroke: new Stroke({ color: '#090a10', width: 4 }),
            textAlign: 'center',
            textBaseline: 'middle',
            overflow: true,
          }),
        }));
        break;
      }

      case 'emoji': {
        const emojiVal = feature.get('emoji') || '🚀';
        const emojiSize = feature.get('emojiSize') || 32;
        styles.push(new Style({
          image: new CircleStyle({
            radius: isSelected ? 6 : 3,
            fill: new Fill({ color: '#a855f7' }),
            stroke: new Stroke({ color: '#ffffff', width: 1.5 }),
          }),
          text: new Text({
            text: emojiVal,
            font: `${emojiSize}px sans-serif`,
            textAlign: 'center',
            textBaseline: 'middle',
            overflow: true,
          }),
        }));
        break;
      }

      case 'image': {
        const imageUrl = feature.get('imageUrl');
        
        // Push fallback/outline border
        styles.push(new Style({
          stroke: new Stroke({
            color: isSelected ? '#a855f7' : strokeColor || '#ffffff',
            width: isSelected ? strokeWidth + 2 : strokeWidth || 1.5,
            lineDash: isSelected ? [6, 6] : undefined,
          }),
          fill: new Fill({ color: 'rgba(255, 255, 255, 0.05)' })
        }));

        if (imageUrl) {
          let img = imageCache.get(imageUrl);
          if (!img) {
            img = new Image();
            img.onload = () => {
              imageCache.set(imageUrl, img);
              this._map.render();
            };
            img.src = imageUrl;
          }

          if (img && img.complete && img.naturalWidth > 0) {
            styles.push(new Style({
              renderer(coordinates, state) {
                const ctx = state.context;
                // Coordinates is [[ [x1, y1], [x2, y2], [x3, y3], [x4, y4] ]]
                const ring = coordinates[0];
                if (!ring || ring.length < 4) return;

                const p1 = ring[0];
                const p2 = ring[1];
                const p3 = ring[2];
                if (!p1 || !p2 || !p3) return;

                const centerX = (p1[0] + p3[0]) / 2;
                const centerY = (p1[1] + p3[1]) / 2;

                const dx = p2[0] - p1[0];
                const dy = p2[1] - p1[1];
                const width = Math.sqrt(dx * dx + dy * dy);

                const hx = p3[0] - p2[0];
                const hy = p3[1] - p2[1];
                const height = Math.sqrt(hx * hx + hy * hy);

                const angle = Math.atan2(dy, dx);

                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(angle);
                ctx.globalAlpha = opacity;
                ctx.drawImage(img, -width / 2, -height / 2, width, height);
                ctx.restore();
              },
            }));
          }
        }
        break;
      }
    }

    return styles;
  }

  // ── Private: Utilities ─────────────────────────────────────────

  /**
   * Generate a unique feature ID.
   * @param {string} type
   * @returns {string}
   */
  _generateId(type) {
    this._featureCounter++;
    return `overlay_${type}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  }
}

import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Draw, Modify, Translate, Select, Snap } from 'ol/interaction';
import { Style, Fill, Stroke, Circle as CircleStyle, Text } from 'ol/style';
import { toLonLat, fromLonLat } from 'ol/proj';
import { createBox } from 'ol/interaction/Draw';
import Feature from 'ol/Feature';
import { Polygon, Point, Circle } from 'ol/geom';
import { pointerMove } from 'ol/events/condition';

/**
 * Helper to convert HEX and opacity to RGBA string for OpenLayers
 */
function hexToRgba(hex, opacity = 1) {
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Helper to convert HEX and opacity to KML format color (aabbggrr)
 */
function hexToKmlColor(hex, opacity = 1) {
  hex = hex.replace('#', '');
  let r = 'ff', g = 'ff', b = 'ff';
  
  if (hex.length === 3) {
    r = hex[0] + hex[0];
    g = hex[1] + hex[1];
    b = hex[2] + hex[2];
  } else if (hex.length >= 6) {
    r = hex.slice(0, 2);
    g = hex.slice(2, 4);
    b = hex.slice(4, 6);
  }
  
  const a = Math.round(opacity * 255).toString(16).padStart(2, '0');
  
  // KML order is Alpha, Blue, Green, Red
  return `${a}${b}${g}${r}`.toLowerCase();
}

/**
 * Approximate a circle geometry as a list of EPSG:3857 coordinates
 */
function getCirclePolygonCoordinates(center, radius, segments = 64) {
  const coordinates = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    const x = center[0] + radius * Math.cos(angle);
    const y = center[1] + radius * Math.sin(angle);
    coordinates.push([x, y]);
  }
  coordinates.push([coordinates[0][0], coordinates[0][1]]); // Close polygon
  return [coordinates];
}

export class OverlayManager {
  constructor(map) {
    this.map = map;
    this.features = []; // Array of feature data objects for simple Vue list binding
    this.listeners = {};
    
    // Create Vector Source and Layer
    this.vectorSource = new VectorSource();
    this.vectorLayer = new VectorLayer({
      source: this.vectorSource,
      style: (feature) => this.getFeatureStyle(feature)
    });
    
    this.map.addLayer(this.vectorLayer);
    
    // Interactions
    this.drawInteraction = null;
    this.modifyInteraction = null;
    this.translateInteraction = null;
    this.selectInteraction = null;
    this.snapInteraction = null;
    
    this.selectedFeature = null;
    
    this.initInteractions();
  }

  // Event Observer
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  /**
   * Initializes permanent interactions like Modify, Translate, Select, Snap
   */
  initInteractions() {
    // 1. Select Interaction
    this.selectInteraction = new Select({
      layers: [this.vectorLayer],
      style: (feature) => this.getFeatureStyle(feature, true)
    });
    this.map.addInteraction(this.selectInteraction);
    
    this.selectInteraction.on('select', (e) => {
      const selected = e.selected[0] || null;
      this.setSelectedFeature(selected);
    });

    // 2. Modify Interaction (Allows resizing polygons/circles with distinct handles)
    this.modifyInteraction = new Modify({
      features: this.selectInteraction.getFeatures(),
      style: new Style({
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#a855f7' }),
          stroke: new Stroke({ color: '#ffffff', width: 1.5 })
        })
      })
    });
    this.map.addInteraction(this.modifyInteraction);
    
    this.modifyInteraction.on('modifyend', () => {
      this.syncFeaturesList();
      this.emit('feature-modified', this.selectedFeature);
    });

    // 3. Translate Interaction (Allows dragging selected features)
    this.translateInteraction = new Translate({
      features: this.selectInteraction.getFeatures()
    });
    this.map.addInteraction(this.translateInteraction);
    
    this.translateInteraction.on('translateend', () => {
      this.syncFeaturesList();
      this.emit('feature-modified', this.selectedFeature);
    });

    // 4. Snap Interaction (Helps drawing to align with existing shapes)
    this.snapInteraction = new Snap({
      source: this.vectorSource
    });
    this.map.addInteraction(this.snapInteraction);
  }

  /**
   * Start drawing a shape
   * @param {string} type - 'polygon' | 'circle' | 'marker' | 'annotation'
   * @param {object} defaultProps - Optional defaults for colors/labels
   */
  startDrawing(type, defaultProps = {}) {
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.drawInteraction = null;
    }
    
    // Temporarily disable translation/selection to allow click drawing
    this.selectInteraction.setActive(false);
    this.translateInteraction.setActive(false);

    let olType;
    if (type === 'polygon') olType = 'Polygon';
    else if (type === 'circle') olType = 'Circle';
    else if (type === 'marker' || type === 'annotation') olType = 'Point';

    this.drawInteraction = new Draw({
      source: this.vectorSource,
      type: olType
    });

    this.map.addInteraction(this.drawInteraction);

    this.drawInteraction.on('drawend', (event) => {
      const feature = event.feature;
      const id = 'overlay_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      
      const properties = {
        id,
        type,
        name: defaultProps.name || `${type.charAt(0).toUpperCase() + type.slice(1)} ${this.features.length + 1}`,
        color: defaultProps.color || '#a855f7',
        strokeColor: defaultProps.strokeColor || '#ffffff',
        strokeWidth: defaultProps.strokeWidth || 2,
        opacity: defaultProps.opacity !== undefined ? defaultProps.opacity : 0.3,
        text: defaultProps.text || 'Annotation',
        textSize: defaultProps.textSize || 14
      };

      feature.setId(id);
      for (const [key, val] of Object.entries(properties)) {
        feature.set(key, val);
      }

      // Finish drawing session on next tick
      setTimeout(() => {
        this.stopDrawing();
        // Select the newly drawn feature
        this.selectInteraction.getFeatures().clear();
        this.selectInteraction.getFeatures().push(feature);
        this.setSelectedFeature(feature);
        this.syncFeaturesList();
        this.emit('feature-added', properties);
      }, 50);
    });
  }

  /**
   * Stop active drawing interaction
   */
  stopDrawing() {
    if (this.drawInteraction) {
      this.map.removeInteraction(this.drawInteraction);
      this.drawInteraction = null;
    }
    this.selectInteraction.setActive(true);
    this.translateInteraction.setActive(true);
    this.emit('draw-stopped');
  }

  /**
   * Set selected feature status
   */
  setSelectedFeature(feature) {
    if (this.selectedFeature) {
      this.selectedFeature.set('isSelected', false);
    }
    
    this.selectedFeature = feature;
    
    if (feature) {
      feature.set('isSelected', true);
      const props = this.getFeatureProps(feature);
      this.emit('feature-selected', props);
    } else {
      this.emit('feature-selected', null);
    }
    
    // Refresh layer rendering
    this.vectorSource.changed();
  }

  /**
   * Select a feature programmatically by ID
   */
  selectFeatureById(id) {
    const feature = this.vectorSource.getFeatureById(id);
    this.selectInteraction.getFeatures().clear();
    if (feature) {
      this.selectInteraction.getFeatures().push(feature);
      this.setSelectedFeature(feature);
      
      // Pan to feature center/coordinate
      const geom = feature.getGeometry();
      let center;
      if (geom.getType() === 'Point') {
        center = geom.getCoordinates();
      } else if (geom.getType() === 'Polygon') {
        center = geom.getInteriorPoint().getCoordinates();
      } else if (geom.getType() === 'Circle') {
        center = geom.getCenter();
      }
      if (center) {
        this.map.getView().animate({
          center: center,
          duration: 600
        });
      }
    } else {
      this.setSelectedFeature(null);
    }
  }

  /**
   * Update property of currently selected feature or a specific feature by ID
   */
  updateFeatureProperty(id, property, value) {
    const feature = this.vectorSource.getFeatureById(id);
    if (feature) {
      feature.set(property, value);
      // Trigger update
      feature.changed();
      this.syncFeaturesList();
      
      // Re-trigger styling callback
      this.vectorSource.changed();
      
      // Emit updated selection props
      if (this.selectedFeature && this.selectedFeature.getId() === id) {
        this.emit('feature-selected', this.getFeatureProps(feature));
      }
    }
  }

  /**
   * Delete a feature by ID
   */
  deleteFeatureById(id) {
    const feature = this.vectorSource.getFeatureById(id);
    if (feature) {
      if (this.selectedFeature && this.selectedFeature.getId() === id) {
        this.selectInteraction.getFeatures().clear();
        this.setSelectedFeature(null);
      }
      this.vectorSource.removeFeature(feature);
      this.syncFeaturesList();
      this.emit('feature-removed', id);
    }
  }

  /**
   * Clear all features
   */
  clearAll() {
    this.selectInteraction.getFeatures().clear();
    this.setSelectedFeature(null);
    this.vectorSource.clear();
    this.syncFeaturesList();
  }

  /**
   * Extracts clean metadata from an OpenLayers feature
   */
  getFeatureProps(feature) {
    if (!feature) return null;
    const geom = feature.getGeometry();
    let coordinates = [];
    let extra = {};

    const geomType = geom.getType();

    if (geomType === 'Point') {
      coordinates = toLonLat(geom.getCoordinates());
    } else if (geomType === 'Polygon') {
      coordinates = geom.getCoordinates()[0].map(c => toLonLat(c));
    } else if (geomType === 'Circle') {
      coordinates = toLonLat(geom.getCenter());
      extra = {
        radius: geom.getRadius() // in map projection units (meters)
      };
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
      coordinates,
      ...extra
    };
  }

  /**
   * Synchronizes internal feature objects with Vue state
   */
  syncFeaturesList() {
    const all = this.vectorSource.getFeatures();
    this.features = all.map(f => this.getFeatureProps(f));
    this.emit('list-updated', this.features);
  }

  /**
   * Compute standard style for features
   */
  getFeatureStyle(feature, isSelectedDraw = false) {
    const type = feature.get('type') || 'polygon';
    const color = feature.get('color') || '#a855f7';
    const strokeColor = feature.get('strokeColor') || '#ffffff';
    const strokeWidth = Number(feature.get('strokeWidth')) || 2;
    const opacity = Number(feature.get('opacity')) !== undefined ? Number(feature.get('opacity')) : 0.3;
    const isSelected = feature.get('isSelected') || isSelectedDraw;

    const styles = [];

    // Selected highlight style (outer glowing stroke or bounding layer)
    if (isSelected) {
      styles.push(new Style({
        stroke: new Stroke({
          color: '#a855f7',
          width: strokeWidth + 4,
          lineDash: [6, 6]
        })
      }));
    }

    if (type === 'polygon' || type === 'circle') {
      styles.push(new Style({
        fill: new Fill({
          color: hexToRgba(color, opacity)
        }),
        stroke: new Stroke({
          color: strokeColor,
          width: strokeWidth
        })
      }));
    } else if (type === 'marker') {
      styles.push(new Style({
        image: new CircleStyle({
          radius: 9,
          fill: new Fill({ color: color }),
          stroke: new Stroke({ color: '#ffffff', width: 2 })
        }),
        text: new Text({
          text: feature.get('name') || '',
          font: '12px Outfit, sans-serif',
          fill: new Fill({ color: '#ffffff' }),
          stroke: new Stroke({ color: '#090a10', width: 3 }),
          offsetY: -18
        })
      }));
    } else if (type === 'annotation') {
      const textVal = feature.get('text') || 'Text';
      const textSize = feature.get('textSize') || 14;
      
      styles.push(new Style({
        // Minimal anchor dot for editing, invisible in KML but useful on map
        image: new CircleStyle({
          radius: isSelected ? 4 : 2,
          fill: new Fill({ color: color }),
          opacity: 0.8
        }),
        text: new Text({
          text: textVal,
          font: `bold ${textSize}px Outfit, sans-serif`,
          fill: new Fill({ color: color }),
          stroke: new Stroke({ color: '#090a10', width: 4 }),
          textAlign: 'center',
          textBaseline: 'middle',
          overflow: true
        })
      }));
    }

    return styles;
  }

  /**
   * Export the drawn overlay to standard KML string
   */
  exportToKML() {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Mission Overlay</name>
    <description>Overlay exported from Mission Dispatcher</description>
`;

    const features = this.vectorSource.getFeatures();

    features.forEach((feature) => {
      const props = this.getFeatureProps(feature);
      const geom = feature.getGeometry();
      const type = props.type;
      
      kml += `    <Placemark>
      <name>${props.name || type}</name>
      <description>${type.charAt(0).toUpperCase() + type.slice(1)} Overlay Element</description>
`;

      // 1. Export Styles Inline for high portability
      kml += `      <Style>
`;

      if (type === 'polygon' || type === 'circle') {
        const polyCol = hexToKmlColor(props.color, props.opacity);
        const lineCol = hexToKmlColor(props.strokeColor, 1);
        kml += `        <LineStyle>
          <color>${lineCol}</color>
          <width>${props.strokeWidth}</width>
        </LineStyle>
        <PolyStyle>
          <color>${polyCol}</color>
        </PolyStyle>
`;
      } else if (type === 'marker') {
        const markerCol = hexToKmlColor(props.color, 1);
        kml += `        <IconStyle>
          <color>${markerCol}</color>
          <scale>1.1</scale>
          <Icon>
            <href>https://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href>
          </Icon>
        </IconStyle>
        <LabelStyle>
          <color>ffffffff</color>
          <scale>0.9</scale>
        </LabelStyle>
`;
      } else if (type === 'annotation') {
        const textCol = hexToKmlColor(props.color, 1);
        // Normalize text size relative to standard scale (14px = 1.0)
        const scaleVal = (props.textSize / 14).toFixed(2);
        kml += `        <LabelStyle>
          <color>${textCol}</color>
          <scale>${scaleVal}</scale>
        </LabelStyle>
        <IconStyle>
          <scale>0.0</scale> <!-- Hide marker pin, keep only label -->
        </IconStyle>
`;
      }

      kml += `      </Style>
`;

      // 2. Export Geometries
      if (type === 'polygon') {
        const rings = geom.getCoordinates();
        kml += `      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
`;
        rings[0].forEach((coord) => {
          const lonLat = toLonLat(coord);
          kml += `              ${lonLat[0].toFixed(6)},${lonLat[1].toFixed(6)},0
`;
        });
        kml += `            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
`;
      } else if (type === 'circle') {
        // Approximate Circle as Polygon (64 vertices) for KML compatibility
        const center = geom.getCenter();
        const radius = geom.getRadius();
        const coords = getCirclePolygonCoordinates(center, radius, 64);
        
        kml += `      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
`;
        coords[0].forEach((coord) => {
          const lonLat = toLonLat(coord);
          kml += `              ${lonLat[0].toFixed(6)},${lonLat[1].toFixed(6)},0
`;
        });
        kml += `            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
`;
      } else if (type === 'marker' || type === 'annotation') {
        const lonLat = toLonLat(geom.getCoordinates());
        kml += `      <Point>
        <coordinates>${lonLat[0].toFixed(6)},${lonLat[1].toFixed(6)},0</coordinates>
      </Point>
`;
      }

      kml += `    </Placemark>
`;
    });

    kml += `  </Document>
</kml>`;
    return kml;
  }

  /**
   * Cleans up all resources, vector layers, and interactions from the map
   */
  destroy() {
    this.stopDrawing();
    
    if (this.selectInteraction) this.map.removeInteraction(this.selectInteraction);
    if (this.modifyInteraction) this.map.removeInteraction(this.modifyInteraction);
    if (this.translateInteraction) this.map.removeInteraction(this.translateInteraction);
    if (this.snapInteraction) this.map.removeInteraction(this.snapInteraction);
    
    if (this.vectorLayer) this.map.removeLayer(this.vectorLayer);
    
    this.features = [];
    this.listeners = {};
    this.selectedFeature = null;
  }
}

<template>
  <div class="ui-overlay">
    <!-- Side Control Panel -->
    <div class="control-panel glass">
      <div class="panel-header">
        <div class="brand">
          <div class="pulse-dot"></div>
          <span class="brand-title">MISSION OVERLAY</span>
          <span class="brand-version">v1.1.0</span>
        </div>
      </div>

      <hr class="divider" />

      <!-- Drawing Tools Selection -->
      <div class="panel-section">
        <h3 class="section-title">Drawing Tools</h3>
        
        <!-- Active drawing state message -->
        <div v-if="activeDrawingTool" class="drawing-alert neon-border">
          <div class="alert-pulse"></div>
          <div class="alert-content">
            <span class="alert-label">DRAWING {{ activeDrawingTool.toUpperCase() }}</span>
            <span class="alert-sub">Click on the map to define coordinates</span>
          </div>
          <button class="cancel-draw-btn" @click="stopDrawing">
            Cancel
          </button>
        </div>

        <div class="tools-grid" v-if="!activeDrawingTool">
          <button 
            class="tool-btn" 
            :class="{ active: activeDrawingTool === 'polygon' }"
            @click="startDraw('polygon')"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 10l5-6h6l5 6v6l-5 6H9l-5-6V10z" />
            </svg>
            Polygon Zone
          </button>
          
          <button 
            class="tool-btn" 
            :class="{ active: activeDrawingTool === 'circle' }"
            @click="startDraw('circle')"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9" />
            </svg>
            Circle Zone
          </button>
          
          <button 
            class="tool-btn" 
            :class="{ active: activeDrawingTool === 'marker' }"
            @click="startDraw('marker')"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Geo Marker
          </button>
          
          <button 
            class="tool-btn" 
            :class="{ active: activeDrawingTool === 'annotation' }"
            @click="startDraw('annotation')"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h10M7 16h10" />
            </svg>
            Text Label
          </button>
        </div>
      </div>

      <hr class="divider" />

      <!-- Feature Properties Customizer -->
      <div v-if="selectedFeature" class="panel-section property-editor-section">
        <div class="section-header">
          <h3 class="section-title">Element Properties</h3>
          <span class="type-badge" :class="selectedFeature.type">{{ selectedFeature.type }}</span>
        </div>

        <div class="property-form">
          <!-- Name Input -->
          <div class="form-group">
            <label class="form-label">Element Name</label>
            <input 
              type="text" 
              class="form-input" 
              :value="selectedFeature.name"
              @input="updateProp('name', $event.target.value)"
            />
          </div>

          <!-- Color Properties (Polygon/Circle/Marker/Annotation) -->
          <div class="form-group">
            <label class="form-label">{{ selectedFeature.type === 'annotation' ? 'Text Color' : 'Fill Color' }}</label>
            <div class="color-picker-wrapper">
              <input 
                type="color" 
                class="color-input" 
                :value="selectedFeature.color" 
                @input="updateProp('color', $event.target.value)"
              />
              <span class="color-hex font-mono">{{ selectedFeature.color }}</span>
            </div>
          </div>

          <!-- Fill Opacity (Polygon/Circle) -->
          <div class="form-group" v-if="selectedFeature.type === 'polygon' || selectedFeature.type === 'circle'">
            <div class="form-label-row">
              <label class="form-label">Fill Opacity</label>
              <span class="form-value font-mono">{{ Math.round(selectedFeature.opacity * 100) }}%</span>
            </div>
            <input 
              type="range" 
              class="form-range" 
              min="0" 
              max="1" 
              step="0.05"
              :value="selectedFeature.opacity"
              @input="updateProp('opacity', parseFloat($event.target.value))"
            />
          </div>

          <!-- Stroke Style (Polygon/Circle) -->
          <div class="form-group" v-if="selectedFeature.type === 'polygon' || selectedFeature.type === 'circle'">
            <label class="form-label">Outline Color</label>
            <div class="color-picker-wrapper">
              <input 
                type="color" 
                class="color-input" 
                :value="selectedFeature.strokeColor" 
                @input="updateProp('strokeColor', $event.target.value)"
              />
              <span class="color-hex font-mono">{{ selectedFeature.strokeColor }}</span>
            </div>
          </div>

          <!-- Stroke Width (Polygon/Circle) -->
          <div class="form-group" v-if="selectedFeature.type === 'polygon' || selectedFeature.type === 'circle'">
            <div class="form-label-row">
              <label class="form-label">Outline Width</label>
              <span class="form-value font-mono">{{ selectedFeature.strokeWidth }}px</span>
            </div>
            <input 
              type="range" 
              class="form-range" 
              min="1" 
              max="8" 
              step="1"
              :value="selectedFeature.strokeWidth"
              @input="updateProp('strokeWidth', parseInt($event.target.value))"
            />
          </div>

          <!-- Annotation Text Content (Text Label) -->
          <div class="form-group" v-if="selectedFeature.type === 'annotation'">
            <label class="form-label">Annotation Content</label>
            <textarea 
              class="form-textarea" 
              rows="2"
              :value="selectedFeature.text"
              @input="updateProp('text', $event.target.value)"
            ></textarea>
          </div>

          <!-- Annotation Font Size (Text Label) -->
          <div class="form-group" v-if="selectedFeature.type === 'annotation'">
            <div class="form-label-row">
              <label class="form-label">Font Size</label>
              <span class="form-value font-mono">{{ selectedFeature.textSize }}px</span>
            </div>
            <input 
              type="range" 
              class="form-range" 
              min="10" 
              max="42" 
              step="1"
              :value="selectedFeature.textSize"
              @input="updateProp('textSize', parseInt($event.target.value))"
            />
          </div>

          <!-- Geometry details read-only -->
          <div class="form-group font-mono geom-details">
            <span class="geom-title">Spatial Data</span>
            <div v-if="selectedFeature.type === 'circle' && selectedFeature.radius" class="geom-row">
              <span class="geom-label">Radius:</span>
              <span class="geom-val">{{ selectedFeature.radius.toFixed(1) }} m</span>
            </div>
            <div class="geom-row">
              <span class="geom-label">Position:</span>
              <span class="geom-val text-truncate" v-if="selectedFeature.type === 'marker' || selectedFeature.type === 'annotation' || selectedFeature.type === 'circle'">
                {{ selectedFeature.coordinates[0].toFixed(5) }}, {{ selectedFeature.coordinates[1].toFixed(5) }}
              </span>
              <span class="geom-val text-truncate" v-else>
                Polygon ({{ selectedFeature.coordinates.length }} vertices)
              </span>
            </div>
          </div>

          <!-- Delete Element Button -->
          <button class="delete-element-btn" @click="deleteFeature(selectedFeature.id)">
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Remove Element
          </button>
        </div>
      </div>
      
      <div v-else class="panel-section no-selection">
        <svg class="icon placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 21l8.904-4.813a1 1 0 00.518-.894v-5.228A2 2 0 0016.422 8.1l-6.609-2.203a2 2 0 00-2.5 1.258L4.258 13.76a2 2 0 001.258 2.5l4.3-1.434" />
        </svg>
        <span>No element selected. Draw a shape or select an existing one to edit properties.</span>
      </div>

      <hr class="divider" />

      <!-- List of Placed Shapes -->
      <div class="panel-section list-section">
        <div class="list-section-header">
          <h3 class="section-title">Overlay Elements ({{ features.length }})</h3>
          <button v-if="features.length > 0" class="clear-all-btn" @click="clearAll">
            Clear All
          </button>
        </div>

        <div class="features-list" v-if="features.length > 0">
          <div 
            v-for="item in features" 
            :key="item.id" 
            class="feature-item"
            :class="{ active: selectedFeature && selectedFeature.id === item.id }"
            @click="selectFeature(item.id)"
          >
            <div class="feature-meta">
              <span class="shape-indicator" :class="item.type" :style="{ backgroundColor: item.color }"></span>
              <span class="feature-name">{{ item.name }}</span>
            </div>
            
            <div class="feature-actions">
              <button class="action-btn delete" @click.stop="deleteFeature(item.id)">
                <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        <div v-else class="list-empty">
          No features drawn yet
        </div>
      </div>

      <!-- Export Panel Action -->
      <div class="export-panel" v-if="features.length > 0">
        <button class="export-btn neon-border" @click="exportKML">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export KML Overlay
        </button>
      </div>
    </div>

    <!-- Active Drawing Alert Overlay at Top Center -->
    <div class="alert-box glass neon-border" v-if="activeDrawingTool">
      <div class="alert-pulse"></div>
      <span class="font-mono">PLACING {{ activeDrawingTool.toUpperCase() }}...</span>
    </div>

    <!-- Bottom Bar: Status Display -->
    <div class="status-bar glass">
      <div class="status-item">
        <span class="label">CENTER</span>
        <span class="value font-mono">{{ formatCoords(center) }}</span>
      </div>
      <div class="status-item divider-v"></div>
      <div class="status-item">
        <span class="label">ZOOM</span>
        <span class="value font-mono">{{ zoomLevel.toFixed(1) }}</span>
      </div>
      <div class="status-item divider-v"></div>
      <div class="status-item">
        <span class="label">MOUSE</span>
        <span class="value font-mono">{{ formatCoords(pointerCoords) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { OverlayManager } from '../utils/OverlayManager';

const props = defineProps({
  map: {
    type: Object,
    required: true,
  }
});

let overlayManager = null;

// Local states for coordinates, zoom, features list, selection and active drawing tool
const center = ref([2.3522, 48.8566]);
const zoomLevel = ref(5);
const pointerCoords = ref([2.3522, 48.8566]);

const features = ref([]);
const selectedFeature = ref(null);
const activeDrawingTool = ref(null);

const initializeOverlayTool = (olMap) => {
  if (!olMap) return;

  // Run teardown of any previous maps
  cleanup();

  // Create Standalone Manager
  overlayManager = new OverlayManager(olMap);

  // Subscribe to OverlayManager Events
  overlayManager.on('feature-selected', (feature) => {
    selectedFeature.value = feature;
  });

  overlayManager.on('list-updated', (list) => {
    features.value = list;
    if (selectedFeature.value) {
      const updated = list.find(f => f.id === selectedFeature.value.id);
      selectedFeature.value = updated || null;
    }
  });

  overlayManager.on('draw-stopped', () => {
    activeDrawingTool.value = null;
  });

  // Subscribe to map center/zoom and pointer coordinate changes from the manager
  overlayManager.on('map-moved', (data) => {
    center.value = data.center;
    zoomLevel.value = data.zoom;
  });

  overlayManager.on('pointer-moved', (coordinate) => {
    pointerCoords.value = coordinate;
  });
};

const cleanup = () => {
  if (overlayManager) {
    overlayManager.destroy();
    overlayManager = null;
  }
  features.value = [];
  selectedFeature.value = null;
  activeDrawingTool.value = null;
};

// Listen to prop changes
watch(() => props.map, (newMap) => {
  if (newMap) {
    initializeOverlayTool(newMap);
  }
}, { immediate: true });

onUnmounted(() => {
  cleanup();
});

// Operations calling directly into OverlayManager
const startDraw = (tool) => {
  if (!overlayManager) return;
  activeDrawingTool.value = tool;

  // Defaults for styling
  let defaults = {
    color: '#a855f7',
    strokeColor: '#000',
    strokeWidth: 2,
    opacity: 0.3
  };
  
  if (tool === 'marker') {
    defaults.color = '#ef4444';
  } else if (tool === 'annotation') {
    defaults.color = '#3b82f6';
    defaults.textSize = 16;
    defaults.text = 'Mission Zone Label';
  } else if (tool === 'circle') {
    defaults.color = '#10b981';
  }

  overlayManager.startDrawing(tool, defaults);
};

const stopDrawing = () => {
  if (overlayManager) {
    overlayManager.stopDrawing();
  }
  activeDrawingTool.value = null;
};

const selectFeature = (id) => {
  if (overlayManager) {
    overlayManager.selectFeatureById(id);
  }
};

const updateProp = (property, value) => {
  if (overlayManager && selectedFeature.value) {
    overlayManager.updateFeatureProperty(selectedFeature.value.id, property, value);
  }
};

const deleteFeature = (id) => {
  if (overlayManager) {
    overlayManager.deleteFeatureById(id);
  }
};

const clearAll = () => {
  if (confirm('Are you sure you want to clear all drawn overlays? This action cannot be undone.')) {
    if (overlayManager) {
      overlayManager.clearAll();
    }
  }
};

const exportKML = () => {
  if (!overlayManager) return;
  const kmlContent = overlayManager.exportToKML();
  
  const blob = new Blob([kmlContent], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'mission_overlay.kml';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const formatCoords = (coords) => {
  if (!coords || coords.length < 2) return '0.00000, 0.00000';
  const lon = coords[0];
  const lat = coords[1];
  
  const latStr = lat >= 0 ? `${lat.toFixed(5)}°N` : `${Math.abs(lat).toFixed(5)}°S`;
  const lonStr = lon >= 0 ? `${lon.toFixed(5)}°E` : `${Math.abs(lon).toFixed(5)}°W`;
  return `${latStr}, ${lonStr}`;
};
</script>

<style scoped>
.icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none; /* Let clicks pass through to map */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 24px;
  box-sizing: border-box;
}

/* Glassmorphism utility */
.glass {
  background: var(--bg-card);
  backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-lg);
  pointer-events: auto; /* Re-enable pointer events for controls */
}

/* Neon Glow styling */
.neon-border {
  border-color: var(--border-focus);
  box-shadow: 0 0 15px var(--accent-glow), inset 0 0 10px rgba(168, 85, 247, 0.1);
}

/* Side Control Panel */
.control-panel {
  width: 320px;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: calc(100vh - 120px);
  overflow-y: auto;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  background-color: var(--accent);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--accent);
  animation: pulse 2s infinite;
}

.brand-title {
  font-weight: 700;
  font-size: 14px;
  letter-spacing: 1.5px;
  color: var(--text-primary);
}

.brand-version {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--font-mono);
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
}

.divider {
  border: none;
  border-top: 1px solid var(--border-light);
  margin: 0;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.section-title {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-secondary);
  font-weight: 600;
  margin: 0;
}

/* Tools layout */
.tools-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.tool-btn {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  padding: 12px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-sans);
}

.tool-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
  border-color: rgba(255, 255, 255, 0.15);
  transform: translateY(-1px);
}

.tool-btn:active {
  transform: translateY(1px);
}

.tool-btn.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
  box-shadow: 0 0 12px var(--accent-glow);
}

/* Active drawing state banner */
.drawing-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(168, 85, 247, 0.05);
  border: 1px solid var(--border-focus);
  padding: 10px 14px;
  border-radius: 10px;
}

.alert-content {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.alert-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.alert-sub {
  font-size: 9px;
  color: var(--text-muted);
}

.cancel-draw-btn {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #f87171;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.cancel-draw-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
}

/* Property Editor Form */
.property-editor-section {
  animation: slideIn 0.2s ease;
}

.type-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border-radius: 20px;
  font-weight: 700;
  text-transform: uppercase;
}

.type-badge.polygon {
  background: rgba(168, 85, 247, 0.15);
  color: #c084fc;
}

.type-badge.circle {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
}

.type-badge.marker {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.type-badge.annotation {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
}

.property-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 10px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-value {
  font-size: 10px;
  color: var(--text-primary);
  font-weight: 600;
}

.form-input {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
  transition: border 0.2s;
  font-family: var(--font-sans);
}

.form-input:focus {
  border-color: var(--border-focus);
}

.form-textarea {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-primary);
  outline: none;
  resize: vertical;
  transition: border 0.2s;
  font-family: var(--font-sans);
}

.form-textarea:focus {
  border-color: var(--border-focus);
}

.color-picker-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 6px 12px;
}

.color-input {
  background: none;
  border: none;
  padding: 0;
  width: 28px;
  height: 20px;
  cursor: pointer;
  border-radius: 4px;
}

.color-hex {
  font-size: 11px;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.form-range {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
}

.form-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
  box-shadow: 0 0 6px var(--accent-glow);
  transition: transform 0.1s;
}

.form-range::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

.geom-details {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.geom-title {
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 2px;
  font-size: 8px;
  letter-spacing: 0.5px;
}

.geom-row {
  display: flex;
  justify-content: space-between;
}

.geom-label {
  color: var(--text-secondary);
}

.geom-val {
  color: var(--text-primary);
  max-width: 180px;
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-element-btn {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
  padding: 10px;
  border-radius: 8px;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 500;
  transition: all 0.2s;
  width: 100%;
}

.delete-element-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--text-muted);
  font-size: 11px;
  padding: 16px;
  gap: 8px;
}

.placeholder-icon {
  width: 24px;
  height: 24px;
  opacity: 0.4;
}

/* List section */
.list-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clear-all-btn {
  background: transparent;
  border: none;
  color: #f87171;
  font-size: 9px;
  text-transform: uppercase;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.5px;
  opacity: 0.8;
  transition: opacity 0.2s;
}

.clear-all-btn:hover {
  opacity: 1;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 4px;
}

.feature-item {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.feature-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-color: var(--border-focus);
}

.feature-item.active {
  border-color: var(--border-focus);
  background: rgba(168, 85, 247, 0.05);
  box-shadow: 0 0 8px rgba(168, 85, 247, 0.1);
}

.feature-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.shape-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.shape-indicator.polygon {
  border-radius: 2px;
}

.feature-name {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feature-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  color: var(--text-primary);
}

.action-btn.delete:hover {
  color: #f87171;
  background: rgba(239, 68, 68, 0.1);
}

.list-empty {
  font-size: 11px;
  color: var(--text-muted);
  text-align: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.01);
  border: 1px dashed var(--border-light);
  border-radius: 8px;
}

/* Export Panel */
.export-panel {
  margin-top: 4px;
  animation: pulseButton 4s infinite;
}

.export-btn {
  width: 100%;
  background: rgba(168, 85, 247, 0.1);
  border: 1px solid var(--border-focus);
  color: var(--text-primary);
  padding: 12px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.export-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  box-shadow: 0 0 15px var(--accent-glow);
  transform: translateY(-1px);
}

/* Alert dialog box (floating middle top) */
.alert-box {
  position: absolute;
  top: 24px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 30px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 600;
}

.alert-pulse {
  width: 8px;
  height: 8px;
  background-color: var(--accent);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

/* Bottom Bar */
.status-bar {
  width: fit-content;
  border-radius: 12px;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  align-self: flex-start;
  margin-top: auto;
}

.status-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.status-item .label {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--text-muted);
}

.status-item .value {
  font-size: 11px;
  color: var(--text-primary);
  font-weight: 500;
}

.font-mono {
  font-family: var(--font-mono);
}

.divider-v {
  width: 1px;
  height: 14px;
  background: var(--border-light);
}

/* Animations */
@keyframes pulse {
  0% {
    transform: scale(0.9);
    box-shadow: 0 0 0 0 rgba(168, 85, 247, 0.7);
  }
  70% {
    transform: scale(1.1);
    box-shadow: 0 0 0 6px rgba(168, 85, 247, 0);
  }
  100% {
    transform: scale(0.9);
    box-shadow: 0 0 0 0 rgba(168, 85, 247, 0);
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulseButton {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(168, 85, 247, 0);
  }
  50% {
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.15);
  }
}
</style>

<template>
  <div class="ui-overlay">
    <!-- Side Control Panel -->
    <div class="control-panel glass">
      <div class="panel-header">
        <div class="brand">
          <div class="pulse-dot"></div>
          <span class="brand-title">MAP OVERLAY TOOLS</span>
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
            v-for="tool in availableTools" 
            :key="tool.type"
            class="tool-btn" 
            @click="handleToolClick(tool.type)"
          >
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="tool.icon" />
            {{ tool.label }}
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
              @input="handlePropUpdate('name', $event.target.value)"
            />
          </div>

          <!-- Color Properties -->
          <div class="form-group">
            <label class="form-label">{{ selectedFeature.type === 'annotation' ? 'Text Color' : 'Fill Color' }}</label>
            <div class="color-picker-wrapper">
              <input 
                type="color" 
                class="color-input" 
                :value="selectedFeature.color" 
                @input="handlePropUpdate('color', $event.target.value)"
              />
              <span class="color-hex font-mono">{{ selectedFeature.color }}</span>
            </div>
          </div>

          <!-- Fill Opacity (Polygon/Circle/Image) -->
          <div class="form-group" v-if="selectedFeature.type === 'polygon' || selectedFeature.type === 'circle' || selectedFeature.type === 'image'">
            <div class="form-label-row">
              <label class="form-label">{{ selectedFeature.type === 'image' ? 'Image Opacity' : 'Fill Opacity' }}</label>
              <span class="form-value font-mono">{{ Math.round(selectedFeature.opacity * 100) }}%</span>
            </div>
            <input 
              type="range" 
              class="form-range" 
              min="0" 
              max="1" 
              step="0.05"
              :value="selectedFeature.opacity"
              @input="handlePropUpdate('opacity', parseFloat($event.target.value))"
            />
          </div>

          <!-- Image Scale (Image Overlay only) -->
          <div class="form-group" v-if="selectedFeature.type === 'image'">
            <div class="form-label-row">
              <label class="form-label">Image Scale</label>
              <span class="form-value font-mono">{{ Math.round((selectedFeature.scale || 1.0) * 100) }}%</span>
            </div>
            <input 
              type="range" 
              class="form-range" 
              min="0.1" 
              max="4" 
              step="0.05"
              :value="selectedFeature.scale || 1.0"
              @input="handlePropUpdate('scale', parseFloat($event.target.value))"
            />
          </div>

          <!-- Outline Color (Polygon/Circle) -->
          <div class="form-group" v-if="selectedFeature.type === 'polygon' || selectedFeature.type === 'circle'">
            <label class="form-label">Outline Color</label>
            <div class="color-picker-wrapper">
              <input 
                type="color" 
                class="color-input" 
                :value="selectedFeature.strokeColor" 
                @input="handlePropUpdate('strokeColor', $event.target.value)"
              />
              <span class="color-hex font-mono">{{ selectedFeature.strokeColor }}</span>
            </div>
          </div>

          <!-- Outline Width (Polygon/Circle) -->
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
              @input="handlePropUpdate('strokeWidth', parseInt($event.target.value))"
            />
          </div>

          <!-- Annotation Text Content -->
          <div class="form-group" v-if="selectedFeature.type === 'annotation'">
            <label class="form-label">Annotation Content</label>
            <textarea 
              class="form-textarea" 
              rows="2"
              :value="selectedFeature.text"
              @input="handlePropUpdate('text', $event.target.value)"
            ></textarea>
          </div>

          <!-- Annotation Font Size -->
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
              @input="handlePropUpdate('textSize', parseInt($event.target.value))"
            />
          </div>

          <!-- Emoji Character Selection -->
          <div class="form-group" v-if="selectedFeature.type === 'emoji'">
            <label class="form-label">Select Emoji</label>
            <div class="emoji-selector-grid">
              <button 
                v-for="e in emojiPalette"
                :key="e"
                type="button"
                class="emoji-pick-btn"
                :class="{ active: selectedFeature.emoji === e }"
                @click="handlePropUpdate('emoji', e)"
              >
                {{ e }}
              </button>
            </div>
            
            <div class="form-group custom-emoji-input-group" style="margin-top: 8px;">
              <label class="form-label-sub">Or Custom Emoji / Symbol</label>
              <input 
                type="text" 
                class="form-input font-mono" 
                maxlength="5"
                placeholder="Paste emoji..."
                :value="selectedFeature.emoji"
                @input="handlePropUpdate('emoji', $event.target.value)"
              />
            </div>
          </div>

          <!-- Emoji Size -->
          <div class="form-group" v-if="selectedFeature.type === 'emoji'">
            <div class="form-label-row">
              <label class="form-label">Emoji Size</label>
              <span class="form-value font-mono">{{ selectedFeature.emojiSize }}px</span>
            </div>
            <input 
              type="range" 
              class="form-range" 
              min="16" 
              max="80" 
              step="2"
              :value="selectedFeature.emojiSize"
              @input="handlePropUpdate('emojiSize', parseInt($event.target.value))"
            />
          </div>

          <!-- Geometry details read-only -->
          <div class="form-group font-mono geom-details">
            <span class="geom-title">Spatial Data</span>
            <div class="geom-row">
              <span class="geom-label">Type:</span>
              <span class="geom-val" style="text-transform: capitalize;">{{ selectedFeature.type }}</span>
            </div>
            <div v-if="selectedFeature.type === 'circle' && selectedFeature.radius" class="geom-row">
              <span class="geom-label">Radius:</span>
              <span class="geom-val">{{ selectedFeature.radius.toFixed(1) }} m</span>
            </div>
            <div class="geom-row">
              <span class="geom-label">{{ isPointType(selectedFeature.type) ? 'Position:' : 'Center:' }}</span>
              <span class="geom-val text-truncate">
                <span v-if="isPointType(selectedFeature.type)">
                  {{ selectedFeature.coordinates[0].toFixed(5) }}, {{ selectedFeature.coordinates[1].toFixed(5) }}
                </span>
                <span v-else>
                  {{ getCenterOfCoords(selectedFeature.coordinates) }}
                </span>
              </span>
            </div>
            <div v-if="!isPointType(selectedFeature.type)" class="geom-row">
              <span class="geom-label">Vertices:</span>
              <span class="geom-val">{{ selectedFeature.coordinates.length }} points</span>
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
          <button v-if="features.length > 0" class="clear-all-btn" @click="handleClearAll">
            {{ confirmingClear ? 'Confirm Delete?' : 'Clear All' }}
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
              <span v-if="item.type === 'emoji'" class="emoji-indicator">{{ item.emoji }}</span>
              <span v-else class="shape-indicator" :class="item.type" :style="{ backgroundColor: item.color }"></span>
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
        <button class="export-btn neon-border" @click="handleExportKMZ">
          <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export KMZ Overlay
        </button>
      </div>
    </div>

    <!-- Active Drawing Alert Overlay at Top Center -->
    <div class="alert-box glass neon-border" v-if="activeDrawingTool">
      <div class="alert-pulse"></div>
      <span class="font-mono">PLACING {{ activeDrawingTool.toUpperCase() }}...</span>
    </div>

    <!-- Hidden file input for Image Overlay upload -->
    <input 
      type="file" 
      ref="imageInput" 
      accept="image/*" 
      style="display: none" 
      @change="onImageSelected" 
    />
  </div>
</template>

<script setup>
/**
 * MapOverlay — Thin Vue UI shell for the OverlayManager library.
 *
 * All drawing logic, feature management, and export are delegated to the
 * composable (useOverlayManager) which wraps the framework-agnostic core.
 *
 * This component is purely a view layer: it renders controls, wires user
 * interactions to composable actions, and displays reactive state.
 */

import { ref, computed, toRef } from 'vue';
import { useOverlayManager } from '../composables/useOverlayManager.js';
import { TOOL_TYPES, DEFAULT_EMOJI_PALETTE } from '../lib/defaults.js';

// ── Props ────────────────────────────────────────────────────────

const props = defineProps({
  /** The OpenLayers Map instance to attach to. */
  map: {
    type: Object,
    required: true,
  },
  /** Which drawing tools to expose in the toolbar. */
  tools: {
    type: Array,
    default: () => TOOL_TYPES,
    validator: (v) => v.every((t) => TOOL_TYPES.includes(t)),
  },
  /** Emoji palette shown in the emoji property editor. */
  emojiPalette: {
    type: Array,
    default: () => DEFAULT_EMOJI_PALETTE,
  },
  /** Filename used for KML export download. */
  exportFilename: {
    type: String,
    default: 'overlay.kml',
  },
  /** Options forwarded to the OverlayManager constructor. */
  managerOptions: {
    type: Object,
    default: () => ({}),
  },
});

// ── Tool definitions (SVG icons + labels) ─────────────────────────

const TOOL_ICONS = {
  polygon: '<path stroke-linecap="round" stroke-linejoin="round" d="M4 10l5-6h6l5 6v6l-5 6H9l-5-6V10z" />',
  circle: '<circle cx="12" cy="12" r="9" />',
  marker: '<path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />',
  annotation: '<path stroke-linecap="round" stroke-linejoin="round" d="M7 8h10M7 12h10M7 16h10" />',
  emoji: '<path stroke-linecap="round" stroke-linejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />',
  image: '<path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />',
};

const TOOL_LABELS = {
  polygon: 'Polygon Zone',
  circle: 'Circle Zone',
  marker: 'Geo Marker',
  annotation: 'Text Label',
  emoji: 'Emoji Marker',
  image: 'Image Overlay',
};

const availableTools = computed(() =>
  props.tools.map((type) => ({
    type,
    label: TOOL_LABELS[type] || type,
    icon: TOOL_ICONS[type] || '',
  })),
);

// ── Composable ──────────────────────────────────────────────────

const mapRef = toRef(props, 'map');

const {
  features,
  selectedFeature,
  activeDrawingTool,
  startDraw,
  stopDrawing,
  selectFeature,
  updateProp,
  deleteFeature,
  clearAll,
  downloadKML,
  downloadKMZ,
  addImageOverlay,
} = useOverlayManager(mapRef, props.managerOptions);

const imageInput = ref(null);

function handleToolClick(type) {
  if (type === 'image') {
    imageInput.value?.click();
  } else {
    startDraw(type);
  }
}

function onImageSelected(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    if (dataUrl) {
      addImageOverlay(dataUrl, file.name.replace(/\.[^/.]+$/, ''));
    }
  };
  reader.readAsDataURL(file);

  // Reset the file input so the same image can be re-uploaded if needed
  event.target.value = '';
}

function handleExportKMZ() {
  const kmzFilename = props.exportFilename.replace(/\.kml$/i, '.kmz');
  downloadKMZ({ filename: kmzFilename });
}

// ── Local UI state ──────────────────────────────────────────────

const confirmingClear = ref(false);
let clearConfirmTimer = null;

// ── Actions ─────────────────────────────────────────────────────

/**
 * Proxy prop updates to the composable, guarding against missing selection.
 */
function handlePropUpdate(property, value) {
  if (selectedFeature.value) {
    updateProp(selectedFeature.value.id, property, value);
  }
}

/**
 * Two-click "Clear All" — replaces browser confirm() with inline confirmation.
 * First click shows "Confirm Delete?", second click within 3s actually clears.
 */
function handleClearAll() {
  if (confirmingClear.value) {
    clearAll();
    confirmingClear.value = false;
    if (clearConfirmTimer) clearTimeout(clearConfirmTimer);
  } else {
    confirmingClear.value = true;
    clearConfirmTimer = setTimeout(() => {
      confirmingClear.value = false;
    }, 3000);
  }
}

/**
 * Check if a feature type uses a Point geometry (single coordinate).
 */
function isPointType(type) {
  return type === 'marker' || type === 'annotation' || type === 'circle' || type === 'emoji';
}

/**
 * Get geographic center of a list of coordinates.
 */
function getCenterOfCoords(coordinates) {
  if (!coordinates || coordinates.length === 0) return '';
  const lons = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  const lon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const lat = (Math.min(...lats) + Math.max(...lats)) / 2;
  return `${lon.toFixed(5)}, ${lat.toFixed(5)}`;
}
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
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  padding: 24px;
  box-sizing: border-box;

  /* Self-contained light-mode theme — scoped to this component */
  --bg-card: rgba(255, 255, 255, 0.88);
  --border-light: rgba(0, 0, 0, 0.08);
  --border-focus: rgba(168, 85, 247, 0.6);
  --text-primary: #1f2937;
  --text-secondary: #4b5563;
  --text-muted: #9ca3af;
  --accent: #a855f7;
  --accent-glow: rgba(168, 85, 247, 0.15);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
  --backdrop-blur: blur(12px);
  --font-sans: 'Outfit', system-ui, sans-serif;
  --font-mono: 'Space Mono', ui-monospace, monospace;
}

/* Glassmorphism */
.glass {
  background: var(--bg-card);
  backdrop-filter: var(--backdrop-blur);
  border: 1px solid var(--border-light);
  box-shadow: var(--shadow-lg);
  pointer-events: auto;
}

/* Neon Glow */
.neon-border {
  border-color: var(--border-focus);
  box-shadow: 0 0 15px var(--accent-glow), inset 0 0 10px rgba(168, 85, 247, 0.05);
}

/* Side Control Panel */
.control-panel {
  width: 330px;
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
  font-size: 16px;
  letter-spacing: 1.5px;
  color: var(--text-primary);
  font-family: var(--font-sans);
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
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text-secondary);
  font-weight: 600;
  margin: 0;
  font-family: var(--font-sans);
}

/* Tools layout */
.tools-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.tool-btn {
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  padding: 12px 10px;
  border-radius: 10px;
  font-size: 13px;
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
  background: rgba(0, 0, 0, 0.05);
  color: var(--text-primary);
  border-color: rgba(0, 0, 0, 0.15);
  transform: translateY(-1px);
}

.tool-btn:active {
  transform: translateY(1px);
}

.emoji-tool-btn {
  grid-column: span 2;
}

/* Active drawing state banner */
.drawing-alert {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(168, 85, 247, 0.08);
  border: 1px solid var(--border-focus);
  padding: 10px 14px;
  border-radius: 10px;
}

.alert-content {
  display: flex;
  flex-grow: 1;
  flex-direction: column;
}

.alert-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.5px;
  font-family: var(--font-sans);
}

.alert-sub {
  font-size: 11px;
  color: var(--text-secondary);
}

.cancel-draw-btn {
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.25);
  color: #ef4444;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.cancel-draw-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.4);
}

/* Property Editor */
.property-editor-section {
  animation: slideIn 0.2s ease;
}

.type-badge {
  font-size: 11px;
  font-family: var(--font-mono);
  padding: 2px 8px;
  border-radius: 20px;
  font-weight: 700;
  text-transform: uppercase;
}

.type-badge.polygon {
  background: rgba(168, 85, 247, 0.12);
  color: #8b5cf6;
}

.type-badge.circle {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.type-badge.marker {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}

.type-badge.annotation {
  background: rgba(59, 130, 246, 0.12);
  color: #2563eb;
}

.type-badge.emoji {
  background: rgba(245, 158, 11, 0.15);
  color: #d97706;
}

.type-badge.image {
  background: rgba(6, 182, 212, 0.12);
  color: #0891b2;
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
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

.form-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-value {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 600;
}

.form-input {
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
  color: var(--text-primary);
  outline: none;
  transition: border 0.2s;
  font-family: var(--font-sans);
}

.form-input:focus {
  border-color: var(--border-focus);
}

.form-textarea {
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 14px;
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
  background: rgba(0, 0, 0, 0.04);
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
  font-size: 13px;
  color: var(--text-primary);
  letter-spacing: 0.5px;
}

.form-range {
  -webkit-appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.08);
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
  background: rgba(0, 0, 0, 0.02);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.geom-title {
  color: var(--text-muted);
  font-weight: 600;
  text-transform: uppercase;
  margin-bottom: 2px;
  font-size: 10px;
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
  font-size: 13px;
}

.text-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.delete-element-btn {
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #ef4444;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
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
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.4);
}

.no-selection {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
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
  color: #ef4444;
  font-size: 11px;
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
  background: rgba(0, 0, 0, 0.02);
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
  background: rgba(0, 0, 0, 0.04);
  border-color: var(--border-focus);
}

.feature-item.active {
  border-color: var(--border-focus);
  background: rgba(168, 85, 247, 0.08);
  box-shadow: 0 0 8px rgba(168, 85, 247, 0.15);
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
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.shape-indicator.polygon {
  border-radius: 2px;
}

.shape-indicator.image {
  border-radius: 2px;
  background-color: #0891b2;
}

.emoji-indicator {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.emoji-selector-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 6px;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid var(--border-light);
  border-radius: 8px;
  padding: 8px;
}

.emoji-pick-btn {
  background: transparent;
  border: 1px solid transparent;
  font-size: 20px;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.emoji-pick-btn:hover {
  background: rgba(0, 0, 0, 0.05);
  transform: scale(1.15);
}

.emoji-pick-btn.active {
  background: rgba(168, 85, 247, 0.1);
  border-color: var(--border-focus);
  box-shadow: 0 0 8px rgba(168, 85, 247, 0.15);
  transform: scale(1.1);
}

.form-label-sub {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.feature-name {
  font-size: 14px;
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
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.list-empty {
  font-size: 13px;
  color: var(--text-muted);
  text-align: center;
  padding: 12px;
  background: rgba(0, 0, 0, 0.01);
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
  background: rgba(168, 85, 247, 0.08);
  border: 1px solid var(--border-focus);
  color: var(--text-primary);
  padding: 12px;
  border-radius: 10px;
  font-weight: 600;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-family: var(--font-sans);
}

.export-btn:hover {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  box-shadow: 0 0 15px var(--accent-glow);
  transform: translateY(-1px);
}

/* Alert dialog box (floating top center) */
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
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
  font-family: var(--font-mono);
}

.alert-pulse {
  width: 8px;
  height: 8px;
  background-color: var(--accent);
  border-radius: 50%;
  animation: pulse 1.5s infinite;
}

.font-mono {
  font-family: var(--font-mono);
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

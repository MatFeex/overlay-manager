/**
 * @module useOverlayManager
 * Vue 3 composable that bridges the framework-agnostic OverlayManager
 * into Vue's reactivity system.
 *
 * This is the ONLY file that couples the library to Vue.
 *
 * @example
 * const { manager, features, selectedFeature, activeDrawingTool, startDraw, stopDrawing } =
 *   useOverlayManager(mapRef);
 */

import { ref, watch, onUnmounted, shallowRef } from 'vue';
import { OverlayManager } from '../lib/OverlayManager.js';
import { KmzExporter } from '../lib/KmzExporter.js';
import { DEFAULT_TOOL_STYLES } from '../lib/defaults.js';

/**
 * @param {import('vue').Ref<import('ol/Map').default|null>} mapRef - Reactive reference to the OL Map
 * @param {object} [options] - Options forwarded to OverlayManager constructor
 * @returns {object} Reactive state and action methods
 */
export function useOverlayManager(mapRef, options = {}) {
  /** @type {import('vue').ShallowRef<OverlayManager|null>} */
  const manager = shallowRef(null);

  // ── Reactive state ──────────────────────────────────────────
  const features = ref([]);
  const selectedFeature = ref(null);
  const activeDrawingTool = ref(null);

  const isInternalManager = ref(false);

  // ── Internal lifecycle ──────────────────────────────────────

  function init(map) {
    if (!map) return;
    cleanup();

    let instance;
    if (options.overlayManager) {
      instance = options.overlayManager;
      isInternalManager.value = false;
    } else {
      instance = new OverlayManager(map, options);
      isInternalManager.value = true;
    }

    // Populate initial features from manager
    features.value = instance.getFeatures();

    // Wire events → reactive refs
    instance.on('feature:select', (props) => {
      selectedFeature.value = props;
    });

    instance.on('features:change', (list) => {
      features.value = list;
      // Keep selected feature in sync after list changes
      if (selectedFeature.value) {
        const updated = list.find((f) => f.id === selectedFeature.value.id);
        selectedFeature.value = updated || null;
      }
    });

    instance.on('draw:stop', () => {
      activeDrawingTool.value = null;
    });

    manager.value = instance;
  }

  function cleanup() {
    if (manager.value) {
      if (isInternalManager.value) {
        manager.value.destroy();
      }
      manager.value = null;
    }
    features.value = [];
    selectedFeature.value = null;
    activeDrawingTool.value = null;
  }

  // Watch for map reference changes (handles both initial mount and hot-swap)
  watch(
    () => mapRef.value,
    (newMap) => {
      if (newMap) init(newMap);
    },
    { immediate: true },
  );

  onUnmounted(cleanup);

  // ── Action methods ──────────────────────────────────────────

  /**
   * Start drawing with a specific tool.
   * Merges tool-specific defaults before forwarding to the manager.
   * @param {string} tool - Tool type ('polygon', 'circle', 'marker', 'annotation', 'emoji')
   * @param {object} [overrides] - Additional property overrides
   */
  function startDraw(tool, overrides = {}) {
    if (!manager.value) return;
    activeDrawingTool.value = tool;

    const toolDefaults = DEFAULT_TOOL_STYLES[tool] || {};
    manager.value.startDrawing(tool, { ...toolDefaults, ...overrides });
  }

  /**
   * Stop the active drawing interaction.
   */
  function stopDrawing() {
    if (!manager.value) return;
    manager.value.stopDrawing();
    activeDrawingTool.value = null;
  }

  /**
   * Select a feature by ID.
   */
  function selectFeature(id) {
    if (manager.value) manager.value.selectFeatureById(id);
  }

  /**
   * Update a property on a specific feature.
   */
  function updateProp(id, property, value) {
    if (manager.value) manager.value.updateFeatureProperty(id, property, value);
  }

  /**
   * Delete a feature by ID.
   */
  function deleteFeature(id) {
    if (manager.value) manager.value.deleteFeatureById(id);
  }

  /**
   * Remove all features.
   */
  function clearAll() {
    if (manager.value) manager.value.clearAll();
  }

  /**
   * Export features as KML and trigger download.
   * @param {object} [exportOptions]
   */
  function downloadKML(exportOptions = {}) {
    if (manager.value) manager.value.downloadKML(exportOptions);
  }

  /**
   * Export features as KMZ and trigger download.
   * @param {object} [exportOptions]
   */
  function downloadKMZ(exportOptions = {}) {
    if (manager.value) {
      KmzExporter.downloadKMZ(features.value, exportOptions);
    }
  }

  /**
   * Programmatically add an image overlay.
   * @param {string} dataUrl - Base64 Data URL or path
   * @param {string} [name] - Optional overlay name
   */
  function addImageOverlay(dataUrl, name) {
    if (manager.value) {
      manager.value.addImageOverlay(dataUrl, name);
    }
  }

  /**
   * Import features from a KMZ/KML file.
   */
  async function importKMZ(fileOrBlob, options = {}) {
    if (manager.value) {
      return await manager.value.importKMZ(fileOrBlob, options);
    }
    return [];
  }

  return {
    // Core instance (escape hatch for advanced usage)
    manager,

    // Reactive state
    features,
    selectedFeature,
    activeDrawingTool,

    // Actions
    startDraw,
    stopDrawing,
    selectFeature,
    updateProp,
    deleteFeature,
    clearAll,
    downloadKML,
    downloadKMZ,
    addImageOverlay,
    importKMZ,
  };
}

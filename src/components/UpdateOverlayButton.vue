<template>
  <div class="update-overlay-wrapper">
    <button
      type="button"
      :class="['update-overlay-btn', buttonClass, { loading: isLoading }]"
      :disabled="isLoading"
      @click="triggerFilePicker"
    >
      <slot v-if="isLoading" name="loading">
        <svg class="spinner" viewBox="0 0 24 24" fill="none">
          <circle class="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
          <circle class="spinner-head" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-dasharray="80" stroke-dashoffset="60"></circle>
        </svg>
        <span>Processing...</span>
      </slot>
      <slot v-else>
        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span>{{ buttonText }}</span>
      </slot>
    </button>
    
    <input
      ref="fileInput"
      type="file"
      class="hidden-file-input"
      :accept="accept"
      @change="handleFileChange"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { KmzImporter } from '../lib/KmzImporter.js';

const props = defineProps({
  /**
   * The OverlayManager instance. If provided, the button will automatically
   * import the features into it.
   */
  overlayManager: {
    type: Object,
    default: null,
  },
  /**
   * Whether to clear existing features on import.
   */
  clearExisting: {
    type: Boolean,
    default: true,
  },
  /**
   * Standard button text label.
   */
  buttonText: {
    type: String,
    default: 'Update overlay',
  },
  /**
   * Custom CSS class to style the button.
   */
  buttonClass: {
    type: String,
    default: '',
  },
  /**
   * File input accept attribute (defaults to .kmz and .kml).
   */
  accept: {
    type: String,
    default: '.kmz,.kml',
  },
});

const emit = defineEmits(['loading', 'success', 'error', 'parsed']);

const fileInput = ref(null);
const isLoading = ref(false);

function triggerFilePicker() {
  fileInput.value?.click();
}

async function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  isLoading.value = true;
  emit('loading', true);

  try {
    // 1. Convert KMZ to openlayers compatible feature property list
    const features = await KmzImporter.parse(file);
    emit('parsed', features);

    // 2. If overlayManager is provided, import directly into OpenLayers map
    if (props.overlayManager) {
      if (typeof props.overlayManager.importKMZ === 'function') {
        const imported = await props.overlayManager.importKMZ(file, {
          clearExisting: props.clearExisting,
        });
        emit('success', imported);
      } else {
        throw new Error('Provided overlayManager is missing importKMZ method.');
      }
    } else {
      emit('success', features);
    }
  } catch (error) {
    console.error('[UpdateOverlayButton] KMZ Import error:', error);
    emit('error', error);
  } finally {
    isLoading.value = false;
    emit('loading', false);
    // Reset file input value to allow uploading the same file again
    if (fileInput.value) {
      fileInput.value.value = '';
    }
  }
}
</script>

<style scoped>
.update-overlay-wrapper {
  display: inline-block;
}

.update-overlay-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(168, 85, 247, 0.1);
  border: 1px solid rgba(168, 85, 247, 0.4);
  color: #a855f7;
  padding: 10px 16px;
  border-radius: 10px;
  font-family: 'Outfit', system-ui, sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  outline: none;
  box-shadow: 0 0 10px rgba(168, 85, 247, 0.05);
}

.update-overlay-btn:hover:not(:disabled) {
  background: rgba(168, 85, 247, 0.18);
  border-color: rgba(168, 85, 247, 0.7);
  box-shadow: 0 0 15px rgba(168, 85, 247, 0.2);
  transform: translateY(-1px);
}

.update-overlay-btn:active:not(:disabled) {
  transform: translateY(1px);
}

.update-overlay-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-icon {
  width: 18px;
  height: 18px;
  transition: transform 0.2s ease;
}

.update-overlay-btn:hover:not(:disabled) .btn-icon {
  transform: translateY(-1px);
}

.hidden-file-input {
  display: none !important;
}

/* Spinner style */
.spinner {
  width: 18px;
  height: 18px;
  animation: rotate 1s linear infinite;
}

.spinner-track {
  opacity: 0.25;
}

.spinner-head {
  opacity: 0.85;
  transform-origin: center;
}

@keyframes rotate {
  100% {
    transform: rotate(360deg);
  }
}
</style>

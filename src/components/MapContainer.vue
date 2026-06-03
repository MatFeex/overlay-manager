<template>
  <div ref="mapElement" class="map-container"></div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import { fromLonLat, toLonLat } from 'ol/proj';
import { defaults as defaultControls } from 'ol/control';

const emit = defineEmits([
  'map-ready',
  'update:center',
  'update:zoom',
  'pointer-move'
]);

const mapElement = ref(null);
let map = null;
let osmLayer = null;

onMounted(() => {
  // Standard OSM Layer with Dark styling filter via CSS
  osmLayer = new TileLayer({
    source: new OSM(),
    opacity: 0.85
  });

  map = new Map({
    target: mapElement.value,
    layers: [osmLayer],
    view: new View({
      center: fromLonLat([2.3522, 48.8566]), // Paris default
      zoom: 5,
      minZoom: 2,
      maxZoom: 19,
    }),
    controls: defaultControls({
      zoom: true,
      attribution: false,
    }),
  });

  // Emit the raw OpenLayers Map instance once ready
  emit('map-ready', map);

  // Basic map coordinates & navigation events
  const view = map.getView();
  const handleMoveEnd = () => {
    const center = toLonLat(view.getCenter());
    const zoom = view.getZoom();
    emit('update:center', center);
    emit('update:zoom', zoom);
  };

  map.on('moveend', handleMoveEnd);

  map.on('pointermove', (event) => {
    if (event.dragging) return;
    const coordinate = toLonLat(event.coordinate);
    emit('pointer-move', coordinate);
  });

  handleMoveEnd();
});

onUnmounted(() => {
  if (map) {
    map.dispose();
  }
});
</script>

<style scoped>
.map-container {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
}

/* OpenLayers dark layer filter style */
.dark-theme :deep(.ol-layer) {
  filter: invert(90%) hue-rotate(180deg) brightness(85%) contrast(110%);
}
</style>

<template>
  <div class="map-container">
    <ol-map ref="mapRef" style="width: 100%; height: 100%; display: block;">
      <ol-view
        :center="center"
        :zoom="zoom"
        :min-zoom="2"
        :max-zoom="19"
        projection="EPSG:3857"
      />
      <ol-tile-layer>
        <ol-source-osm />
      </ol-tile-layer>
    </ol-map>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { fromLonLat } from 'ol/proj';

const emit = defineEmits(['map-ready']);

const mapRef = ref(null);
const center = ref(fromLonLat([2.3522, 48.8566])); // Paris default
const zoom = ref(5);

onMounted(() => {
  if (mapRef.value?.map) {
    emit('map-ready', mapRef.value.map);
  } else {
    // Retry interval if map is not immediately initialized by vue3-openlayers
    const checkInterval = setInterval(() => {
      if (mapRef.value?.map) {
        emit('map-ready', mapRef.value.map);
        clearInterval(checkInterval);
      }
    }, 50);
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

ol-map {
  display: block;
  width: 100%;
  height: 100%;
}

:deep(.ol-viewport) {
  width: 100% !important;
  height: 100% !important;
}
</style>

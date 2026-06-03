<script setup>
import { ref } from 'vue';
import MapContainer from './components/MapContainer.vue';
import MapOverlay from './components/MapOverlay.vue';

const map = ref(null);
</script>

<template>
  <div class="app-viewport">
    <MapContainer @map-ready="map = $event" />
    <MapOverlay v-if="map" :map="map" />
  </div>
</template>

<style>
/* Full screen viewport reset */
.app-viewport {
  position: relative;
  width: 100vw;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
}
</style>

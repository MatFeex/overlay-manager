<script setup>
import { ref } from 'vue';
import Map from './components/Map.vue';
import MapOverlay from './components/MapOverlay.vue';

const map = ref(null);
</script>

<template>
  <div class="app-viewport">
    <Map @map-ready="map = $event" />
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

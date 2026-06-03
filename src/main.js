import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import OpenLayersMap from 'vue3-openlayers'
import 'ol/ol.css'
import 'vue3-openlayers/vue3-openlayers.css'
import 'ol-ext/dist/ol-ext.css'

const app = createApp(App)
app.use(OpenLayersMap)
app.mount('#app')

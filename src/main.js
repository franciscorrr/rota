// Entry point: mounts the Vue application.

import '@picocss/pico/css/pico.min.css';
import { createApp } from 'vue';
import App from './App.vue';
import './styles.css';

createApp(App).mount('#app');

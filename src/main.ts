import 'virtual:uno.css'
import './main.css'

import { createApp } from 'vue'

import App from './view/App.vue'

export const app = createApp(App)

app.mount('#app')

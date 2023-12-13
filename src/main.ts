import 'animate.css'
import 'virtual:uno.css'
import './main.css'

import { devtools } from '@nanostores/vue/devtools'
import { createApp } from 'vue'

// @ts-expect-error - vue root import
import App from './view/App.vue'

export const app = createApp(App)
app.use(devtools, {})

app.mount('#app')

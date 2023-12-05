import './main.css'

import { World } from './world'

window.addEventListener('DOMContentLoaded', async () => {
  const world = new World()
  await world.setup()
  world.render()
})

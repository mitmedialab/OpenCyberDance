import {World} from './world.js'

window.addEventListener('DOMContentLoaded', async () => {
  const world = new World()
  await world.setup()
  world.render()
})

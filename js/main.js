import {World} from './world.js'

window.addEventListener('DOMContentLoaded', () => {
  const world = new World()
  world.setup()
  world.render()
})

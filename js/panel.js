import GUI from 'https://cdn.jsdelivr.net/npm/lil-gui@0.18/+esm'

import {Params} from './overrides.js'

import {Character} from './character.js'

export class Panel {
  panel = new GUI({width: 310})

  /** @type {Params} */
  params = null

  handlers = {
    energy: () => {},
    delay: () => {},
    rotation: () => {},
    timescale: () => {},
    action: () => {},
    character: () => {},
    reset: () => {},
  }

  constructor(params) {
    this.params = params
  }

  /**
   * @param {keyof typeof coreParts} parts
   */
  addEnergy(...parts) {
    for (const part of parts) {
      this.energyFolder
        .add(this.params.energy, part, 1, 8, 0.01)
        .listen()
        .onChange(this.handlers.energy)
    }
  }

  /**
   * @param {keyof typeof delayParts} parts
   */
  addDelay(...parts) {
    for (const part of parts) {
      this.delayFolder
        .add(this.params.delays, part, -10, 10, 0.01)
        .listen()
        .onChange(this.handlers.delay)
    }
  }

  addRotations() {
    for (const axis of ['x', 'y', 'z']) {
      this.rotationFolder
        .add(this.params.rotations, axis, 1, 10)
        .listen()
        .onChange(this.handlers.rotation)
    }
  }

  /** @param {keyof typeof Params.prototype.characters} char */
  addCharacterControl(folder, char) {
    const field = this.params.characters[char]

    folder
      .add(field, 'model', Object.keys(Character.sources))
      .listen()
      .onChange(() => this.handlers.character(char))

    folder
      .add(field, 'action')
      .listen()
      .onChange(() => this.handlers.action(char))
  }

  createPanel() {
    const panel = this.panel

    this.globalFolder = panel.addFolder('General Settings')
    this.rotationFolder = panel.addFolder('All Rotations')
    this.energyFolder = panel.addFolder('Energy')
    this.delayFolder = panel.addFolder('Delays')
    this.characterFolder = panel.addFolder('Characters')

    this.addRotations()
    this.addEnergy('head', 'body', 'legs')
    this.addDelay('leftArm', 'rightArm', 'leftLeg', 'rightLeg')

    this.globalFolder
      .add(this.params, 'timescale', 0, 5, 0.01)
      .name('Animation Speed')
      .listen()
      .onChange(this.handlers.timescale)

    this.globalFolder
      .add({reset: this.reset.bind(this)}, 'reset')
      .name('Reset')
      .listen()

    const primary = this.characterFolder.addFolder('Primary')
    this.addCharacterControl(primary, 'second')

    const secondary = this.characterFolder.addFolder('Secondary')
    this.addCharacterControl(secondary, 'first')

    this.globalFolder.open()
    this.rotationFolder.open()
    this.energyFolder.open()
    this.delayFolder.open()
    this.characterFolder.open()
  }

  reset() {
    this.panel.reset()
    this.handlers.reset()
  }
}

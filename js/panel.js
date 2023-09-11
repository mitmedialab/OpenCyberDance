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
    voice: () => {},
    freezePosition: () => {},
    seek: () => {},
    pause: () => {},
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

    folder.character = char

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

    this.playbackFolder = panel.addFolder('Playback Settings')
    this.commandFolder = panel.addFolder('Commands')
    this.rotationFolder = panel.addFolder('All Rotations')
    this.energyFolder = panel.addFolder('Energy')
    this.delayFolder = panel.addFolder('Shifting / Synchronic')
    this.characterFolder = panel.addFolder('Characters')

    this.addRotations()
    this.addEnergy('head', 'body', 'foot')
    this.addDelay('leftArm', 'rightArm', 'leftLeg', 'rightLeg')

    this.commandFolder
      .add({reset: this.reset.bind(this)}, 'reset')
      .name('Reset')
      .listen()

    this.commandFolder
      .add({voice: this.handlers.voice.bind(this)}, 'voice')
      .name('Voice')
      .listen()

    this.commandFolder
      .add({freezePosition: this.handlers.freezePosition}, 'freezePosition')
      .name('Lock Position')
      .listen()

    this.playbackFolder
      .add(this.params, 'timescale', 0, 5, 0.01)
      .name('Animation Speed')
      .listen()
      .onChange(this.handlers.timescale)

    this.playbackFolder
      .add(this.params, 'time', 0, 100, 0.01)
      .name('Seek')
      .listen()
      .onChange(this.handlers.seek)

    this.playbackFolder
      .add(this.params, 'paused')
      .name('Paused')
      .listen()
      .onChange(this.handlers.pause)

    for (const key in this.params.characters) {
      const folder = this.characterFolder.addFolder(`Character: ${key}`)
      this.addCharacterControl(folder, key)
    }

    this.commandFolder.open()
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

import GUI from 'lil-gui'

import { CAMERA_PRESETS } from './camera'
import { Character, CharacterKey } from './character'
import { Params } from './overrides'
import { axisPointControlParts, CorePartKey, DelayPartKey } from './parts'
import { transformers } from './transforms'

interface Handlers {
  energy(): void
  delay(): void
  rotation(): void
  timescale(scale: number): void
  action(char: string): void
  character(char: string): void
  reset(): void
  voice(): void
  prompt(command: string): void
  lockPosition(lock: boolean): void
  seek(time: number): void
  pause(paused: boolean): void
  curve(): void
  space(): void
  showGraph(visible: boolean): void
  setCamera(): void
  axisPoint(): void
}

export class Panel {
  params: Params
  panel = new GUI({ width: 310 })

  energyFolder: GUI | null = null
  spaceFolder: GUI | null = null
  delayFolder: GUI | null = null
  rotationFolder: GUI | null = null
  curveFolder: GUI | null = null
  curvePartsFolder: GUI | null = null
  curveAxisFolder: GUI | null = null
  playbackFolder: GUI | null = null
  commandFolder: GUI | null = null
  characterFolder: GUI | null = null
  axisPointFolder: GUI | null = null

  handlers: Handlers = {
    energy: () => {},
    delay: () => {},
    rotation: () => {},
    timescale: () => {},
    action: () => {},
    character: () => {},
    reset: () => {},
    voice: () => {},
    prompt: () => {},
    lockPosition: () => {},
    seek: () => {},
    pause: () => {},
    curve: () => {},
    space: () => {},
    showGraph: () => {},
    setCamera: () => {},
    axisPoint: () => {},
  }

  constructor(params: Params) {
    this.params = params
  }

  addEnergy(...parts: CorePartKey[]) {
    for (const part of parts) {
      this.energyFolder
        ?.add(this.params.energy, part, 1, 3, 0.001)
        .listen()
        .onChange(this.handlers.energy)
    }
  }

  addDelay(...parts: DelayPartKey[]) {
    for (const part of parts) {
      this.delayFolder
        ?.add(this.params.delays, part, -10, 10, 0.01)
        .listen()
        .onChange(this.handlers.delay)
    }
  }

  addRotations() {
    for (const axis of ['x', 'y', 'z']) {
      this.rotationFolder
        ?.add(this.params.rotations, axis, 1, 5)
        .listen()
        .onChange(this.handlers.rotation)
    }
  }

  addCharacterControl(folder: GUI, char: CharacterKey) {
    const field = this.params.characters[char]

    // @ts-expect-error - attached field
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

  addCurveControl() {
    if (!this.curveFolder) return

    const eqs = ['none', ...Object.keys(transformers)]

    this.curveFolder
      .add(this.params.curve, 'equation', eqs)
      .name('Equation')
      .listen()
      .onChange(this.handlers.curve)

    this.curveFolder
      .add(this.params.curve, 'threshold', 0, 1, 0.01)
      .name('Threshold')
      .listen()
      .onChange(this.handlers.curve)

    this.curvePartsFolder = this.curveFolder.addFolder('Select Parts')

    for (const part in this.params.curve.parts) {
      this.curvePartsFolder
        .add(this.params.curve.parts, part)
        .listen()
        .onChange(this.handlers.curve)
    }

    this.curveAxisFolder = this.curveFolder?.addFolder('Select Axis')

    for (const axis of ['x', 'y', 'z']) {
      this.curveAxisFolder
        .add(this.params.curve.axes, axis)
        .listen()
        .onChange(this.handlers.curve)
    }
  }

  addSpaceControl() {
    if (!this.spaceFolder) return

    this.spaceFolder
      .add(this.params.space, 'delay', 0, 3, 0.001)
      .name('Delay Per Valley (s)')
      .listen()
      .onChange(this.handlers.space)

    this.spaceFolder
      .add(this.params.space, 'threshold', 0, 1, 0.001)
      .name('Threshold')
      .listen()
      .onChange(this.handlers.space)

    this.spaceFolder
      .add(this.params.space, 'minWindow', 1, 4, 1)
      .listen()
      .name('Minimum Window')
      .onChange(this.handlers.space)

    this.spaceFolder
      .add(this.params.space, 'windowSize', 1, 120, 1)
      .name('Window Size')
      .listen()
      .onChange(this.handlers.space)
  }

  createPanel() {
    this.panel.hide()

    const panel = this.panel

    this.playbackFolder = panel.addFolder('Playback Settings')
    this.commandFolder = panel.addFolder('Commands')
    this.rotationFolder = panel.addFolder('All Rotations')
    this.energyFolder = panel.addFolder('Energy')
    this.delayFolder = panel.addFolder('Shifting / Synchronic')
    this.curveFolder = panel.addFolder('Circle and Curve')
    this.spaceFolder = panel.addFolder('External Body Space')
    this.axisPointFolder = panel.addFolder('Axis Point')
    this.characterFolder = panel.addFolder('Characters')

    this.addRotations()
    this.addEnergy('head', 'body', 'foot')
    this.addDelay('leftArm', 'rightArm', 'leftLeg', 'rightLeg')

    this.commandFolder
      .add({ reset: this.reset.bind(this) }, 'reset')
      .name('Reset')
      .listen()

    this.commandFolder
      .add({ voice: this.triggerVoice.bind(this) }, 'voice')
      .name('Voice')
      .listen()

    this.commandFolder
      .add({ setKey: this.triggerPrompt.bind(this) }, 'setKey')
      .name('Prompt')
      .listen()

    this.playbackFolder
      .add(this.params, 'timescale', 0, 5, 0.01)
      .name('Animation Speed')
      .listen()
      .onChange(this.handlers.timescale)

    this.playbackFolder
      .add(this.params, 'time', 0, 100, 0.001)
      .name('Seek')
      .listen()
      .onChange(this.handlers.seek)

    this.playbackFolder
      .add(this.params, 'paused')
      .name('Paused')
      .listen()
      .onChange(this.handlers.pause)

    this.playbackFolder
      .add(this.params, 'lockPosition')
      .name('Lock Position')
      .listen()
      .onChange(this.handlers.lockPosition)

    this.playbackFolder
      .add(this.params, 'showGraph')
      .name('Graph Visible?')
      .listen()
      .onChange(this.handlers.showGraph)

    this.playbackFolder
      .add(this.params, 'camera', Object.keys(CAMERA_PRESETS))
      .name('Camera Angle')
      .listen()
      .onChange(this.handlers.setCamera)

    for (const key in this.params.characters) {
      const folder = this.characterFolder.addFolder(`Character: ${key}`)

      this.addCharacterControl(folder, key as CharacterKey)
    }

    this.addCurveControl()
    this.addSpaceControl()
    this.addAxisPointControl()

    this.panel.hide()

    // this.commandFolder.open()
    // this.rotationFolder.open()
    // this.energyFolder.open()
    // this.delayFolder.open()
    // this.characterFolder.open()
  }

  addAxisPointControl() {
    if (!this.axisPointFolder) return

    this.axisPointFolder
      .add(this.params.axisPoint, 'threshold', 0, 10, 0.001)
      .listen()
      .onChange(this.handlers.axisPoint)

    for (const part of Object.keys(axisPointControlParts)) {
      this.axisPointFolder
        ?.add(this.params.axisPoint.parts, part)
        .listen()
        .onChange(this.handlers.axisPoint)
    }
  }

  updateKey() {
    const key = prompt('Set API Key', localStorage.getItem('OPENAI_KEY') ?? '')
    if (!key) return

    localStorage.setItem('OPENAI_KEY', key)
  }

  get hasKey() {
    const key = localStorage.getItem('OPENAI_KEY')
    if (key === 'null') return false

    return !!key
  }

  triggerVoice() {
    if (!this.hasKey) {
      this.updateKey()
      return
    }

    this.handlers.voice.call(this)
  }

  triggerPrompt() {
    if (!this.hasKey) {
      this.updateKey()
      return
    }

    const command = prompt('User Command')
    if (!command) return

    this.handlers.prompt.bind(this)(command)
  }

  reset() {
    this.panel.reset()
    this.handlers.reset()
  }
}

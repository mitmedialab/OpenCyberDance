import GUI from 'lil-gui'

import { CAMERA_PRESETS } from './camera'
import { Character, CharacterKey } from './character'
import { Params } from './overrides'
import { axisPointControlParts, DelayPartKey, EnergyPartKey } from './parts'
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
  startPostures(): void
  stopPostures(): void
  postureDebug(): void
}

const createGUI = () => {
  const gui = new GUI({ width: 310 })
  gui.hide()

  return gui
}

export class Panel {
  initialized = false

  params: Params
  panel = createGUI()

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
  postureDebugFolder: GUI | null = null

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
    startPostures: () => {},
    stopPostures: () => {},
    postureDebug: () => {},
  }

  constructor(params: Params) {
    this.params = params
  }

  addEnergy(...parts: EnergyPartKey[]) {
    for (const part of parts) {
      this.energyFolder
        ?.add(this.params.energy, part, 0, 3, 0.001)
        .listen()
        .onChange(this.handlers.energy)
    }
  }

  addDelay(...parts: DelayPartKey[]) {
    for (const part of parts) {
      this.delayFolder
        ?.add(this.params.delays, part, 0, 100, 0.01)
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
      .add(this.params.space, 'delay', 0, 5, 0.001)
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
      .add(this.params.space, 'windowSize', 1, 1000, 1)
      .name('Window Size')
      .listen()
      .onChange(this.handlers.space)
  }

  createPanel() {
    if (this.initialized) return

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
    this.postureDebugFolder = panel.addFolder('🔧 Posture Debug')

    this.addRotations()
    this.addEnergy('upper', 'lower')
    this.addDelay('left', 'right', 'body')

    this.commandFolder
      .add({ reset: this.reset.bind(this) }, 'reset')
      .name('Reset')
      .listen()

    // this.commandFolder
    //   .add({ voice: this.triggerVoice.bind(this) }, 'voice')
    //   .name('Voice')
    //   .listen()

    // this.commandFolder
    //   .add({ setKey: this.triggerPrompt.bind(this) }, 'setKey')
    //   .name('Prompt')
    //   .listen()

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
    this.addPostureDebugControl()

    // this.commandFolder.open()
    // this.rotationFolder.open()
    // this.energyFolder.open()
    // this.delayFolder.open()
    // this.characterFolder.open()

    this.initialized = true
  }

  addAxisPointControl() {
    if (!this.axisPointFolder) return

    // Add posture controls
    this.axisPointFolder
      .add({ startPostures: this.startPostures.bind(this) }, 'startPostures')
      .name('🎯 Start Postures')

    this.axisPointFolder
      .add({ stopPostures: this.stopPostures.bind(this) }, 'stopPostures')
      .name('🛑 Stop Postures')

    // Original axis point controls
    this.axisPointFolder
      .add(this.params.axisPoint, 'frequency', 0, 1, 0.001)
      .listen()
      .onChange(this.handlers.axisPoint)
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

  startPostures() {
    this.handlers.startPostures()
    console.log(`>>> panel::startPostures`)
  }

  stopPostures() {
    this.handlers.stopPostures()
    console.log(`>>> panel::stopPostures`)
  }

  addPostureDebugControl() {
    if (!this.postureDebugFolder) return

    // Enable/disable debug mode
    this.postureDebugFolder
      .add(this.params.postureDebug, 'enabled')
      .name('🔧 Enable Debug Mode')
      .listen()
      .onChange(this.handlers.postureDebug)

    // Left Arm Controls
    const leftArmFolder = this.postureDebugFolder.addFolder('👈 Left Arm')

    // Left Upperarm
    const leftUpperarmFolder = leftArmFolder.addFolder('Upper Arm')
    leftUpperarmFolder
      .add(
        this.params.postureDebug.leftArm.upperarm,
        'x',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('X Rotation (forward/back)')
      .listen()
      .onChange(this.handlers.postureDebug)
    leftUpperarmFolder
      .add(
        this.params.postureDebug.leftArm.upperarm,
        'y',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Y Rotation (up/down)')
      .listen()
      .onChange(this.handlers.postureDebug)
    leftUpperarmFolder
      .add(
        this.params.postureDebug.leftArm.upperarm,
        'z',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Z Rotation (left/right)')
      .listen()
      .onChange(this.handlers.postureDebug)

    // Left Forearm
    const leftForearmFolder = leftArmFolder.addFolder('Forearm')
    leftForearmFolder
      .add(
        this.params.postureDebug.leftArm.forearm,
        'x',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('X Rotation (forward/back)')
      .listen()
      .onChange(this.handlers.postureDebug)
    leftForearmFolder
      .add(
        this.params.postureDebug.leftArm.forearm,
        'y',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Y Rotation (up/down)')
      .listen()
      .onChange(this.handlers.postureDebug)
    leftForearmFolder
      .add(
        this.params.postureDebug.leftArm.forearm,
        'z',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Z Rotation (left/right)')
      .listen()
      .onChange(this.handlers.postureDebug)

    // Left Hand
    const leftHandFolder = leftArmFolder.addFolder('Hand')
    leftHandFolder
      .add(
        this.params.postureDebug.leftArm.hand,
        'x',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('X Rotation (forward/back)')
      .listen()
      .onChange(this.handlers.postureDebug)
    leftHandFolder
      .add(
        this.params.postureDebug.leftArm.hand,
        'y',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Y Rotation (up/down)')
      .listen()
      .onChange(this.handlers.postureDebug)
    leftHandFolder
      .add(
        this.params.postureDebug.leftArm.hand,
        'z',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Z Rotation (left/right)')
      .listen()
      .onChange(this.handlers.postureDebug)

    // Right Arm Controls
    const rightArmFolder = this.postureDebugFolder.addFolder('👉 Right Arm')

    // Right Upperarm
    const rightUpperarmFolder = rightArmFolder.addFolder('Upper Arm')
    rightUpperarmFolder
      .add(
        this.params.postureDebug.rightArm.upperarm,
        'x',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('X Rotation (forward/back)')
      .listen()
      .onChange(this.handlers.postureDebug)
    rightUpperarmFolder
      .add(
        this.params.postureDebug.rightArm.upperarm,
        'y',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Y Rotation (up/down)')
      .listen()
      .onChange(this.handlers.postureDebug)
    rightUpperarmFolder
      .add(
        this.params.postureDebug.rightArm.upperarm,
        'z',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Z Rotation (left/right)')
      .listen()
      .onChange(this.handlers.postureDebug)

    // Right Forearm
    const rightForearmFolder = rightArmFolder.addFolder('Forearm')
    rightForearmFolder
      .add(
        this.params.postureDebug.rightArm.forearm,
        'x',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('X Rotation (forward/back)')
      .listen()
      .onChange(this.handlers.postureDebug)
    rightForearmFolder
      .add(
        this.params.postureDebug.rightArm.forearm,
        'y',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Y Rotation (up/down)')
      .listen()
      .onChange(this.handlers.postureDebug)
    rightForearmFolder
      .add(
        this.params.postureDebug.rightArm.forearm,
        'z',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Z Rotation (left/right)')
      .listen()
      .onChange(this.handlers.postureDebug)

    // Right Hand
    const rightHandFolder = rightArmFolder.addFolder('Hand')
    rightHandFolder
      .add(
        this.params.postureDebug.rightArm.hand,
        'x',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('X Rotation (forward/back)')
      .listen()
      .onChange(this.handlers.postureDebug)
    rightHandFolder
      .add(
        this.params.postureDebug.rightArm.hand,
        'y',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Y Rotation (up/down)')
      .listen()
      .onChange(this.handlers.postureDebug)
    rightHandFolder
      .add(
        this.params.postureDebug.rightArm.hand,
        'z',
        -Math.PI * 2,
        Math.PI * 2,
        0.01,
      )
      .name('Z Rotation (left/right)')
      .listen()
      .onChange(this.handlers.postureDebug)

    // Head Controls
    const headFolder = this.postureDebugFolder.addFolder('🗣️ Head')
    headFolder
      .add(
        this.params.postureDebug.head,
        'x',
        -Math.PI / 4,
        Math.PI / 4,
        0.01,
      )
      .name('X Rotation (nod up/down)')
      .listen()
      .onChange(this.handlers.postureDebug)
    headFolder
      .add(
        this.params.postureDebug.head,
        'y',
        -Math.PI / 4,
        Math.PI / 4,
        0.01,
      )
      .name('Y Rotation (turn left/right)')
      .listen()
      .onChange(this.handlers.postureDebug)
    headFolder
      .add(
        this.params.postureDebug.head,
        'z',
        -Math.PI / 4,
        Math.PI / 4,
        0.01,
      )
      .name('Z Rotation (tilt left/right)')
      .listen()
      .onChange(this.handlers.postureDebug)

    // Helper buttons
    this.postureDebugFolder
      .add({ reset: () => this.resetPostureDebug() }, 'reset')
      .name('🔄 Reset All Rotations')

    console.log('Added posture debug controls')
  }

  resetPostureDebug() {
    // Reset all debug rotations to zero
    this.params.postureDebug.leftArm.upperarm = { x: 0, y: 0, z: 0 }
    this.params.postureDebug.leftArm.forearm = { x: 0, y: 0, z: 0 }
    this.params.postureDebug.leftArm.hand = { x: 0, y: 0, z: 0 }
    this.params.postureDebug.rightArm.upperarm = { x: 0, y: 0, z: 0 }
    this.params.postureDebug.rightArm.forearm = { x: 0, y: 0, z: 0 }
    this.params.postureDebug.rightArm.hand = { x: 0, y: 0, z: 0 }
    this.params.postureDebug.head = { x: 0, y: 0, z: 0 }

    this.handlers.postureDebug()
    console.log('Reset all posture debug rotations')
  }

  reset() {
    this.panel.reset()
    this.handlers.reset()

    console.log(`>>> panel::reset`)
  }
}

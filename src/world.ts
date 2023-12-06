import GUI, { Controller as GUIController } from 'lil-gui'
import { Clock, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import Stats from 'three/examples/jsm/libs/stats.module'

import { CAMERA_PRESETS, CameraPresetKey } from './camera'
import {
  Character,
  CharacterKey,
  CharacterOptions,
  UpdateParamFlags,
} from './character'
import { Params } from './overrides'
import { Panel } from './panel'
import { profile } from './perf'
import { Plotter } from './plotter'
import {
  formulaRanges,
  Transform,
  TransformKey,
  TransformOptions,
} from './transforms'
import { Matcher } from './types'
import { debounce } from './utils'
import { VoiceController } from './voice'

declare global {
  interface Window {
    world: World
  }
}

export class World {
  clock = new Clock()
  scene = new Scene()
  renderer = new WebGLRenderer({ antialias: true })
  stats = new Stats()
  plotter = new Plotter(this)
  container = document.getElementById('app')
  params = new Params()
  panel = new Panel(this.params)
  voice = new VoiceController(this)
  characters: Character[] = []
  camera: PerspectiveCamera | null = null
  controls: OrbitControls | null = null

  get first() {
    return this.characterByName('first')
  }

  get trackNames() {
    return this.first?.currentClip?.tracks.map((t) => t.name)
  }

  transform(
    transform: TransformKey | Transform | 'none',
    options: TransformOptions & { tracks: Matcher | Matcher[] },
  ) {
    this.first?.transform(transform, options)
    this.updatePlotterOnPause()
  }

  async setup() {
    // Setup background
    this.scene.background = new THREE.Color(0xdedede)
    this.scene.fog = new THREE.Fog(0xdedede, 10, 50)

    // Setup the scenes
    this.setupLights()
    this.setupPlane()
    this.setupRenderer()
    this.setupCamera()
    this.setupControls()
    this.setupPanel()
    await this.setupCharacters()

    this.addResizeHandler()
    this.addSeekBarUpdater()
    this.handleCurveFormulaChange()

    // Setup elements
    this.container?.appendChild(this.renderer.domElement)
    this.container?.appendChild(this.stats.dom)

    if (this.plotter.domElement) {
      this.container?.appendChild(this.plotter.domElement)
    }

    window.world = this
  }

  // Update the time in the seek bar
  addSeekBarUpdater() {
    setInterval(() => {
      if (this.params.paused || !this.first) return

      this.params.time = Math.round((this.first?.mixer?.time ?? 1) * 100) / 100
    }, 1000)
  }

  render() {
    requestAnimationFrame(this.render.bind(this))

    // Update animation mixers for each character
    if (!this.params.paused) {
      const delta = this.clock.getDelta()

      for (const c of this.characters) {
        c.mixer?.update(delta)
        c.ik?.update()

        if (c.ik) window.ik = c.ik
      }
    }

    this.stats.update()

    if (this.camera) {
      this.renderer.render(this.scene, this.camera)
    }
  }

  setupLights() {
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0xfefefe, 4)
    hemiLight.position.set(0, 20, 0)
    this.scene.add(hemiLight)

    const dLight = new THREE.DirectionalLight(0xffffff, 4)
    dLight.position.set(3, 10, 10)
    dLight.castShadow = true
    dLight.shadow.camera.top = 2
    dLight.shadow.camera.bottom = -2
    dLight.shadow.camera.left = -2
    dLight.shadow.camera.right = 2
    dLight.shadow.camera.near = 0.1
    dLight.shadow.camera.far = 40
    this.scene.add(dLight)
  }

  setupPlane() {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(100, 100),
      new THREE.MeshPhongMaterial({ color: 0xcbcbcb, depthWrite: false }),
    )

    plane.rotation.x = -Math.PI / 2
    plane.receiveShadow = true
    this.scene.add(plane)
  }

  setupRenderer() {
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 2
  }

  setupCamera() {
    const aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 100)
    this.setCamera()
  }

  setupControls() {
    if (!this.camera) return

    const controls = new OrbitControls(this.camera, this.renderer.domElement)
    controls.enablePan = true
    controls.enableZoom = true
    controls.target.set(0, 1, 0)
    controls.update()
    this.controls = controls
  }

  addResizeHandler() {
    window.addEventListener('resize', () => {
      if (!this.camera) return

      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()

      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }

  characterByName(name: string): Character | null {
    return this.characters.find((c) => c.options.name === name) ?? null
  }

  updateParams(flags?: UpdateParamFlags) {
    const b = profile('updateParams', 100)

    b(() => {
      if (flags?.curve) this.handleCurveFormulaChange()

      for (const character of this.characters) {
        character.updateParams(flags)
      }
    })
  }

  async addCharacter(config: Partial<CharacterOptions>) {
    const character = new Character(config)
    character.handlers.animationLoaded = this.handleAnimationChange.bind(this)

    await character.setup(this.scene, this.params)
    this.characters.push(character)
  }

  handleAnimationChange(char: Character) {
    if (!this.panel.characterFolder) return

    const { name, action } = char.options

    const dropdown = this.panel.characterFolder?.children
      // @ts-expect-error - character is a custom property
      ?.find((k) => k.character === name) as GUI

    // Update the dropdown animation's active state
    const controller = dropdown.controllers
      .find((c) => c.property === 'action')
      ?.options([...char.actions.keys()])
      .listen()
      .onChange(() => this.panel.handlers.action(name))

    if (action) {
      this.params.characters[name].action = action
    }

    controller?.updateDisplay()

    if (name === 'first') {
      const seek = this.panel.playbackFolder?.children.find(
        (c) => 'property' in c && c.property === 'time',
      ) as GUIController

      if (!action) return

      const currentAction = char.actions.get(action)
      if (!currentAction || !seek) return

      const { duration } = currentAction.getClip()
      if (duration) seek.max(Math.round(duration * 100) / 100)
    }
  }

  handleCurveFormulaChange() {
    const { axis = [], tracks = [] } = this.first?.curveConfig ?? {}

    this.plotter.axes = axis
    this.plotter.select(...tracks)

    const dropdown = this.panel.curveFolder?.children.find(
      (c) => 'property' in c && c.property === 'threshold',
    ) as GUIController

    if (!dropdown) return

    const { equation } = this.params.curve

    if (equation !== 'none') {
      const range = formulaRanges[equation]

      const [fMin, fMax, fStep, fInitial] = range
      dropdown.min(fMin)
      dropdown.max(fMax)
      dropdown.step(fStep)
      dropdown.initialValue = fInitial

      const current = dropdown.getValue()

      if (current < fMin || current > fMax) {
        dropdown.setValue(fInitial)
      }
    }

    dropdown.updateDisplay()
  }

  async setupCharacters() {
    await this.addCharacter({
      name: 'first',
      model: 'abstract',
      position: [-0.8, 0, 0],
    })

    await this.addCharacter({
      name: 'second',
      model: 'abstract',
      position: [0.8, 0, 0],
      freezeParams: true,
    })
  }

  setupPanel() {
    // Delay, energy and external body space all affects the timing.
    this.panel.handlers.delay = debounce(() => this.updateParams(), 100)
    this.panel.handlers.energy = debounce(() => this.updateParams(), 100)
    this.panel.handlers.space = debounce(() => this.updateParams(), 500)

    this.panel.handlers.lockPosition = (lock: boolean) => {
      this.updateParams({ lockPosition: lock })
    }

    this.panel.handlers.curve = debounce(() => {
      this.updateParams({ curve: true })
    }, 500)

    this.panel.handlers.rotation = debounce(() => {
      this.updateParams({ rotation: true })
    }, 100)

    this.panel.handlers.timescale = (timescale) => {
      for (const character of this.characters) {
        if (!character.mixer) continue

        character.mixer.timeScale = timescale
      }
    }

    this.panel.handlers.setCamera = this.setCamera.bind(this)

    this.panel.handlers.character = async (name: CharacterKey) => {
      const char = this.characterByName(name)
      if (!char) return

      await char.reset()

      // Sync animation timing with a peer.
      const peer = this.characters.find((c) => c.options.name !== name)
      if (peer?.mixer && char.mixer) char.mixer.setTime(peer.mixer.time)
    }

    this.panel.handlers.action = (name: CharacterKey) => {
      const action = this.params.characters[name].action
      const character = this.characterByName(name)
      if (!character || !action) return

      character.playByName(action)
    }

    this.panel.handlers.voice = () => {
      this.voice.toggle()
    }

    this.panel.handlers.showGraph = (visible) => {
      this.plotter.updateVisibility(visible)
    }

    this.panel.handlers.seek = (time) => {
      this.characters.forEach((c) => c.mixer?.setTime(time))
      this.updatePlotterOnPause()
    }

    this.panel.handlers.pause = (paused) => {
      paused ? this.clock.stop() : this.clock.start()
    }

    this.panel.handlers.prompt = (input: string) => {
      this.voice.execute(input)
    }

    this.panel.createPanel()
  }

  // If we are paused and seeking, update the plotter.
  updatePlotterOnPause = debounce(() => {
    if (!this.params.paused) return

    this.characters.forEach((c) => this.plotter?.update(c, { seeking: true }))
  }, 200)

  /** Queries the track id by name or regex. */
  query(...query: Matcher[]): number[] {
    return this.first?.query(...query) ?? []
  }

  setCamera(presetKey: CameraPresetKey = 'front') {
    const preset = CAMERA_PRESETS[presetKey]
    if (!preset) return

    this.camera?.rotation.set(...preset.rotation)
    this.camera?.position.set(...preset.position)

    if (this.controls) this.controls.update()
  }
}

import GUI, { Controller as GUIController } from 'lil-gui'
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
} from 'postprocessing'
import {
  Clock,
  DirectionalLight,
  Object3D,
  OrthographicCamera,
  Scene,
  SpotLight,
  WebGLRenderer,
} from 'three'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
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
import { changeAction, changeCharacter } from './switch-dance.ts'
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

  renderer = new WebGLRenderer({
    powerPreference: 'high-performance',
    antialias: true,
    // antialias: false,
    // stencil: false,
    // depth: false,
  })

  stats = new Stats()
  plotter = new Plotter(this)
  params = new Params()
  panel = new Panel(this.params)
  voice = new VoiceController(this)
  characters: Character[] = []
  camera: OrthographicCamera | null = null
  controls: OrbitControls | null = null

  composer: EffectComposer | null = null

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
    this.scene.background = new THREE.Color(0x000)
    this.scene.fog = new THREE.Fog(0x111, 10, 50)

    // Setup the scenes
    this.setupCamera()
    this.setupLights()
    this.setupPlane()
    this.setupRenderer()
    this.setupControls()
    this.setupPanel()
    await this.setupCharacters()
    // this.setupComposer()

    this.addResizeHandler()
    this.addSeekBarUpdater()
    this.handleCurveFormulaChange()

    this.updateParams({ lockPosition: true })

    window.world = this
  }

  setupComposer() {
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera!))
    this.composer.addPass(new EffectPass(this.camera!, new BloomEffect()))
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

      for (const char of this.characters) {
        char.mixer?.update(delta)
        char.ik?.update(char.mixer?.time ?? 0)
      }
    }

    this.stats.update()

    if (this.camera) {
      this.renderer.render(this.scene, this.camera)
      // this.composer.render()
    }
  }

  addDebugTransformControl(object: Object3D) {
    const transformControls = new TransformControls(
      this.camera!,
      this.renderer.domElement,
    )

    transformControls.size = 0.75
    transformControls.showX = false
    transformControls.space = 'world'

    transformControls.addEventListener('mouseDown', () => {
      if (!this.controls) return

      this.controls.enabled = false
    })

    transformControls.addEventListener('mouseUp', () => {
      if (!this.controls) return

      this.controls.enabled = true
    })

    transformControls.attach(object)
    this.scene.add(transformControls)

    return transformControls
  }

  setupLights() {
    const backLight = new DirectionalLight(0xffffff, 14)
    backLight.name = 'BackLight'
    backLight.position.set(0, 0.2656135779782386, -0.6114542855111087)
    // this.addDebugTransformControl(backLight)
    this.scene.add(backLight)

    const frontLight = new DirectionalLight(0xffffff, 10)
    frontLight.name = 'FrontLight'
    // frontLight.position.set(0, 1.642723902041498, 2.6697376383189537)
    // this.addDebugTransformControl(frontLight)
    this.scene.add(frontLight)

    const spotlight = new SpotLight(0xffffff)
    spotlight.name = 'FeetSpotLight'
    // spotlight.position.set(0, -0.3010949937431652, 1.094794209438712)
    // spotlight.position.set(0, -0.646030735901475, 1.0085196631323525)
    spotlight.position.set(0, -0.21285007787665805, 1.9899367846311686)
    spotlight.angle = 0.7853981633974483
    spotlight.penumbra = 0.1
    spotlight.decay = 0
    spotlight.distance = 100
    // this.addDebugTransformControl(spotlight)
    this.scene.add(spotlight)
  }

  setupPlane() {
    // const plane = new THREE.Mesh(
    //   new THREE.PlaneGeometry(1000, 1000),
    //   new THREE.MeshPhongMaterial({ color: 0xfff, depthWrite: false }),
    // )
    // plane.rotation.x = -Math.PI / 2
    // plane.receiveShadow = true
    // this.scene.add(plane)
  }

  setupRenderer() {
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 10
  }

  getCameraFrustum() {
    const width = window.innerWidth
    const height = window.innerHeight
    const aspect = width / height

    const viewerFrustumSize = 0.35
    const aspectFrustum = aspect * viewerFrustumSize

    const left = -aspectFrustum
    const right = aspectFrustum
    const top = viewerFrustumSize
    const bottom = -viewerFrustumSize

    return { left, right, top, bottom }
  }

  setupCamera() {
    const { left, right, top, bottom } = this.getCameraFrustum()
    this.camera = new OrthographicCamera(left, right, top, bottom, 0.01, 2000)

    this.setCamera('front')
  }

  setupControls() {
    if (!this.camera) return

    const controls = new OrbitControls(this.camera, this.renderer.domElement)
    controls.enablePan = true
    controls.enableZoom = true
    controls.target.set(0, 0, 0)
    controls.update()
    this.controls = controls
  }

  addResizeHandler() {
    window.addEventListener('resize', () => {
      if (!this.camera) return

      const { left, right, top, bottom } = this.getCameraFrustum()
      this.camera.left = left
      this.camera.right = right
      this.camera.top = top
      this.camera.bottom = bottom

      this.camera.updateProjectionMatrix()

      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }

  characterByName(name: string): Character | null {
    return this.characters.find((c) => c.options.name === name) ?? null
  }

  updateParams(flags?: UpdateParamFlags) {
    const b = profile('updateParams', 10)

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
      position: [0, 0, 0],
    })

    // await this.addCharacter({
    //   name: 'second',
    //   position: [0.8, 0, 0],
    //   freezeParams: true,
    // })
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

    this.panel.handlers.axisPoint = debounce(() => {
      this.updateParams({ axisPoint: true })
    }, 100)

    this.panel.handlers.timescale = (timescale) => {
      for (const character of this.characters) {
        if (!character.mixer) continue

        character.mixer.timeScale = timescale
      }
    }

    this.panel.handlers.setCamera = this.setCamera.bind(this)

    this.panel.handlers.character = async (name: CharacterKey) => {
      await changeCharacter(name)
    }

    this.panel.handlers.action = (name: CharacterKey) => {
      changeAction(name)
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

    this.panel.handlers.prompt = (input: string) => {}

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
    if (!this.camera) return

    const preset = CAMERA_PRESETS[presetKey]
    if (!preset) return

    this.camera.zoom = 0.45
    this.camera.rotation.set(...preset.rotation)
    this.camera.position.set(...preset.position)
    this.camera.updateProjectionMatrix()

    if (this.controls) this.controls.update()
  }
}

export const world = new World()

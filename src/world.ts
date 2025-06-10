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
  INITIAL_MODEL,
  UpdateParamFlags,
} from './character'
import { soundManager } from './ding.ts'
import { dispose } from './dispose.ts'
import { Params } from './overrides'
import { Panel } from './panel'
import { profile } from './perf'
import { preloader } from './preloader.ts'
import { updateDebugLogCamera } from './store/debug'
import { $currentScene, $isWhiteScene } from './store/scene.ts'
import { changeAction, changeCharacter } from './switch-dance.ts'
import { formulaRanges } from './transforms'
import { Matcher } from './types'
import { debounce, delay } from './utils'
import { VoiceController } from './voice'

export const ENDING_SPEED = 0.2
const CAMERA_NEAR = 0.1
const CAMERA_FAR = 2000

// close to 0.0 = near, close to 1.0 = exactly centered
const CAMERA_FRUSTUM_SIZE = 0.7

declare global {
  interface Window {
    world: World
  }
}

export class World {
  clock = new Clock()
  scene = new Scene()

  ready = false

  accumulatedTime = 0

  renderer = new WebGLRenderer({
    powerPreference: 'high-performance',
    antialias: true,
    alpha: true,
    // antialias: false,
    // stencil: false,
    // depth: false,
  })

  stats = new Stats()
  // plotter = new Plotter(this)
  params = new Params()
  panel = new Panel(this.params)
  voice = new VoiceController(this)
  characters: Character[] = []
  camera: OrthographicCamera | null = null
  controls: OrbitControls | null = null
  composer: EffectComposer | null = null

  frontLight: DirectionalLight | null = null
  backLight: DirectionalLight | null = null

  timers = { seekBar: 0 }

  flags = {
    waitingEndingStart: false,
    shadowCharacters: false,
    dissolveCharacters: false,
  }

  get first() {
    return this.characterByName('first')
  }

  get trackNames() {
    return this.first?.currentClip?.tracks.map((t) => t.name)
  }

  setBackground(mode: 'white' | 'black') {
    const body = document.querySelector('body')
    if (!body) return

    if (mode === 'white') {
      document.documentElement.classList.remove('dark')
      this.scene.fog = new THREE.Fog(0x111, 10, 50)

      return
    }

    if (mode === 'black') {
      document.documentElement.classList.add('dark')
      this.scene.fog = new THREE.Fog(0x111, 10, 50)

      return
    }
  }

  get isEnding() {
    return $currentScene.get() === 'ENDING'
  }

  syncBackground() {
    this.setBackground('black')
  }

  async setup() {
    if (this.ready) return

    const isEnding = this.isEnding

    soundManager.setup()

    if (this.panel) this.panel.panel.hide()

    // Ensure background color is in sync
    this.syncBackground()

    // Setup the scenes
    this.setupCamera()
    await this.setCamera(isEnding ? 'endingFront' : 'front')

    this.setupLights()
    this.setupPlane()
    this.setupRenderer()
    this.setupPanel()
    await this.setupCharacters()

    this.addResizeHandler()
    this.addSeekBarUpdater()
    this.handleCurveFormulaChange()
    this.handleAnimationChange(this.first!)

    // Sync every character's parameters.
    this.updateParams()

    // Prepare lookup tables to speed up processing time.
    this.warmupCharacterCache()

    // Transition in ending scene
    this.transitionInEndingScene()

    window.world = this
    this.ready = true
  }

  async transitionInEndingScene() {
    if (!this.isEnding) return

    this.setTime(2.5)
    this.setSpeed(ENDING_SPEED)

    await delay(1000)
  }

  setSpeed(speed: number) {
    world.params.timescale = speed

    this.characters.map((character) => {
      if (!character.mixer) return

      character.mixer.timeScale = speed
    })
  }

  warmupCharacterCache() {
    const p = profile('warmup character cache', 1)

    p(() => {
      for (const character of this.characters) {
        character.prepareExternalBodySpaceCache()
      }
    })
  }

  setupComposer() {
    this.composer = new EffectComposer(this.renderer)
    this.composer.addPass(new RenderPass(this.scene, this.camera!))
    this.composer.addPass(new EffectPass(this.camera!, new BloomEffect()))
  }

  // Update the time in the seek bar
  addSeekBarUpdater() {
    this.timers.seekBar = setInterval(() => {
      if (this.params.paused || !this.first) return

      this.params.time = Math.round((this.first?.mixer?.time ?? 1) * 100) / 100
    }, 1000)
  }

  render() {
    // Update animation mixers for each character
    if (!this.params.paused) {
      const delta = this.clock.getDelta()

      for (const char of this.characters) {
        if (!char.mixer) continue

        // tick the animation time
        char.tickRender(delta)
      }
    }

    this.stats.update()

    if (this.camera) {
      this.renderer.render(this.scene, this.camera)
    }

    requestAnimationFrame(this.render.bind(this))
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
    const backLight = new DirectionalLight(0xffffff, 10)
    backLight.name = 'BackLight'
    backLight.position.set(0, 0.2656135779782386, -0.6114542855111087)
    this.scene.add(backLight)

    const frontLight = new DirectionalLight(0xffffff, 0.5)
    frontLight.position.set(0, -0.21285007787665805, 1.9899367846311686)
    frontLight.name = 'FrontLight'
    this.scene.add(frontLight)

    this.frontLight = frontLight
    this.backLight = backLight
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
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 10
  }

  getCameraFrustum(frustumSize = CAMERA_FRUSTUM_SIZE) {
    const width = window.innerWidth
    const height = window.innerHeight
    const aspectRatio = width / height

    const left = (-frustumSize * aspectRatio) / 2
    const right = (frustumSize * aspectRatio) / 2
    const top = frustumSize / 2
    const bottom = -frustumSize / 2

    return { left, right, top, bottom }
  }

  setupCamera() {
    const { left, right, top, bottom } = this.getCameraFrustum()

    this.camera = new OrthographicCamera(
      left,
      right,
      top,
      bottom,
      CAMERA_NEAR,
      CAMERA_FAR,
    )
  }

  setupControls() {
    if (!this.camera) return

    // Dispose existing controls
    if (this.controls) this.controls.dispose()

    const controls = new OrbitControls(this.camera, this.renderer.domElement)
    controls.enablePan = true
    controls.enableZoom = true
    controls.target.set(0, 0, 0)
    controls.update()

    controls.addEventListener('change', () => {
      updateDebugLogCamera(this.camera!)
    })

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
    const p = profile('update char params', 10)

    p(() => {
      if (flags?.curve) this.handleCurveFormulaChange()

      for (const character of this.characters) {
        character.updateParams(flags)
      }
    })
  }

  async addCharacter(config: Partial<CharacterOptions>) {
    const character = new Character(config)
    character.handlers.animationLoaded = this.handleAnimationChange.bind(this)
    character.handlers.setCameraAngle = this.setCamera.bind(this)

    character.handlers.fade = async (mode) => {
      if (mode === 'in') await world.fadeIn()
      if (mode === 'out') await world.fadeOut()
    }

    await character.setup(this.scene, this.params)
    this.characters.push(character)
  }

  handleAnimationChange(char: Character) {
    if (!this.panel.characterFolder) return

    const { name, action } = char.options

    const dropdown = this.panel.characterFolder?.children
      // @ts-expect-error - character is a custom property
      ?.find((k) => k.character === name) as GUI

    if (!dropdown) return

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

      if (duration) {
        const seekDuration = Math.round(duration * 100) / 100
        seek.max(seekDuration)
        seek.updateDisplay()
      }
    }
  }

  handleCurveFormulaChange() {
    // const { axis = [], tracks = [] } = this.first?.curveConfig ?? {}

    // this.plotter.axes = axis
    // this.plotter.select(...tracks)

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
    const scene = $currentScene.get()

    // Character in waiting mode
    if (scene === 'BLACK') {
      await this.addCharacter({
        name: 'first',
        position: [0, 0, 0],
        model: 'waiting',
      })

      return
    }

    // Add two characters
    if (scene === 'ENDING') {
      // padung ---------- terry | changhung | tas
      await Promise.all([
        this.addCharacter({
          name: 'first',
          position: [0, 0, 0],
          model: 'padungLast',
        }),

        this.addCharacter({
          name: 'second',
          position: [0, 0, 0],
          model: 'terryLast',
        }),

        this.addCharacter({
          name: 'third',
          position: [0, 0, 0],
          model: 'changhungLast',
        }),

        this.addCharacter({
          name: 'fourth',
          position: [0, 0, 0],
          model: 'tasLast',
        }),
      ])

      this.params.characters.first = {
        model: 'padungLast',
        action: '',
      }

      this.params.characters.second = {
        model: 'terryLast',
        action: '',
      }

      if (!this.params.characters.third) {
        this.params.characters.third = {
          model: 'changhungLast',
          action: '',
        }
      }

      if (!this.params.characters.fourth) {
        this.params.characters.fourth = {
          model: 'tasLast',
          action: '',
        }
      }

      return
    }
  }

  setupPanel() {
    // Delay, energy and external body space all affects the timing.
    this.panel.handlers.delay = debounce(() => this.updateParams(), 100)

    this.panel.handlers.energy = debounce(
      () => this.updateParams({ timing: true, withEnergy: true }),
      100,
    )

    this.panel.handlers.space = debounce(() => this.updateParams(), 500)

    this.panel.handlers.lockPosition = () => this.updateParams()

    this.panel.handlers.curve = debounce(() => {
      this.updateParams({ curve: true })
    }, 500)

    this.panel.handlers.rotation = debounce(() => {
      this.updateParams({ rotation: true })
    }, 100)

    this.panel.handlers.axisPoint = debounce(() => {
      this.updateParams({ axisPoint: true })
    }, 100)

    this.panel.handlers.startPostures = () => {
      for (const character of this.characters) {
        character.startPostures()
      }
    }

    this.panel.handlers.stopPostures = () => {
      for (const character of this.characters) {
        character.stopPostures()
      }
    }

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

    this.panel.handlers.showGraph = () => {
      // this.plotter.updateVisibility(visible)
    }

    this.panel.handlers.seek = (time) => {
      this.characters.forEach((c) => c.mixer?.setTime(time))
      // this.updatePlotterOnPause()
    }

    this.panel.handlers.pause = (paused) => {
      paused ? this.clock.stop() : this.clock.start()
    }

    this.panel.handlers.prompt = () => {}

    this.panel.handlers.postureDebug = () => {
      // Trigger posture update when debug parameters change
      for (const character of this.characters) {
        if (character.boneRotation) {
          character.boneRotation.triggerDebugUpdate()
        }
      }
    }

    this.panel.createPanel()
  }

  // If we are paused and seeking, update the plotter.
  // updatePlotterOnPause = debounce(() => {
  //   if (!this.params.paused) return

  //   this.characters.forEach((c) => this.plotter?.update(c, { seeking: true }))
  // }, 200)

  /** Queries the track id by name or regex. */
  query(...query: Matcher[]): number[] {
    return this.first?.query(...query) ?? []
  }

  async setCamera(presetKey: CameraPresetKey = 'front') {
    const preset = CAMERA_PRESETS[presetKey]
    if (!preset || !this.camera) return

    this.camera.zoom = preset.zoom
    this.camera.position.set(...preset.position)
    this.camera.updateProjectionMatrix()

    await delay(0)

    if (!this.camera) return

    this.camera.rotation.set(...preset.rotation)
    this.camera.updateProjectionMatrix()

    updateDebugLogCamera(this.camera)
  }

  teardown() {
    // Clear the seek bar timer
    clearInterval(this.timers.seekBar)

    // Teardown all characters
    for (const character of this.characters) {
      character.teardown()
    }

    // Delete existing characters
    this.characters = []

    this.scene.clear()
    dispose(this.scene)

    this.ready = false
  }

  async fadeOut() {
    const app = document.querySelector('#app')
    if (!app) return

    // fade out scene
    app.classList.remove('fade-in')
    app.classList.add('fade-out')

    // wait until scene is almost faded out, similar to --scene-fade-time
    await delay(500)
  }

  fadeIn() {
    const app = document.querySelector('#app')
    if (!app) return

    // set the proper background now
    this.syncBackground()

    app.classList.remove('fade-out')
    app.classList.add('fade-in')
  }

  setTime(time: number) {
    this.characters.forEach((char) => {
      if (!char || !char.mixer) return

      char.mixer.setTime(time)
    })
  }

  async fadeInBlankScene() {
    // Fade out the current scene.
    await world.fadeOut()

    // Tear down the scene ~ this takes only 1ms.
    world.teardown()

    // Fade in the blank scene.
    await world.fadeIn()
  }

  async fadeInSceneContent() {
    // Fade out the current scene.
    await world.fadeOut()

    // Setup the next scene.
    await world.setup()

    // Fade in the blank scene.
    await world.fadeIn()
  }

  async preload() {
    const initialModel = Character.sources[INITIAL_MODEL]

    // Block on initial model
    await preloader.load(initialModel)

    // Preload the rest asynchronously
    preloader.setup().then()
  }

  async startShadowCharacter() {
    if (this.flags.shadowCharacters) return

    this.flags.shadowCharacters = true

    const backdrop = document.querySelector('.backdrop')
    if (!backdrop) return

    backdrop.classList.remove('backdrop-fade-in')

    Promise.all([this.fadeFrontLights(), this.fadeBackLights()]).then()

    setTimeout(() => {
      this.setBackground('white')
    }, 1000)

    setTimeout(() => {
      $isWhiteScene.set(true)
    }, 6000)

    backdrop.classList.add('backdrop-fade-in')
  }

  async fadeFrontLights() {
    if (!this.frontLight) return

    for (let i = 0; i < 80000; i++) {
      if (this.frontLight.intensity > 0.01) {
        this.frontLight.intensity -= 0.005
      } else break

      await delay(120)
    }

    for (let i = 0; i < 80000; i++) {
      if (this.frontLight.intensity > 0.00001) {
        this.frontLight.intensity -= 0.001
      } else break

      await delay(80)
    }
  }

  async fadeBackLights() {
    if (!this.backLight) return

    for (let i = 0; i < 80000; i++) {
      if (this.backLight.intensity > 0.0001) {
        this.backLight.intensity -= 0.1
      } else {
        this.backLight.intensity = 0
        break
      }

      await delay(80)
    }
  }

  async startDissolveCharacter() {
    if (this.flags.dissolveCharacters) return

    this.flags.dissolveCharacters = true

    const K = 308
    const S = 2

    await Promise.all([
      (async () => {
        for (let i = S; i < K; i++) {
          this.renderer.domElement.style.filter = `blur(${i}px)`

          await delay(4000)
        }
      })(),
      (async () => {
        for (let i = S; i < K; i++) {
          if (i > 80) break

          this.renderer.domElement.style.opacity = `${(
            ((100 - (i + 10)) / 100) *
            100
          ).toFixed(2)}%`

          await delay(600)
        }
      })(),
    ])
  }
}

export const world = new World()

import * as THREE from 'three'

import Stats from 'three/addons/libs/stats.module.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'

import {Panel} from './panel.js'
import {Character} from './character.js'
import {Params} from './overrides.js'
import {profile} from './perf.js'
import {debounce} from './utils.js'
import {VoiceController} from './voice.js'
import {Plotter} from './plotter.js'

export class World {
  clock = new THREE.Clock()
  scene = new THREE.Scene()
  renderer = new THREE.WebGLRenderer({antialias: true})
  stats = new Stats()
  plotter = new Plotter(this)
  container = document.getElementById('container')
  params = new Params()
  panel = new Panel(this.params)
  voice = new VoiceController(this)

  /** @type {Character[]} */
  characters = []

  /** @type {THREE.PerspectiveCamera} */
  camera = null

  get first() {
    return this.characterByName('first')
  }

  get trackNames() {
    return this.first.currentClip.tracks.map((t) => t.name)
  }

  transform(t, o) {
    this.first.applyTransform(t, o)
  }

  setup() {
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
    this.setupCharacters()
    this.addResizeHandler()

    // Setup elements
    this.container.appendChild(this.renderer.domElement)
    this.container.appendChild(this.stats.domElement)
    this.container.appendChild(this.plotter.domElement)

    // Expose the world instance
    window.world = this
  }

  render() {
    requestAnimationFrame(this.render.bind(this))

    // Update mixers for each character
    const delta = this.clock.getDelta()

    for (const character of this.characters) {
      if (character.mixer) character.mixer.update(delta)
    }

    // Render the scene
    this.stats.update()
    this.renderer.render(this.scene, this.camera)
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
      new THREE.MeshPhongMaterial({color: 0xcbcbcb, depthWrite: false})
    )

    plane.rotation.x = -Math.PI / 2
    plane.receiveShadow = true
    this.scene.add(plane)
  }

  setupRenderer() {
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
  }

  setupCamera() {
    // Setup camera
    const aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.PerspectiveCamera(45, aspect, 1, 100)
    this.camera.position.set(-1, 2, 3)
  }

  setupControls() {
    const controls = new OrbitControls(this.camera, this.renderer.domElement)
    controls.enablePan = true
    controls.enableZoom = true
    controls.target.set(0, 1, 0)
    controls.update()
  }

  addResizeHandler() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight
      this.camera.updateProjectionMatrix()

      this.renderer.setSize(window.innerWidth, window.innerHeight)
    })
  }

  /**
   * @param {string} name
   * @returns {Character}
   */
  characterByName(name) {
    return this.characters.find((c) => c.options.name === name)
  }

  updateParams(flags) {
    profile('update', () => {
      for (const character of this.characters) {
        character.updateParams(flags)
      }
    })
  }

  /**
   * @param {typeof Character.prototype.options} config
   **/
  async addCharacter(config) {
    const character = new Character(config)
    character.handlers.animationLoaded = this.handleAnimationChange.bind(this)

    await character.setup(this.scene, this.params)
    this.characters.push(character)
  }

  freezeCharacters() {
    this.characters.forEach((c) => c.freezePosition())
  }

  /**
   * @param {Character} char
   */
  handleAnimationChange(char) {
    const {name, action} = char.options

    let controller = world.panel.characterFolder.children
      .find((k) => k.character === name)
      .controllers.find((c) => c.property === 'action')
      .options([...char.actions.keys()])
      .listen()
      .onChange(() => this.panel.handlers.action(name))

    this.params.characters[name].action = action
    controller.updateDisplay()
  }

  async setupCharacters() {
    this.addCharacter({
      name: 'first',
      model: 'abstract',
      position: [-0.8, 0, 0],
      analyze: true,
    })

    this.addCharacter({
      name: 'second',
      model: 'abstract',
      position: [0.8, 0, 0],
      freezeParams: true,
    })
  }

  setupPanel() {
    this.panel.handlers.delay = debounce(() => this.updateParams(), 100)
    this.panel.handlers.energy = debounce(() => this.updateParams(), 100)

    this.panel.handlers.rotation = debounce(() => {
      return this.updateParams({rotation: true})
    }, 100)

    this.panel.handlers.timescale = () => {
      for (const character of this.characters) {
        character.mixer.timeScale = this.params.timescale
      }
    }

    /** @param {keyof typeof Params.prototype.characters} name */
    this.panel.handlers.character = async (name) => {
      const char = this.characterByName(name)
      if (!char) return

      await char.reset()

      // Sync animation timing with a peer.
      const peer = this.characters.find((c) => c.name !== name)
      if (peer) char.mixer.setTime(peer.mixer.time)
    }

    /** @param {keyof typeof Params.prototype.characters} name */
    this.panel.handlers.action = (name) => {
      const action = this.params.characters[name].action
      const character = this.characterByName(name)
      if (!character || !action) return

      character.playByName(action)
    }

    this.panel.handlers.voice = () => {
      console.log('Voice')
      this.voice.toggle()
    }

    this.panel.handlers.freezePosition = () => {
      this.freezeCharacters()
    }

    this.panel.createPanel()
  }
}

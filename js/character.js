import * as THREE from 'three'
import {AnimationAction, AnimationClip, QuaternionKeyframeTrack} from 'three'

import {GLTFLoader} from '../jsm/loaders/GLTFLoader.js'

import {trackToEuler} from './math.js'

import {lengthenKeyframeTracks} from './keyframes.js'

import {trackNameToPart} from './parts.js'
import {dispose} from './dispose.js'

import {
  Params,
  overrideDelay,
  overrideEnergy,
  overrideRotation,
} from './overrides.js'
import {KeyframeAnalyzer} from './analyze.js'
import {applyTrackTransform, transformers} from './transforms.js'

/** @typedef {{eulers: THREE.Euler[], timings: number[], duration: number}} AnimationSource */

const loader = new GLTFLoader()
const loadModel = (url) => new Promise((resolve) => loader.load(url, resolve))

export class Character {
  /**
   * Reference to scene.
   * @type {THREE.Scene}
   **/
  scene = null

  /** @type {THREE.AnimationMixer} */
  mixer = null

  /** @type {THREE.SkeletonHelper} */
  skeleton = null

  /** @type {THREE.Scene} */
  model = null

  /** @type {Map<string, AnimationSource[]>} */
  original = new Map()

  /** @type {Map<string, AnimationAction>} */
  actions = new Map()

  /** @type {Params} */
  params = null

  /** @type {KeyframeAnalyzer} */
  analyzer = null

  options = {
    /** @type {keyof typeof Params.prototype.characters} */
    name: '',

    action: '',

    /** @type {keyof typeof Character.sources} */
    model: 'robot',

    scale: 0.008,
    position: [0, 0, 0],

    // Lengthen keyframe tracks.
    lengthen: 0,

    // Freeze parameters.
    freezeParams: false,

    analyze: false,
  }

  /** Character model source URLs */
  static sources = {
    none: '',
    robot: 'Robot3357test.glb',
    abstract: '3357modelidel.glb',
    abstract57: '575859_tas.glb',
    kukpat: 'Kukpat.glb',
    tranimid: 'tranimid.glb',
  }

  /** @type {Record<keyof typeof Character.sources, string>} */
  static defaultActions = {
    none: '',
    abstract: 'no.33_.',
    robot: 'no.33_..001',
    abstract57: 'no57_Tas',
    kukpat: 'kukpat_Tas',
    tranimid: 'tranimid_Tas',
  }

  /**
   * @param {keyof typeof Character.sources} name
   **/
  constructor(options) {
    if (options) this.options = {...this.options, ...options}
  }

  get currentClip() {
    return this.actions.get(this.options.action)?.getClip()
  }

  handlers = {
    /** @param {Character} character */
    animationLoaded: (character) => {},
  }

  setPosition(x = 0, y = 0, z = 0) {
    this.model.position.set(x, y, z)
  }

  clear() {
    dispose(this.mixer)
    dispose(this.model)
    this.scene.remove(this.model)

    this.mixer = null
    this.skeleton = null
    this.model = null

    this.original.clear()
    this.actions.clear()
  }

  get actionList() {
    return [...this.actions.values()]
  }

  /** @param {AnimationAction} action */
  play(action) {
    if (!action) return

    const name = action.getClip().name
    console.log('Playing:', name)

    // Cross-fade previously running actions
    const prev = this.actions.get(this.options.action)
    if (prev?.isRunning && prev.getClip().name !== name) {
      action.time = prev.time
      prev.crossFadeTo(action, 0.35, true)
    }

    action.play()

    this.options.action = name

    // Analyze the keyframe
    if (this.options.analyze) {
      this.analyzer = new KeyframeAnalyzer()
      this.analyzer.analyze(prev.getClip().tracks)
    }
  }

  /** @param {string} action */
  playByName(action) {
    if (!this.actions.has(action)) return

    this.options.action = action
    this.updateAction()
  }

  async setup(scene, params) {
    const config = this.options

    if (scene) this.scene = scene
    if (params) this.params = params

    // Ensure that there is no stale data
    this.clear()

    if (config.model === 'none') return

    // Get the model url based on the character model
    const url = Character.sources[config.model]
    if (url === 'none' || !url) return

    const gltf = await loadModel(url)

    // Set the default actions.
    if (!config.action) {
      config.action = Character.defaultActions[config.model]

      if (!config.action) {
        console.error(`invalid default action for ${config.model}`)
      }
    }

    // Add the character model
    this.model = gltf.scene
    this.scene.add(this.model)

    // Cast shadows
    this.model.traverse((object) => {
      if (object.isMesh) object.castShadow = true
    })

    // Adjust character scale
    const scale = config.scale
    this.model.scale.set(scale, scale, scale)
    this.model.position.set(...config.position)

    // Add model skeleton
    this.skeleton = new THREE.SkeletonHelper(this.model)
    this.skeleton.visible = false
    this.scene.add(this.skeleton)

    // Create individual animation mixer
    this.mixer = new THREE.AnimationMixer(this.model)
    this.mixer.timeScale = this.params.timescale

    /** @type {AnimationClip[]} */
    const clips = gltf.animations

    for (const clip of clips) {
      // Process the individual animation clips.
      this.processClip(clip)

      // Register the animation clip as character actions.
      const action = this.mixer.clipAction(clip)
      this.actions.set(clip.name, action)
    }

    // Signal that the animation has been loaded.
    this.handlers.animationLoaded?.(this)

    // Play the first animation
    this.updateAction()
  }

  updateAction() {
    const config = this.options

    // If we did not define the proper default action, fallback to the first action.
    if (!config.action) {
      this.play(this.actionList[0])
      return
    }

    if (!this.actions.has(config.action)) {
      console.error(`${config.model}: ${config.action} missing!`)
      return
    }

    this.play(this.actions.get(config.action))
  }

  /**
   * @param {THREE.AnimationClip} clip
   */
  processClip(clip) {
    // Make keyframes track longer for track-level looping.
    if (this.options.lengthen > 0) {
      for (let i = 0; i < this.options.lengthen; i++) {
        lengthenKeyframeTracks(clip.tracks)
      }
    }

    // Do not cache the original for default parameter characters.
    if (this.options.freezeParams) return

    // Cache original keyframe tracks for modification
    clip.tracks.forEach((track) => {
      // Cache timing and durations.
      const timings = track.times.slice(0)
      const duration = track.times[track.times.length - 1] - track.times[0]

      /** @type {AnimationSource} */
      const source = {timings, duration}

      // Cache euler angles for rotation tracks.
      if (track instanceof QuaternionKeyframeTrack) {
        const size = track.getValueSize()

        source.eulers = [...Array(track.times.length)].map((_, i) => {
          return trackToEuler(track, i * size)
        })
      }

      if (!this.original.has(clip.name)) this.original.set(clip.name, [])
      this.original.get(clip.name).push(source)
    })
  }

  /**
   * Get the original animation timings and values.
   * @param {number} index
   */
  originalOf(index) {
    const sources = this.original.get(this.options.action)
    if (!sources) return

    return sources[index]
  }

  /**
   * Update animation parameters.
   */
  updateParams(flags = {core: true}) {
    if (this.options.freezeParams) return

    const clip = this.currentClip
    if (!clip) return

    clip.tracks.forEach((track, index) => {
      // Reset the keyframe times.
      const original = this.originalOf(index)
      track.times = original.timings.slice(0)

      if (flags.core) {
        // Override delays
        overrideDelay(track, this.params.delays)

        // Override energy
        const part = trackNameToPart(track.name, 'core')
        const energy = this.params.energy[part]
        overrideEnergy(track, energy)
      }

      // Override rotation only
      if (flags.rotation) {
        overrideRotation(track, this.params.rotations, original.eulers)
      }

      clip[index] = track
    })

    this.fadeIntoModifiedAction(clip)
  }

  /**
   * @param {AnimationClip} clip
   */
  fadeIntoModifiedAction(clip) {
    const prevAction = this.actions.get(clip.name)
    this.mixer.uncacheAction(prevAction)

    const action = this.mixer.clipAction(clip.clone())
    this.actions.set(clip.name, action)

    action.time = prevAction.time
    prevAction.crossFadeTo(action, 0.35, true)
    action.play()
  }

  async reset() {
    console.log('>>> Resetting character!')
    const config = this.params.characters[this.options.name]

    this.options.model = config.model
    this.options.action = null

    await this.setup()
  }

  /**
   * @param {string|number} key
   * @param {number[]} values
   */
  overrideTrack(key, values) {
    key = this.trackIdByKey(key)

    const clip = this.currentClip

    const track = clip.tracks[key]
    if (!track) return

    console.log(`>> altering ${track.name} (id: ${key})`)

    const size = track.values.length
    console.log(`>> length before: ${size}`)

    if (values.length !== size) {
      console.warn(`track length mismatch. ${size} != ${values.length}`)
      // return
    }

    clip.tracks[key].values = new Float32Array(values)
    clip.tracks[key].validate()
    console.log(`>> length after: ${clip.tracks[key].values.length}`)

    this.fadeIntoModifiedAction(clip)
  }

  async loadTrackOverride(url) {
    const f = await fetch(url)
    const v = await f.json()

    for (const [id, values] of Object.entries(v)) {
      this.overrideTrack(id, values)
    }
  }

  applyTransform(transform) {
    const transformer = transformers[transform]
    if (!transformer) return

    console.log(`> applying ${transform} transform`)

    const clip = this.currentClip

    for (const track of clip.tracks) {
      const values = applyTrackTransform(track, transformer)
      track.values = values

      // debugger

      track.validate()
    }

    this.fadeIntoModifiedAction(clip)
  }

  /** @param {number | string | RegExp} key */
  trackIdByKey(key) {
    if (typeof key === 'number') return key

    return this.currentClip.tracks.findIndex(({name}) => {
      return key instanceof RegExp ? key.test(name) : name.includes(key)
    })
  }

  /**
   * @param {string | number | RegExp} key
   * @param {number} limit
   */
  getCurrentKeyframes(key, limit = 10) {
    key = this.trackIdByKey(key)

    const clip = this.currentClip
    const track = clip.tracks[key]
    if (!track) return

    const now = this.mixer.time

    const vs = track.getValueSize()
    const start = track.times.findIndex((t) => t >= now)
    const values = track.values.slice(start * vs, (start + limit) * vs)

    return {start, values, now}
  }
}

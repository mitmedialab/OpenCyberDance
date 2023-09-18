// @ts-check

import * as THREE from 'three'
import {AnimationAction, AnimationClip, QuaternionKeyframeTrack} from 'three'

import {GLTFLoader} from '../jsm/loaders/GLTFLoader.js'

import {trackToEuler} from './math.js'
import {
  getAcceleration,
  getRateOfChange,
  keyframesAt,
  lengthenKeyframeTracks,
} from './keyframes.js'
import {trackNameToPart} from './parts.js'
import {dispose} from './dispose.js'
import {curveParts} from './parts.js'

import {
  Params,
  applyExternalBodySpace,
  overrideDelay,
  overrideEnergy,
  overrideRotation,
} from './overrides.js'
import {KeyframeAnalyzer} from './analyze.js'
import {applyTrackTransform, transformers} from './transforms.js'

/** @typedef {{eulers: THREE.Euler[], values: Float32Array, timings: Float32Array, duration: number}} AnimationSource */
/** @typedef {number|string|RegExp} Q */

const loader = new GLTFLoader()
const loadModel = (url) => new Promise((resolve) => loader.load(url, resolve))

export class Character {
  /**
   * Reference to scene.
   * @type {THREE.Scene | null}
   **/
  scene = null

  /** @type {THREE.AnimationMixer | null} */
  mixer = null

  /** @type {THREE.SkeletonHelper | null} */
  skeleton = null

  /** @type {THREE.Scene | null} */
  model = null

  /** @type {Map<string, AnimationSource[]>} */
  original = new Map()

  /** @type {Map<string, AnimationAction>} */
  actions = new Map()

  /** @type {Params | null} */
  params = null

  /** @type {KeyframeAnalyzer | null} */
  analyzer = null

  options = {
    /** @type {keyof typeof Params.prototype.characters} */
    name: 'first',

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
   * @param {typeof Character.prototype.options} options
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
    this.model?.position.set(x, y, z)
  }

  clear() {
    if (!this.scene || !this.model) return

    // @ts-ignore
    dispose(this.mixer)

    // Remove the character model
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
    if (this.options.analyze && prev) {
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

    if (!this.scene || !this.model || !this.params) return

    this.scene.add(this.model)

    // Cast shadows
    this.model.traverse((object) => {
      // @ts-ignore
      if (object.isMesh) object.castShadow = true
    })

    // Adjust character scale
    const scale = config.scale
    this.model.scale.set(scale, scale, scale)

    const [x, y, z] = config.position
    this.model.position.set(x, y, z)

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

    const action = this.actions.get(config.action)
    if (!action) return

    this.play(action)
  }

  /**
   * @param {THREE.AnimationClip} clip
   */
  processClip(clip) {
    const {lengthen, freezeParams} = this.options

    // Make keyframes track longer for track-level looping.
    if (lengthen > 0) {
      for (let i = 0; i < lengthen; i++) {
        lengthenKeyframeTracks(clip.tracks)
      }
    }

    // Cache original keyframe tracks for modification
    clip.tracks.forEach((track) => {
      // Cache timing and durations.
      const timings = track.times.slice(0)
      const values = track.values.slice(0)
      const duration = track.times[track.times.length - 1] - track.times[0]

      /** @type {AnimationSource} */
      const source = {timings, values, duration, eulers: []}

      // Cache euler angles for rotation tracks.
      if (!freezeParams && track instanceof QuaternionKeyframeTrack) {
        const size = track.getValueSize()

        source.eulers = [...Array(track.times.length)].map((_, i) => {
          return trackToEuler(track, i * size)
        })
      }

      if (!this.original.has(clip.name)) this.original.set(clip.name, [])
      this.original.get(clip.name)?.push(source)
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
    const {lockPosition: lock} = flags

    const {freezeParams} = this.options
    if (freezeParams && lock === undefined) return

    const clip = this.currentClip
    if (!clip || !this.params) return

    let _curve = {}

    if (flags.curve) {
      _curve.equation = transformers[this.params.curve.equation]
      _curve.axis = this.curveConfig.axis
      _curve.tracks = this.query(...this.curveConfig.tracks)
    }

    clip.tracks.forEach((track, index) => {
      // Reset the keyframe times.
      const original = this.originalOf(index)
      if (!original || !this.params) return

      // Lock and unlock hips position hips position.
      if (track.name === 'Hips.position') {
        track.values = lock ? track.values.fill(0) : original.values.slice(0)
      }

      if (freezeParams) return

      // Reset the keyframe times.
      track.times = original.timings.slice(0)

      // Reset the keyframe values when circle and curve formula changes.
      if (flags.curve) {
        track.values = original.values.slice(0)
      }

      if (flags.core) {
        // Override energy
        const part = trackNameToPart(track.name, 'core')
        if (!part) return

        // Override delays
        // @ts-ignore
        overrideDelay(track, this.params.delays)

        const energy = this.params.energy[part]
        overrideEnergy(track, energy)
      }

      // Override rotation only
      // TODO: support individual body parts' rotation!
      if (flags.rotation) {
        overrideRotation(track, this.params.rotations, original.eulers)
      }

      // Override curve only
      if (flags.curve && _curve.tracks.includes(index) && _curve.equation) {
        track.values = applyTrackTransform(track, _curve.equation, {
          axis: _curve.axis,
          tracks: _curve.tracks,
          threshold: this.params.curve.threshold,
        })
      }

      clip[index] = track
    })

    if (flags.space) {
      clip.tracks = applyExternalBodySpace(clip.tracks)
    }

    this.fadeIntoModifiedAction(clip)
  }

  /**
   * @returns {{tracks: Q[], axis: import('./transforms.js').Axis[]}}
   */
  get curveConfig() {
    const c = this.params?.curve
    if (!c) return {tracks: [], axis: []}

    const tracks = Object.entries(c.parts)
      .filter(([_, v]) => v === true)
      .map(([p]) => curveParts[p])

    const axis = Object.entries(c.axes)
      .filter(([_, v]) => v === true)
      .map(([k]) => k)

    // @ts-ignore
    return {tracks, axis}
  }

  /**
   * @param {AnimationClip} clip
   */
  fadeIntoModifiedAction(clip) {
    if (!this.mixer) return

    const prevAction = this.actions.get(clip.name)
    if (!prevAction) return

    const action = this.mixer.clipAction(clip.clone())
    this.actions.set(clip.name, action)

    action.time = prevAction.time
    prevAction.crossFadeTo(action, 0.35, true)
    action.play()

    // Uncache the action after the cross-fade is complete.
    setTimeout(() => {
      this.mixer?.uncacheAction(prevAction.getClip())
    }, 4000)
  }

  async reset() {
    if (!this.params) return

    console.log('>>> Resetting character!')
    const config = this.params.characters[this.options.name]

    // @ts-ignore
    this.options.model = config.model

    // @ts-ignore
    this.options.action = null

    await this.setup()
  }

  /**
   * @param {string|number} key
   * @param {Float32Array | number[]} values
   * @param {(Float32Array | number[])?} times
   */
  overrideTrack(key, values, times = null) {
    key = this.trackIdByKey(key) ?? 0

    const clip = this.currentClip
    if (!clip) return

    const track = clip.tracks[key]
    if (!track) return

    console.log(`>> altering ${track.name} (id: ${key})`)

    const size = track.values.length
    console.log(`>> length before: ${size}`)

    if (values.length !== size) {
      console.warn(`track length mismatch. ${size} != ${values.length}`)
    }

    if (times) {
      clip.tracks[key].times = new Float32Array(times)
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

  /**
   * Get the original keyframe track.
   * @param {number[]?} ids track ids
   */
  originalClip(ids) {
    const clip = this.currentClip
    if (!clip) return

    clip.tracks.forEach((track, id) => {
      if (ids && !ids.includes(id)) return

      const s = this.originalOf(id)
      if (!s) return

      track.values = s.values.slice(0)
    })

    return clip
  }

  /**
   *
   * @param {keyof typeof import('./transforms.js').transformers | 'none' | import('./transforms.js').Transform} transform
   * @param {import('./transforms.js').Options & {tracks: Q | Q[]}} options
   */
  transform(transform, options) {
    if (this.options.freezeParams) return

    if (options.tracks) {
      // Convert a single track query to an array.
      if (!Array.isArray(options.tracks)) {
        options.tracks = [options.tracks]
      }

      // Query the track ids.
      options.tracks = this.query(...options.tracks)
    }

    const isKey = typeof transform === 'string'
    const name = isKey ? transform : transform.name

    const transformer = isKey ? transformers[transform] : transform
    if (!transformer) return

    console.log(`> applying ${name} transform`, options)

    const clip = this.currentClip
    if (!clip) return

    clip.tracks.forEach((track, id) => {
      if (!transformer) return

      // Exclude the tracks that does not match.
      if (options.tracks && !options.tracks?.includes(id)) return

      // Apply the transform to each track.
      const values = applyTrackTransform(track, transformer, options)
      track.values = values
      track.validate()
    })

    this.fadeIntoModifiedAction(clip)
  }

  /** @param {number | string | RegExp} key */
  trackIdByKey(key) {
    if (typeof key === 'number') return key

    return this.currentClip?.tracks.findIndex(({name}) => {
      return key instanceof RegExp ? key.test(name) : name.includes(key)
    })
  }

  /** @param {number | string | RegExp} key */
  trackByKey(key) {
    const id = this.trackIdByKey(key)
    if (!id) return

    return this.currentClip?.tracks[id]
  }

  /**
   * Queries the track id by name of regex.
   *
   * @param {Q[]} query
   * @returns {number[]}
   */
  query(...query) {
    /** @type {Set<number>} */
    const ids = new Set()
    query.forEach((q) => typeof q === 'number' && ids.add(q))

    const tracks = this.currentClip?.tracks
    if (!tracks) return [...ids]

    for (const q of query) {
      tracks
        .filter((t) => {
          if (typeof q === 'string') return t.name.includes(q)
          if (q instanceof RegExp) return q.test(t.name)
        })
        .forEach((t) => ids.add(tracks.indexOf(t)))
    }

    return [...ids]
  }

  /** @param {number[]} ids */
  getTrackNames(ids) {
    return (
      this.currentClip?.tracks
        .filter((t, i) => ids.includes(i))
        .map((t) => t.name) ?? []
    )
  }

  getMovementStats(key, options) {
    const {windowSize = 200, threshold = 0.01, skip = 1} = options ?? {}

    const track = this.trackByKey(key)
    if (!track) return

    const {series} = keyframesAt(track, {
      from: this.mixer?.time ?? 0,
      windowSize,
      offset: 0,
      axes: ['x', 'y', 'z', 'w'],
    })

    return {
      acceleration: series.map(getAcceleration),
      rateOfChange: getRateOfChange(series, {threshold, skip}),
    }
  }
}

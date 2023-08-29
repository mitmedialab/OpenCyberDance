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

/** @typedef {{eulers: THREE.Euler[], timings: number[], duration: number}} AnimationSource */

const loader = new GLTFLoader()
const loadModel = (url) => new Promise((resolve) => loader.load(url, resolve))

export class Character {
  /// Current action.
  currentAction = 'none'

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

  options = {
    name: '',

    /** @type {keyof typeof Character.sources} */
    model: 'robot',

    scale: 0.008,
    position: [0, 0, 0],

    // Lengthen keyframe tracks.
    lengthen: 0,

    // Freeze parameters.
    freezeParams: false,
  }

  /** Character model source URLs */
  static sources = {
    none: '',
    robot: 'Robot3357test.glb',
    abstract: 'humanPPtesting.glb',
  }

  /**
   * @param {keyof typeof Character.sources} name
   **/
  constructor(options) {
    if (options) this.options = {...this.options, ...options}
  }

  get currentClip() {
    return this.actions.get(this.currentAction)?.getClip()
  }

  setPosition(x = 0, y = 0, z = 0) {
    this.model.position.set(x, y, z)
  }

  clear() {
    dispose(this.model)
    this.scene.remove(this.model)
  }

  get actionList() {
    return [...this.actions.values()]
  }

  act(name) {
    this.play(this.actions.get(name))
  }

  /** @param {AnimationAction} action */
  play(action) {
    if (!action) return

    action.play()
    this.currentAction = action.getClip().name
  }

  async setup(scene, params) {
    this.scene = scene
    this.params = params

    // Ensure that there is no stale data
    this.clear()

    // Get the model url based on the character model
    const url = Character.sources[this.options.model]
    if (url === 'none' || !url) return

    const gltf = await loadModel(url)

    // Add the character model
    this.model = gltf.scene
    this.scene.add(this.model)

    // Cast shadows
    this.model.traverse((object) => {
      if (object.isMesh) object.castShadow = true
    })

    // Adjust character scale
    const scale = this.options.scale
    this.model.scale.set(scale, scale, scale)
    this.model.position.set(...this.options.position)

    // Add model skeleton
    this.skeleton = new THREE.SkeletonHelper(this.model)
    this.skeleton.visible = false
    this.scene.add(this.skeleton)

    // Create individual animation mixer
    this.mixer = new THREE.AnimationMixer(this.model)

    /** @type {AnimationClip[]} */
    const clips = gltf.animations

    for (const clip of clips) {
      // Process the individual animation clips.
      this.processClip(clip)

      // Register the animation clip as character actions.
      const action = this.mixer.clipAction(clip)
      this.actions.set(clip.name, action)
    }
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
    const sources = this.original.get(this.currentAction)
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

    const prevAction = this.actions.get(clip.name)
    this.mixer.uncacheAction(prevAction)

    const action = this.mixer.clipAction(clip.clone())
    this.actions.set(clip.name, action)

    action.time = prevAction.time
    prevAction.crossFadeTo(action, 0.35, true)
    action.play()
  }
}

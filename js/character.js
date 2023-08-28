import * as THREE from 'three'

import {AnimationAction, AnimationClip} from 'three'
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
  /** @type {keyof typeof Character.sources} */
  type = 'robot'

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
    scale: 0.008,

    // Lengthen keyframe tracks.
    lengthen: 1,

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
  constructor(name, options) {
    this.type = name
    if (options) this.options = {...this.options, ...options}
  }

  /**
   * @param {keyof typeof Character.sources} type
   **/
  static of(type, options) {
    return new Character(type, options)
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

  actAt(i) {
    this.play(this.actionList[i])
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

    // Get the model url based on the character type
    const url = Character.sources[this.type]
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

    // Add model skeleton
    this.skeleton = new THREE.SkeletonHelper(this.model)
    this.skeleton.visible = false
    this.scene.add(this.skeleton)

    // Create individual animation mixer
    this.mixer = new THREE.AnimationMixer(this.model)

    // Setup animations.
    this.loadAnimations(gltf.animations)
  }

  /** @param {AnimationClip[]} clips */
  loadAnimations(clips) {
    for (const clip of clips) {
      this.cacheClip(clip)

      const action = this.mixer.clipAction(clip)
      this.actions.set(clip.name, action)
    }
  }

  /**
   * @param {THREE.AnimationClip} clip
   */
  cacheClip(clip) {
    // Lengthten keyframe tracks.
    for (let i = 0; i < this.options.lengthen; i++) {
      lengthenKeyframeTracks(clip.tracks)
    }

    // Do not cache the original for default parameter characters.
    if (this.options.freezeParams) return

    // Cache original keyframe tracks for modification
    clip.tracks.forEach((track) => {
      const timings = track.times.slice(0)
      const duration = track.times[track.times.length - 1] - track.times[0]
      const size = track.getValueSize()

      const eulers = [...Array(track.times.length)].map((_, i) => {
        return trackToEuler(track, i * size)
      })

      track.validate()

      if (!this.original.has(clip.name)) this.original.set(clip.name, [])

      this.original.get(clip.name).push({
        eulers,
        timings,
        duration,
      })
    })
  }

  /**
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

    this.currentClip?.tracks.forEach((track, index) => {
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
    })
  }
}

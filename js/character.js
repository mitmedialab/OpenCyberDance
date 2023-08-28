import {AnimationAction, AnimationClip} from 'three'

import {trackToEuler} from './math.js'
import {lengthenKeyframeTracks} from './keyframes.js'
import {
  Params,
  overrideDelay,
  overrideEnergy,
  overrideRotation,
} from './overrides.js'

/** @typedef {{eulers: THREE.Euler[], timings: number[], duration: number}} AnimationSource */

export class Character {
  _scale = 0.08

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
  override = null

  options = {
    // Lengthen keyframe tracks.
    lengthen: 1,
  }

  /** Character map sources */
  static sources = {
    none: '',
    robot: 'Robot3357test.glb',
    abstract: 'humanPPtesting.glb',
  }

  /**
   * @param {keyof typeof Character.sources} name
   **/
  constructor(name) {
    this.type = name
  }

  /**
   * @param {keyof typeof Character.sources} type
   **/
  static of(type) {
    return new Character(type)
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

  /** @type {Params} state */
  registerOverride(override) {
    this.override = override
  }

  setup() {
    this.clear()

    const file = Character.sources[this.type]
    if (file === 'none' || !file) return

    const loader = new GLTFLoader()

    loader.load(file, (gltf) => {
      // Add the character model
      this.model = gltf.scene
      this.scene.add(model)

      // Cast shadows
      this.model.traverse((object) => {
        if (object.isMesh) object.castShadow = true
      })

      // Adjust character scale
      this.model.scale.set(this._scale, this._scale, this._scale)

      // Add model skeleton
      this.skeleton = new THREE.SkeletonHelper(model)
      this.skeleton.visible = false
      this.scene.add(this.skeleton)

      // Create individual animation mixer
      this.mixer = new THREE.AnimationMixer(this.model)

      // Setup animations.
      this.loadAnimations(gltf.animations)
    })
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

    clip.tracks.forEach((track) => {
      const timings = track.times.slice(0)
      const duration = track.times[track.times.length - 1] - track.times[0]
      const size = track.getValueSize()
      const eulers = track.times.map((_, i) => trackToEuler(track, i * size))

      if (!this.original.has(clip.name)) this.original.set(clip.name, [])

      track.validate()

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
  updateParams() {
    this.currentClip?.tracks.forEach((track, index) => {
      // Reset the keyframe times.
      const original = this.originalOf(index)
      track.times = original.timings.slice(0)

      // Override delays
      overrideDelay(track, this.override.delays)

      // Override energy
      const part = trackNameToPart(track.name, 'core')
      const energy = this.override.energy[part]
      overrideEnergy(track, energy)

      // Override rotation
      overrideRotation(track, this.override.rotations, original.eulers)
    })
  }
}

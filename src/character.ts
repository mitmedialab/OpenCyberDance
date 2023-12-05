import * as THREE from 'three'
import {
  AnimationAction,
  AnimationClip,
  Mesh,
  QuaternionKeyframeTrack,
  Scene,
} from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

import { KeyframeAnalyzer } from './analyze'
import { dispose } from './dispose'
import { IKManager } from './ik'
import {
  getAcceleration,
  keyframesAt,
  lengthenKeyframeTracks,
} from './keyframes'
import { trackToEuler } from './math'
import {
  applyExternalBodySpace,
  overrideDelay,
  overrideEnergy,
  overrideRotation,
  Params,
} from './overrides'
import { curveParts, trackNameToPart } from './parts'
import { profile } from './perf'
import {
  applyTrackTransform,
  Axis,
  Transform,
  transformers,
  TransformKey,
  TransformOptions,
} from './transforms'
import { Matcher } from './types'

export interface AnimationSource {
  eulers: THREE.Euler[]
  values: Float32Array
  timings: Float32Array
  duration: number
}

interface MovementOptions {
  windowSize: number
  threshold?: number
  skip?: number
}

export interface UpdateParamFlags {
  curve?: boolean
  timing?: boolean
  lockPosition?: boolean
}

const loader = new GLTFLoader()

// Attach a profiler
const p = {
  ebs: profile('external body space', 20),
}

export type ModelKey = keyof typeof Character.sources
export type CharacterKey = keyof typeof Params.prototype.characters

export interface CharacterOptions {
  name: CharacterKey
  action: string
  model: ModelKey
  scale: number
  position: [number, number, number]
  analyze: boolean

  /** Freeze the parameters. Used to compare characters side-by-side. */
  freezeParams: boolean

  /** Lengthen keyframe tracks */
  lengthen: number
}

type Handlers = {
  animationLoaded(character: Character): void
}

export class Character {
  scene: THREE.Scene | null = null
  mixer: THREE.AnimationMixer | null = null
  skeleton: THREE.SkeletonHelper | null = null
  model: THREE.Group | null = null
  original: Map<string, AnimationSource[]> = new Map()
  actions: Map<string, AnimationAction> = new Map()
  params: Params | null = null
  analyzer: KeyframeAnalyzer | null = null
  ik: IKManager | null = null

  options: CharacterOptions = {
    name: 'first',
    action: '',
    model: 'robot',
    scale: 0.008,
    position: [0, 0, 0],
    lengthen: 0,
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

  static defaultActions: Record<ModelKey, string> = {
    none: '',
    abstract: 'no.33_.',
    robot: 'no.33_..001',
    abstract57: 'no57_Tas',
    kukpat: 'kukpat_Tas',
    tranimid: 'tranimid_Tas',
  }

  constructor(options?: Partial<CharacterOptions>) {
    if (options) this.options = { ...this.options, ...options }
  }

  get currentClip() {
    return this.actions.get(this.options.action)?.getClip()
  }

  handlers: Handlers = {
    animationLoaded: () => {},
  }

  setPosition(x = 0, y = 0, z = 0) {
    this.model?.position.set(x, y, z)
  }

  clear() {
    if (!this.scene || !this.model) return

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

  play(action: AnimationAction) {
    if (!action) return

    const name = action.getClip().name

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

  playByName(action: string) {
    if (!this.actions.has(action)) return

    this.options.action = action
    this.updateAction()
  }

  async setup(scene?: Scene, params?: Params) {
    const config = this.options

    if (scene) this.scene = scene
    if (params) this.params = params

    // Ensure that there is no stale data
    this.clear()

    if (config.model === 'none') return

    // Get the model url based on the character model
    const url = `/models/${Character.sources[config.model]}`
    if (url === 'none' || !url) return

    const gltf = await loader.loadAsync(url)

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
    this.model.traverse((o) => {
      if (o instanceof Mesh) o.castShadow = true
    })

    // Adjust character scale
    const scale = config.scale
    this.model.scale.set(scale, scale, scale)

    const [x, y, z] = config.position
    this.model.position.set(x, y, z)

    // Add model skeleton
    this.skeleton = new THREE.SkeletonHelper(this.model)
    this.skeleton.visible = false
    this.ik = new IKManager(this.skeleton, this.model)
    this.scene.add(this.skeleton)
    this.scene.add(this.ik.ik.createHelper())

    // Create individual animation mixer
    this.mixer = new THREE.AnimationMixer(this.model)
    this.mixer.timeScale = this.params.timescale

    const clips: AnimationClip[] = gltf.animations

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

    console.log('>>> setup completed', this.skeleton)
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

  processClip(clip: AnimationClip) {
    const { lengthen, freezeParams } = this.options

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

      const source: AnimationSource = { timings, values, duration, eulers: [] }

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

  /** Get the original animation timings and values. */
  originalOf(index: number) {
    const sources = this.original.get(this.options.action)
    if (!sources) return

    return sources[index]
  }

  /**
   * Update animation parameters.
   */
  updateParams(flags: UpdateParamFlags = { timing: true }) {
    const { lockPosition: lock } = flags

    const { freezeParams } = this.options
    if (freezeParams && lock === undefined) return

    const clip = this.currentClip
    if (!clip || !this.params) return

    const _curve: { equation: Transform; axis: Axis[]; tracks: number[] } = {}

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

      // Reset the keyframe values when circle and curve formula changes.
      if (flags.curve) {
        track.values = original.values.slice(0)
      }

      if (flags.timing) {
        // Reset the keyframe times.
        track.times = original.timings.slice(0)

        // Override energy.
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

    // External body space is always applied for timing changes.
    if (flags.timing) {
      p.ebs(() => {
        if (!this.params) return

        clip.tracks = applyExternalBodySpace(clip.tracks, this.params.space)
      })
    }

    this.fadeIntoModifiedAction(clip)
  }

  get curveConfig(): { tracks: Matcher[]; axis: Axis[] } {
    const c = this.params?.curve
    if (!c) return { tracks: [], axis: [] }

    const tracks = Object.entries(c.parts)
      .filter(([_, v]) => v === true)
      .map(([p]) => curveParts[p])

    const axis = Object.entries(c.axes)
      .filter(([, v]) => v === true)
      .map(([k]) => k) as Axis[]

    return { tracks, axis }
  }

  fadeIntoModifiedAction(clip: THREE.AnimationClip) {
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

  overrideTrack(
    key: Matcher,
    values: Float32Array | number[],
    times?: Float32Array | number[],
  ) {
    const id = this.trackIdByKey(key) ?? 0

    const clip = this.currentClip
    if (!clip) return

    const track = clip.tracks[id]
    if (!track) return

    const size = track.values.length

    if (values.length !== size) {
      console.warn(`track length mismatch. ${size} != ${values.length}`)
    }

    if (times) {
      clip.tracks[id].times = new Float32Array(times)
    }

    clip.tracks[id].values = new Float32Array(values)
    clip.tracks[id].validate()

    this.fadeIntoModifiedAction(clip)
  }

  /** Get the original keyframe track. */
  originalClip(ids: number[]) {
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

  transform(
    transform: TransformKey | Transform | 'none',
    options: TransformOptions & { tracks: Matcher | Matcher[] },
  ) {
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

  trackIdByKey(key: Matcher) {
    if (typeof key === 'number') return key

    return this.currentClip?.tracks.findIndex(({ name }) => {
      if (key instanceof RegExp) return key.test(name)
      if (key) return name.includes(key)
    })
  }

  trackByKey(key: Matcher) {
    const id = this.trackIdByKey(key)
    if (!id) return

    return this.currentClip?.tracks[id]
  }

  /** Queries the track id by name or regex. */
  query(...query: Matcher[]): number[] {
    const ids: Set<number> = new Set()
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

  getTrackNames(ids: number[]): string[] {
    return (
      this.currentClip?.tracks
        .filter((_, i) => ids.includes(i))
        .map((t) => t.name) ?? []
    )
  }

  getMovementStats(key: string, options?: MovementOptions) {
    const { windowSize = 200 } = options ?? {}

    const track = this.trackByKey(key)
    if (!track) return

    const keyframe = keyframesAt(track, {
      from: this.mixer?.time ?? 0,
      windowSize,
      offset: 0,
      axes: ['x', 'y', 'z', 'w'],
    })

    if (!keyframe) return

    const { series } = keyframe

    return { acceleration: series.map(getAcceleration) }
  }
}

import * as THREE from 'three'
import {
  AnimationAction,
  AnimationClip,
  Bone,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  QuaternionKeyframeTrack,
  Scene,
  SkeletonHelper,
  SkinnedMesh,
} from 'three'

import { KeyframeAnalyzer } from './analyze'
import { BoneRotationManager } from './bone-rotation'
import { CameraPresetKey } from './camera'
import { dispose } from './dispose'
import { CCDIKHelper } from './ik/ccd-ik-helper'
import { IKManager } from './ik/ik'
import {
  getAcceleration,
  keyframesAt,
  lengthenKeyframeTracks,
} from './keyframes'
import { trackToEuler } from './math'
import {
  applyExternalBodySpace,
  ebsCache,
  overrideDelay,
  overrideEnergy,
  overrideRotation,
  Params,
} from './overrides'
import {
  CurvePartKey,
  curveParts,
  EnergyPartKey,
  trackNameToPart,
} from './parts'
import { profile } from './perf'
import { preloader } from './preloader'
import { $currentScene } from './store/scene'
import { $duration, $time } from './store/status'
import {
  applyTrackTransform,
  Axis,
  Transform,
  transformers,
} from './transforms'
import { Matcher } from './types'
import { delay } from './utils'

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
  rotation?: boolean
  axisPoint?: boolean
  space?: boolean

  withEnergy?: boolean
}

// Attach a profiler
const perf = {
  ebs: profile('external body space', 20),
}

export type ModelKey = keyof typeof Character.sources
export type CharacterKey = keyof typeof Params.prototype.characters

const NTH_FRAME_TICK = 58

export const resetLimits: Partial<Record<ModelKey, number>> = {
  gade: 160,
  o: 300,
  yokrob: 202,
  yokroblingImprovise: 220,
}

// Ending scene's keyframes
export const EndingKeyframes = {}

export interface CharacterOptions {
  name: CharacterKey
  action: string | null
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
  setCameraAngle(preset: CameraPresetKey): void
  fade(mode: 'in' | 'out'): Promise<void>
}

type DebugSpheres = { forehead?: Mesh; neck?: Mesh; body?: Mesh }

type AnimationFlags = object

const DEBUG_SKELETON = false
export const INITIAL_MODEL: ModelKey = 'waiting'

export class Character {
  scene: THREE.Scene | null = null
  mixer: THREE.AnimationMixer | null = null
  skeletonHelper: THREE.SkeletonHelper | null = null
  model: THREE.Group | null = null
  original: Map<string, AnimationSource[]> = new Map()
  actions: Map<string, AnimationAction> = new Map()
  params: Params | null = null
  analyzer: KeyframeAnalyzer | null = null
  ik: IKManager | null = null
  boneRotation: BoneRotationManager | null = null

  flags: AnimationFlags = {}

  frameCounter = 0

  debugSpheres: DebugSpheres = {}

  options: CharacterOptions = {
    name: 'first',
    action: '',
    model: INITIAL_MODEL,
    scale: 0.008,
    position: [0, 0, 0],
    lengthen: 0,
    freezeParams: false,
    analyze: false,
  }

  /** Character model source URLs */
  static sources = {
    none: '',

    waiting: 'subinwaiting.glb',
    kukpat: 'Kukpat.glb',
    gade: 'terry.glb',
    o: 'changhung.glb',
    yokrob: 'YOKROB.glb',
    yokroblingImprovise: 'YOKROBlingimprovise.glb',

    // Pichet dancers in ending scene.
    // pichetMaster: 'Master.glb',
    // pichetGenBlack: 'Gen.glb',

    // robot: 'Robot3357test.glb',
    // abstract: '3357modelidel.glb',
    // abstract57: '575859_tas.glb',
    // tranimid: 'tranimid.glb',

    // black background
    sunonLast: 'Padunglast.glb',
    gadeLast: 'Terrylast.glb',
    tasLast: 'Taslast.glb',
    oLast: 'Changhonglast.glb',
  } satisfies Record<string, string>

  static defaultActions: Record<ModelKey, string> = {
    none: '',
    // abstract: 'no.33_.',
    // robot: 'no.33_..001',
    // abstract57: 'no57_Tas',
    kukpat: 'kukpat_Tas',
    // tranimid: 'tranimid_Tas',

    // animation track names for solo dances
    gade: 'terry_chr02',
    o: 'Changhung002_chr02',
    yokrob: 'yokrobling_Tas',
    yokroblingImprovise: 'yokroblingimprovised_chr02.001',

    waiting: 'sit002_Tas.001',

    // pichetMaster: 'Master',
    // pichetGenBlack: 'Action|Action|Action_Action_Action',

    sunonLast: 'padungdance_Tas_padungdance_Tas',
    gadeLast: 'Terrydance_Tas',
    oLast: 'Changhongdance_Tas_Changhongdance_Tas',
    tasLast: 'tasdance002_Tas',
  }

  constructor(options?: Partial<CharacterOptions>) {
    if (options) this.options = { ...this.options, ...options }
  }

  get currentClip(): AnimationClip | null {
    const { action } = this.options
    if (!action) return null

    return this.actions.get(action)?.getClip() ?? null
  }

  get isPrimary() {
    return this.options.name === 'first'
  }

  get isSecondary() {
    return this.options.name === 'second'
  }

  handlers: Handlers = {
    animationLoaded: () => {},
    setCameraAngle: () => {},
    fade: async () => {},
  }

  setPosition(x = 0, y = 0, z = 0) {
    this.model?.position.set(x, y, z)
  }

  teardown() {
    if (!this.scene || !this.model || !this.mixer) return

    this.mixer.removeEventListener('loop', this.onLoopEnd.bind(this))

    this.scene.traverse((o) => {
      if (o instanceof CCDIKHelper) o.dispose()
      if (o instanceof SkeletonHelper) o.dispose()
    })

    dispose(this.model)
    this.scene.remove(this.model)

    this.mixer = null
    this.skeletonHelper = null
    this.model = null
    this.boneRotation = null

    this.original.clear()
    this.actions.clear()
  }

  get actionList() {
    return [...this.actions.values()]
  }

  get currentAction(): AnimationAction | null {
    const { action } = this.options
    if (!action) return null

    return this.actions.get(action) ?? null
  }

  play(action: AnimationAction) {
    if (!action) return

    const name = action.getClip().name
    const currAction = this.options.action
    if (!currAction) return

    // Cross-fade previously running actions
    const prev = this.actions.get(currAction)

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
    try {
      const config = this.options

      if (scene) this.scene = scene
      if (params) this.params = params

      // Ensure that there is no stale data
      this.teardown()

      if (config.model === 'none') return

      // Get the model url based on the character model
      const source = Character.sources[config.model]
      if (source === 'none' || !source) return

      const gltfModel = preloader.get(source)
      if (!gltfModel) return

      // Set the default actions.
      if (!config.action) {
        config.action = Character.defaultActions[config.model]

        if (!config.action) {
          console.error(`invalid default action for ${config.model}`)

          console.log(
            'defaults:',
            gltfModel.animations.map((a) => a.name).join(', '),
          )
        }
      }

      if (!this.scene || !this.params) return

      let skinnedMesh: SkinnedMesh | null = {} as unknown as SkinnedMesh

      gltfModel.scene.traverse((o) => {
        if (o instanceof SkinnedMesh) {
          o.castShadow = true

          // disables frustum culling as it clips the character
          o.frustumCulled = false

          if (o.material instanceof MeshStandardMaterial) {
            o.material.wireframe = false
            o.material.roughness = 0.2
            o.material.metalness = 0.9
          }

          if ($currentScene.get() === 'ENDING') {
            // o.material = new MeshBasicMaterial({ color: 0x000000 })
          }

          skinnedMesh = o
        }
      })

      if (!skinnedMesh) return

      if (!this.options.freezeParams) {
        this.ik = new IKManager(skinnedMesh)

        if (DEBUG_SKELETON) {
          const ikHelper = this.ik.ik.createHelper()
          this.scene.add(ikHelper)
        }
      }

      this.model = gltfModel.scene

      this.scene.add(this.model)

      // Adjust character scale
      const scale = config.scale
      this.model.scale.set(scale, scale, scale)

      const [x, y, z] = config.position
      this.model.position.set(x, y, z)

      if (DEBUG_SKELETON) {
        const rootBone = skinnedMesh.skeleton.bones?.[0]?.parent

        if (!rootBone) {
          console.error('root bone not found in skeleton')
          return
        }

        this.skeletonHelper = new SkeletonHelper(rootBone!)

        const skeletonMaterial = this.skeletonHelper
          .material as LineBasicMaterial
        skeletonMaterial.linewidth = 10
        this.scene.add(this.skeletonHelper)
      }

      // Create individual animation mixer
      this.mixer = new THREE.AnimationMixer(this.model)
      this.mixer.timeScale = this.params.timescale

      this.mixer.addEventListener('loop', this.onLoopEnd.bind(this))

      const clips: AnimationClip[] = gltfModel.animations

      for (const clip of clips) {
        // Process the individual animation clips.
        this.processClip(clip)

        // Register the animation clip as character actions.
        const action = this.mixer.clipAction(clip)
        this.actions.set(clip.name, action)
      }

      // Signal that the animation has been loaded.
      this.handlers.animationLoaded?.(this)
      this.frameCounter = 0

      // Play the first animation
      this.updateAction()

      // Initialize bone rotation manager
      this.boneRotation = new BoneRotationManager(this)

      console.log('>>> setup completed')
    } catch (error) {
      if (error instanceof Error) {
        console.error('character setup failed.', error)
      }
    }
  }

  onLoopEnd = () => {
    if (!this.mixer) return

    this.frameCounter = 0
    this.mixer.setTime(0)
  }

  createDebugSphere(color = 0xff0000) {
    const geometry = new THREE.SphereGeometry(15, 32, 16)
    const material = new THREE.MeshBasicMaterial({ color })

    return new THREE.Mesh(geometry, material)
  }

  updateSphereFromBone(sphere?: Mesh, bone?: Bone) {
    if (!bone || !sphere) return

    bone.getWorldPosition(sphere.position)
    bone.getWorldQuaternion(sphere.quaternion)
  }

  updateAction() {
    const config = this.options

    // If we did not define the proper default action, fallback to the first action.
    if (!config.action) {
      this.play(this.actionList[0])
      return
    }

    if (!this.actions.has(config.action)) {
      console.log('all actions:', this.actions)
      console.error(`${config.model}: ${config.action} missing!`)
      return
    }

    const action = this.actions.get(config.action)
    if (!action) return

    this.play(action)
  }

  processClip(clip: AnimationClip) {
    const { lengthen, freezeParams } = this.options

    // Update the global duration store
    if (this.isPrimary) $duration.set(clip.duration)

    // Make keyframes track longer for track-level looping.
    if (lengthen > 0) {
      for (let i = 0; i < lengthen; i++) {
        lengthenKeyframeTracks(clip.tracks)
      }

      console.log(`-- keyframe track lengthened by ${lengthen} times`)
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
    const { action } = this.options
    if (!action) return

    const sources = this.original.get(action)
    if (!sources) return

    return sources[index]
  }

  /**
   * Sync with lockPosition parameter with the keyframe values.
   *
   * If the position is passed in, we override the entire keyframe with the given (x, y, z) values.
   */
  syncPositionLock(clip: AnimationClip, position?: [number, number, number]) {
    if (!this.params || !this.params.lockPosition) return

    for (const track of clip.tracks) {
      if (track.name !== 'Hips.position') continue

      if (!position) {
        track.values.fill(0)
        break
      }

      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = position[0]
        track.values[i + 1] = position[1]
        track.values[i + 2] = position[2]
      }

      break
    }
  }

  /**
   * !! HACK: revert hips position to the original keyframe values.
   */
  forceRestoreHipsPosition() {
    const clip = this.currentClip
    if (!clip) return

    const sources = this.original.get(clip.name)
    if (!sources) return

    clip.tracks.forEach((track, index) => {
      if (track.name !== 'Hips.position') return

      track.values = sources[index].values
    })

    this.cutToClip(clip)
  }

  /**
   * Update animation parameters.
   */
  updateParams(flags: UpdateParamFlags = { timing: true }) {
    const start = performance.now()

    const clip = this.currentClip
    if (!clip || !this.params) return

    if (flags.axisPoint) {
      const frequency = this.params.axisPoint.frequency

      const isCircleAndCurveActive =
        Object.values(this.params.curve.parts).some((x) => !!x) &&
        this.params.curve.equation !== 'none'

      const isAxisPointVisiblyActive = frequency && frequency >= 0.05

      // If BOTH axis point and circle and curve is active,
      // we want to clear the altered track.
      if (isAxisPointVisiblyActive && isCircleAndCurveActive) {
        clip.tracks.forEach((track, index) => {
          const original = this.originalOf(index)
          if (!original) return

          // clear the altered track, please.
          track.values = original.values.slice(0)
        })
      }

      if (frequency <= 0) {
        this.boneRotation?.stop()
      } else {
        this.boneRotation?.start()
      }

      return
    }

    const { freezeParams } = this.options

    if (freezeParams) {
      // erase the positioning data - even for frozen characters
      this.syncPositionLock(clip)

      return
    }

    const _curve: {
      equation: Transform
      axis: Axis[]
      tracks: number[]
    } = { equation: () => [], axis: [], tracks: [] }

    if (flags.curve) {
      const { equation } = this.params.curve

      if (equation && equation !== 'none') {
        _curve.equation = transformers[equation]
      } else if (equation === 'none') {
        _curve.equation = (v) => v
      }

      _curve.axis = this.curveConfig.axis
      _curve.tracks = this.query(...this.curveConfig.tracks)
    }

    // Lock and unlock hips position.
    this.syncPositionLock(clip)

    clip.tracks.forEach((track, index) => {
      // Reset the keyframe times.
      const original = this.originalOf(index)
      if (!original || !this.params) return

      if (freezeParams) return

      // Reset the keyframe values when circle and curve formula changes.
      if (flags.curve || flags.axisPoint) {
        if (this.params.lockPosition && track.name !== 'Hips.position') {
          // Apply the existing keyframe values to all tracks.
          track.values = original.values.slice(0)
        }
      }

      if (flags.timing) {
        // Reset the keyframe times.
        track.times = original.timings.slice(0)

        // Override energy.
        const part = trackNameToPart(track.name, 'core')
        if (!part || !this.mixer) return

        const time = this.mixer.time

        // Override delays
        overrideDelay(track, this.params.delays, time)

        const energy = this.params.energy[part as EnergyPartKey]
        overrideEnergy(track, energy, time, part as EnergyPartKey)
      }

      // Override rotation only
      // TODO: support individual body parts' rotation!
      if (flags.rotation) {
        overrideRotation(track, this.params.rotations, original.eulers)
      }

      // Override curve only
      const isCurve =
        flags.curve &&
        _curve.tracks.includes(index) &&
        track.name.includes('quaternion')

      const isAxisPointNotEnabled =
        !this.params.axisPoint.frequency ||
        this.params.axisPoint.frequency < 0.05

      if (isCurve && _curve.equation && isAxisPointNotEnabled) {
        track.values = applyTrackTransform(track, _curve.equation, {
          axis: _curve.axis,
          tracks: _curve.tracks,
          threshold: this.params.curve.threshold,
        })
      }

      clip.tracks[index] = track
    })

    // External body space is always applied for timing changes.
    if (flags.timing) {
      perf.ebs(() => {
        if (!this.params) return

        const key = ebsCache.key(this)

        clip.tracks = applyExternalBodySpace(
          clip.tracks,
          this.params.space,
          key,
        )
      })
    }

    // Use different duration and warp parameters for different parameter changes.
    if (flags.timing && !flags.withEnergy) {
      this.fadeIntoModifiedAction(clip, 0.6, false)
    } else if (flags.withEnergy) {
      this.fadeIntoModifiedAction(clip, 2, true)
    } else {
      this.fadeIntoModifiedAction(clip, 1, true)
    }

    const time = (performance.now() - start).toFixed(2)
    console.log(`> character param update took ${time}ms`)
  }

  get curveConfig(): { tracks: Matcher[]; axis: Axis[] } {
    const c = this.params?.curve
    if (!c) return { tracks: [], axis: [] }

    const tracks = Object.entries(c.parts)
      .filter(([, v]) => v === true)
      .map(([p]) => curveParts[p as CurvePartKey])

    const axis = Object.entries(c.axes)
      .filter(([, v]) => v === true)
      .map(([k]) => k) as Axis[]

    return { tracks, axis }
  }

  fadeIntoModifiedAction(clip: THREE.AnimationClip, duration = 1, warp = true) {
    if (!this.mixer) return

    const prevAction = this.actions.get(clip.name)
    if (!prevAction) return

    const action = this.mixer.clipAction(clip.clone())
    this.actions.set(clip.name, action)

    action.time = prevAction.time
    prevAction.crossFadeTo(action, duration, warp)
    action.play()

    // Note: Uncaching is not needed. Memory is automatically cleared when scenes change
    // via the teardown/setup cycle. Attempting to uncache during playback causes t-pose
    // issues due to Three.js internal state corruption with shared clip/root references.
  }

  async reset() {
    if (!this.params) return

    console.log('>>> Resetting character!')
    const config = this.params.characters[this.options.name]

    if (config) {
      this.options.model = config.model
      this.options.action = config.action ?? null
    }

    if (!config) {
      console.warn(`this character does not have a parametric configuration!`)
    }

    await this.setup()
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

  /** Tick the animation rendering */
  tickRender(delta: number) {
    if (!this.mixer) return

    this.frameCounter++

    // Remove previous bone offsets before mixer update to prevent accumulation
    if (this.boneRotation?.isPostureActive) {
      this.removeBoneOffsets()
    }

    this.mixer.update(delta)

    // Apply real-time bone rotations after animation update
    if (this.boneRotation?.isPostureActive) {
      this.boneRotation.updateRotations(delta)
      this.applyBoneOffsets()
    }

    // Tick business logic every nth frames
    if (this.frameCounter % NTH_FRAME_TICK === 0) {
      // Reset the model time if it exceeds the playback
      const resetLimit = resetLimits[this.options.model]

      if (resetLimit && this.mixer.time > resetLimit) {
        this.mixer.setTime(0)
      }

      // Update the global animation time
      if (this.isPrimary) {
        $time.set(this.mixer.time ?? 0)
      }
    }
  }

  /**
   * Remove bone rotation offsets before mixer update to prevent accumulation
   * This is necessary because energy modifications can cause mixer to skip bone updates
   */
  removeBoneOffsets() {
    if (!this.model) return

    this.model.traverse((child) => {
      if ((child as Bone).isBone || child.type === 'Bone') {
        const bone = child as Bone

        // Remove fixed rotation offsets
        if (bone.rotationOffset) {
          bone.rotation.x -= bone.rotationOffset.x
          bone.rotation.y -= bone.rotationOffset.y
          bone.rotation.z -= bone.rotationOffset.z
        }

        // Remove random rotation offsets
        if (bone.randomRotationOffset) {
          bone.rotation.x -= bone.randomRotationOffset.x
          bone.rotation.y -= bone.randomRotationOffset.y
          bone.rotation.z -= bone.randomRotationOffset.z
        }
      }
    })
  }

  /**
   * Apply bone rotation offsets - ported from HTML prototype
   * This applies the rotationOffset to each bone after the animation update
   */
  applyBoneOffsets() {
    if (!this.model) return

    this.model.traverse((child) => {
      if ((child as Bone).isBone || child.type === 'Bone') {
        const bone = child as Bone

        // Apply fixed rotation offsets
        if (bone.rotationOffset) {
          bone.rotation.x += bone.rotationOffset.x
          bone.rotation.y += bone.rotationOffset.y
          bone.rotation.z += bone.rotationOffset.z
        }

        // Apply random rotation offsets (for random arm pointing) - matching HTML prototype
        if (bone.randomRotationOffset) {
          bone.rotation.x += bone.randomRotationOffset.x
          bone.rotation.y += bone.randomRotationOffset.y
          bone.rotation.z += bone.randomRotationOffset.z
        }
      }
    })
  }

  /**
   * Start the real-time bone rotation posture system
   */
  startPostures() {
    this.boneRotation?.start()
  }

  /**
   * Stop the real-time bone rotation posture system
   */
  stopPostures() {
    this.boneRotation?.stop()
  }

  /**
   * Check if postures are currently active
   */
  get posturesActive(): boolean {
    return this.boneRotation?.isPostureActive ?? false
  }

  /**
   * Get the current posture name
   */
  get currentPostureName(): string {
    return this.boneRotation?.currentPostureName ?? 'None'
  }

  async startFade() {
    if (this.isPrimary) {
      await this.handlers.fade('out')
    } else {
      // ? compensate for the fade-out delay
      await delay(500)
    }
  }

  async endFade() {
    if (this.isPrimary) this.handlers.fade('in').then()
  }

  // !! HACK: immediately cut to this clip, without cross-fading.
  cutToClip(clip: AnimationClip, offset = 0) {
    if (!this.mixer) return

    const prevAction = this.actions.get(clip.name)!
    const action = this.mixer.clipAction(clip.clone())
    this.actions.set(clip.name, action)

    action.time = prevAction.time + offset
    prevAction.stop()
    action.play()

    // Note: No uncaching needed - see fadeIntoModifiedAction comment above
  }

  /**
   * Warmup caches for External Body Space
   */
  prepareExternalBodySpaceCache() {
    console.log('>>> prepareExternalBodySpaceCache', { options: this.options })

    const tracks = this.currentClip!.tracks
    const key = ebsCache.key(this)

    // Averages took around 50ms to compute
    ebsCache.averages(tracks, key)
  }
}

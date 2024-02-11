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
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

import { KeyframeAnalyzer } from './analyze'
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
  applyHipsPositionLock,
  overrideDelay,
  overrideEnergy,
  overrideRotation,
  Params,
} from './overrides'
import {
  AxisPointControlParts,
  CurvePartKey,
  curveParts,
  EnergyPartKey,
  trackNameToPart,
} from './parts'
import { profile } from './perf'
import { $currentScene } from './store/scene'
import { $duration, $time } from './store/status'
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
  rotation?: boolean
  axisPoint?: boolean
}

const loader = new GLTFLoader()

// Attach a profiler
const p = {
  ebs: profile('external body space', 20),
}

export type ModelKey = keyof typeof Character.sources
export type CharacterKey = keyof typeof Params.prototype.characters

export const resetLimits: Partial<Record<ModelKey, number>> = {
  terry: 160,
  changhung: 300,
  yokrob: 202,
  yokroblingImprovise: 220,
}

// Ending scene's shadow visible time
const SHADOW_VISIBLE_TIME = 84.5

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
}

type DebugSpheres = { forehead?: Mesh; neck?: Mesh; body?: Mesh }

type AnimationFlags = {
  shadowVisible: boolean
}

const DEBUG_SKELETON = false

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

  flags: AnimationFlags = {
    shadowVisible: false,
  }

  frameCounter = 0

  debugSpheres: DebugSpheres = {}

  options: CharacterOptions = {
    name: 'first',
    action: '',
    model: 'waiting',
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

    // awesome solo dances
    terry: 'terry.glb',
    changhung: 'changhung.glb',
    yokrob: 'YOKROB.glb',
    yokroblingImprovise: 'YOKROBlingimprovise.glb',

    waiting: 'subinwaiting.glb',

    // scene 3's pichet-s
    pichetGen: 'PichetGen.glb',
    pichetMaster: 'PichetMaster.glb',
    pichetGenBlack: 'PichetGenBlack.glb',
  }

  static defaultActions: Record<ModelKey, string> = {
    none: '',
    abstract: 'no.33_.',
    robot: 'no.33_..001',
    abstract57: 'no57_Tas',
    kukpat: 'kukpat_Tas',
    tranimid: 'tranimid_Tas',

    // animation track names for solo dances
    terry: 'terry_chr02',
    changhung: 'Changhung002_chr02',
    yokrob: 'yokrobling_Tas',
    yokroblingImprovise: 'yokroblingimprovised_chr02.001',

    waiting: 'sit002_Tas.001',

    pichetGen: 'PIchetGen',
    pichetMaster: 'Pichet003_chr02.001',
    pichetGenBlack: 'Pichet003_chr02.001|Pichet003_chr02|Pichet003_chr02.001',
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

  handlers: Handlers = {
    animationLoaded: () => {},
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
    const config = this.options

    if (scene) this.scene = scene
    if (params) this.params = params

    // Ensure that there is no stale data
    this.teardown()

    if (config.model === 'none') return

    // Get the model url based on the character model
    const url = `/models/${Character.sources[config.model]}`
    if (url === 'none' || !url) return

    const gltfModel = await loader.loadAsync(url)

    // Set the default actions.
    if (!config.action) {
      config.action = Character.defaultActions[config.model]

      if (!config.action) {
        console.error(`invalid default action for ${config.model}`)
      }
    }

    if (!this.scene || !this.params) return

    let skinnedMesh: SkinnedMesh | null = {} as unknown as SkinnedMesh

    gltfModel.scene.traverse((o) => {
      if (o instanceof SkinnedMesh) {
        o.castShadow = true

        // if scene two, then make it invisible
        const isEnding = $currentScene.get() === 'ENDING'

        if (isEnding && this.options.name === 'second') {
          o.visible = false
        }

        if (o.material instanceof MeshStandardMaterial) {
          o.material.wireframe = false
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

      const skeletonMaterial = this.skeletonHelper.material as LineBasicMaterial
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

    // Lock the position.
    // NOTE: the "lockPosition" field is not really required.
    this.updateParams()

    console.log('>>> setup completed')
  }

  onLoopEnd = () => {
    if (!this.mixer) return

    this.frameCounter = 0
    this.mixer.setTime(0)

    console.info('--- we have looped ---')
  }

  createDebugSphere(color = 0xff0000) {
    const geometry = new THREE.SphereGeometry(15, 32, 16)
    const material = new THREE.MeshBasicMaterial({ color })

    return new THREE.Mesh(geometry, material)
  }

  // addBoneSphere(bone: Bone, color = 0xff0000) {
  //   const size = 0.003
  //   sphere.scale.set(size, size, size)

  //   this.updateSphereFromBone(sphere, bone)
  //   this.scene?.add(sphere)

  //   return sphere
  // }

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
   * Update animation parameters.
   */
  updateParams(flags: UpdateParamFlags = { timing: true }) {
    const clip = this.currentClip
    if (!clip || !this.params) return

    const { freezeParams } = this.options

    if (freezeParams) {
      applyHipsPositionLock(this.params, clip)
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

    clip.tracks.forEach((track, index) => {
      // Reset the keyframe times.
      const original = this.originalOf(index)
      if (!original || !this.params) return

      // Lock and unlock hips position hips position.
      applyHipsPositionLock(this.params, clip)

      if (freezeParams) return

      // Reset the keyframe values when circle and curve formula changes.
      if (flags.curve || flags.axisPoint) {
        if (this.params.lockPosition && track.name !== 'Hips.position') {
          // Apply the existing keyframe values to all tracks.
          track.values = original.values.slice(0)
        }
      }

      if (flags.axisPoint) {
        const { parts } = this.params.axisPoint
        const part = trackNameToPart(track.name, 'axis')

        if (part) {
          const enabled = parts[part as AxisPointControlParts]

          if (enabled) {
            const time = this.mixer?.time ?? 1
            const len = track.times.length - 1
            const frame = Math.round((time / track.times[len]) * len)
            const data = track.values.slice(frame * 4, frame * 4 + 4)

            // Modify the entire keyframe values to this moment in time.
            for (let i = 0; i < track.values.length; i += 4) {
              let j = 0

              track.values[i] = data[j++]
              track.values[i + 1] = data[j++]
              track.values[i + 2] = data[j++]
              track.values[i + 3] = data[j++]
            }
          }
        }
      }

      if (flags.timing) {
        // Reset the keyframe times.
        track.times = original.timings.slice(0)

        // Override energy.
        const part = trackNameToPart(track.name, 'core')
        if (!part || !this.mixer) return

        // Override delays
        overrideDelay(track, this.params.delays, this.mixer.time)

        const energy = this.params.energy[part as EnergyPartKey]
        overrideEnergy(track, energy)
      }

      // Override rotation only
      // TODO: support individual body parts' rotation!
      if (flags.rotation) {
        overrideRotation(track, this.params.rotations, original.eulers)
      }

      // Override curve only
      if (flags.curve && _curve.tracks.includes(index) && _curve.equation) {
        // debugger

        track.values = applyTrackTransform(track, _curve.equation, {
          axis: _curve.axis,
          tracks: _curve.tracks,
          threshold: this.params.curve.threshold,
        })
      }

      clip.tracks[index] = track
    })

    if (flags.axisPoint && this.ik) {
      this.ik.setPartMorph(this.params.axisPoint)
    }

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
      .filter(([, v]) => v === true)
      .map(([p]) => curveParts[p as CurvePartKey])

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
    prevAction.crossFadeTo(action, 3, true)
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

    this.options.model = config.model
    this.options.action = config.action ?? null

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
    options: Omit<TransformOptions, 'tracks'> & { tracks: Matcher | Matcher[] },
  ) {
    let tracks: number[]
    if (this.options.freezeParams) return

    if (options.tracks) {
      const _tracks = Array.isArray(options.tracks)
        ? options.tracks
        : [options.tracks]

      // Query the track ids.
      tracks = this.query(..._tracks)
    }

    const isKey = typeof transform === 'string'
    const name = isKey ? transform : transform.name

    const transformer = isKey
      ? transformers[transform as TransformKey]
      : transform

    if (!transformer) return

    console.log(`> applying ${name} transform`, options)

    const clip = this.currentClip
    if (!clip) return

    clip.tracks.forEach((track, id) => {
      if (!transformer) return

      // Exclude the tracks that does not match.
      if (options.tracks && !tracks?.includes(id)) return

      // Apply the transform to each track.
      const values = applyTrackTransform(track, transformer, {
        ...options,
        tracks,
      })

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

  setVisible(visible: boolean) {
    this.flags.shadowVisible = visible

    if (!this.model) return

    this.model.traverse((o) => {
      if (o instanceof SkinnedMesh) {
        o.visible = visible
      }
    })
  }

  /** Tick the animation rendering */
  tickRender(delta: number) {
    if (!this.mixer) return

    // account for FPS ~ should use real frames?
    // derive from FPS?
    this.frameCounter++
    this.mixer.update(delta)

    // Reset the model time if it exceeds the playback
    const resetLimit = resetLimits[this.options.model]
    if (resetLimit && this.mixer.time > resetLimit) this.mixer.setTime(0)

    // Update the global animation time
    if (this.isPrimary) $time.set(this.mixer.time ?? 0)

    // TODO: inverse kinematics tick

    // scene 3 -
    if (this.flags.shadowVisible && this.mixer.time <= SHADOW_VISIBLE_TIME) {
      this.setVisible(false)
    }

    // scene 3 -
    if (!this.flags.shadowVisible) {
      const isEnding = $currentScene.get() === 'ENDING'

      const shouldActivate =
        isEnding &&
        this.options.name === 'second' &&
        this.mixer.time > SHADOW_VISIBLE_TIME

      if (shouldActivate) {
        this.setVisible(true)
      }
    }
  }
}

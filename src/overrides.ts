import * as THREE from 'three'
import { Euler, KeyframeTrack, QuaternionKeyframeTrack } from 'three'

import { Character, ModelKey } from './character'
import {
  AxisPointControlParts,
  CurvePartKey,
  DelayPartKey,
  EnergyPartKey,
  trackNameToPart,
} from './parts'
import { TransformKey } from './transforms'

export interface CurveConfig {
  parts: Record<CurvePartKey, boolean>
  equation: TransformKey | 'none'
  axes: { x: boolean; y: boolean; z: boolean }
  threshold: number
  dirty: boolean
}

type CharacterOptions = Record<
  string,
  { model: ModelKey; action: string | null }
>

export interface SpaceConfig {
  /** Slow down the movement for the entire valley for X seconds. */
  delay: number

  /** Ignore changes below this threshold. */
  threshold: number

  /** Ignore region of change smaller than this window. */
  minWindow: number

  /** The window size to calculate the averages. */
  windowSize: number
}

export interface AxisPointConfig {
  threshold: number
  parts: Record<AxisPointControlParts, boolean>
}

export interface ArmDebugConfig {
  upperarm: { x: number; y: number; z: number }
  forearm: { x: number; y: number; z: number }
  hand: { x: number; y: number; z: number }
}

export interface PostureDebugConfig {
  enabled: boolean
  leftArm: ArmDebugConfig
  rightArm: ArmDebugConfig
}

export class Params {
  time = 0
  timescale = 1
  paused = false
  lockPosition = true
  showGraph = false
  camera = 'front'

  /** External body space */
  space: SpaceConfig = {
    delay: 0,
    threshold: 0.2,
    minWindow: 8,
    windowSize: 50,
  }

  curve: CurveConfig = {
    parts: {
      head: false,
      body: false,
      leftArm: true,
      rightArm: true,
      leftLeg: true,
      rightLeg: true,
    },

    axes: {
      x: true,
      y: true,
      z: true,
    },

    equation: 'none',
    threshold: -2,

    dirty: false,
  }

  rotations = {
    x: 1,
    y: 1,
    z: 1,
  }

  energy: Record<EnergyPartKey, number> = {
    upper: 1,
    lower: 1,
  }

  delays: Record<DelayPartKey, number> = {
    left: 0,
    right: 0,
    body: 0,
  }

  axisPoint: AxisPointConfig = {
    threshold: 0,

    parts: {
      leftArm: true,
      rightArm: false,
      leftLeg: false,
      rightLeg: false,
    },
  }

  characters: CharacterOptions = {
    first: {
      model: 'waiting',
      action: '',
    },
    second: {
      model: 'waiting',
      action: '',
    },
  }

  postureDebug: PostureDebugConfig = {
    enabled: false,
    leftArm: {
      upperarm: { x: 0, y: 0, z: 0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
    rightArm: {
      upperarm: { x: 0, y: 0, z: 0 },
      forearm: { x: 0, y: 0, z: 0 },
      hand: { x: 0, y: 0, z: 0 },
    },
  }

  // ! HACK: temporary reactivity hack. TO REMOVE!
  reset() {
    const defaults = new Params()

    this.timescale = defaults.timescale
    this.space.delay = defaults.space.delay
    this.space.threshold = defaults.space.threshold
    this.curve.axes.x = defaults.curve.axes.x
    this.curve.axes.y = defaults.curve.axes.y
    this.curve.axes.z = defaults.curve.axes.z
    this.curve.parts.body = defaults.curve.parts.body
    this.curve.parts.head = defaults.curve.parts.head
    this.curve.parts.leftArm = defaults.curve.parts.leftArm
    this.curve.parts.leftLeg = defaults.curve.parts.leftLeg
    this.curve.parts.rightArm = defaults.curve.parts.rightArm
    this.curve.parts.rightLeg = defaults.curve.parts.rightLeg
    this.curve.equation = defaults.curve.equation
    this.curve.threshold = defaults.curve.threshold
    this.curve.dirty = defaults.curve.dirty
    this.rotations.x = defaults.rotations.x
    this.rotations.y = defaults.rotations.y
    this.rotations.z = defaults.rotations.z
    this.energy.lower = defaults.energy.lower
    this.energy.upper = defaults.energy.upper
    this.delays.body = defaults.delays.body
    this.delays.left = defaults.delays.left
    this.delays.right = defaults.delays.right
    this.axisPoint.parts.leftArm = defaults.axisPoint.parts.leftArm
    this.axisPoint.parts.rightArm = defaults.axisPoint.parts.rightArm
    this.axisPoint.parts.leftLeg = defaults.axisPoint.parts.leftLeg
    this.axisPoint.parts.rightLeg = defaults.axisPoint.parts.rightLeg
    this.axisPoint.threshold = defaults.axisPoint.threshold
  }
}

/** Scale up or down keyframe tracks. */
export function overrideEnergy(
  track: KeyframeTrack,
  factor = 1,
  time: number,
  part: EnergyPartKey,
) {
  // if energy is 1.0, we don't need to do anything
  if (factor === 1.0) return track

  if (
    track instanceof THREE.VectorKeyframeTrack &&
    track.name.includes('position')
  ) {
    // if energy is 0.0, freeze the track
    if (factor < 0.05 && part === 'lower') {
      const size = track.getValueSize()

      const len = track.times.length - 1
      const frame = Math.round((time / track.times[len]) * len)
      const data = track.values.slice(frame * size, frame * size + size)

      const [x, y, z] = data

      for (let i = 0; i < track.values.length; i += size) {
        track.values[i] = x
        track.values[i + 1] = y
        track.values[i + 2] = z
      }
    }

    return track
  }

  track.times = track.times.map((t) => {
    let f = factor

    if (part === 'upper') {
      if (f < 0.05) f = 0.05
    }

    const value = t / f
    if (isNaN(value)) return t

    return value
  })
}

export function overrideRotation(
  track: KeyframeTrack,
  config: { x: number; y: number; z: number },
  base: Euler[],
) {
  if (!(track instanceof QuaternionKeyframeTrack)) return

  const size = track.getValueSize()

  track.times.forEach((_, i) => {
    const euler = base[i].clone()

    // Apply the new rotation to the target.
    euler.x *= config.x
    euler.y *= config.y
    euler.z *= config.z

    new THREE.Quaternion().setFromEuler(euler).toArray(track.values, i * size)
  })
}

export function overrideDelay(
  track: KeyframeTrack,
  config: Record<string, number>,
  currentTime: number,
) {
  const part = trackNameToPart(track.name, 'delay')
  if (!part) return

  const param = config[part] ?? 0
  const offset = (-currentTime / 100) * param

  if (offset < 0) track.shift(offset)
}

class EBSCache {
  private cache: Map<string, number[]> = new Map()

  averages(tracks: KeyframeTrack[], key: string) {
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }

    const start = performance.now()
    const timing = tracks[0].times

    const values = [...timing].map((_, frame) => {
      const sums = tracks.map((track) => {
        if (!(track instanceof THREE.QuaternionKeyframeTrack)) return 0

        const size = track.getValueSize()

        let sum = 0
        for (let axis = 0; axis < size; axis++) {
          const num = Math.abs(track.values[frame * size + axis])
          sum += !isNaN(num) ? num : 0
        }

        // Average of quaternion x/y/z/w values
        return sum / size
      })

      return sums.reduce((a, b) => a + b, 0) / sums.length
    })

    this.cache.set(key, values)

    const time = (performance.now() - start).toFixed(2)
    console.log(`> timing average cache took ${time}ms`)

    return values
  }

  key(c: Character) {
    return `${c.options.name}-${c.options.model}`
  }
}

export const ebsCache = new EBSCache()

function cappedNormalize(arr: number[], threshold: number) {
  const maxBelowThreshold = Math.max(
    ...arr.filter((value) => value <= threshold),
  )

  const arrCapped = arr.map((value) =>
    value > threshold ? maxBelowThreshold : value,
  )

  const minVal = Math.min(...arrCapped)
  const maxVal = Math.max(...arrCapped)

  const normalizedArr = arrCapped.map(
    (value) => (value - minVal) / (maxVal - minVal),
  )

  return normalizedArr
}

function padValley(original: [start: number, end: number][], x: number) {
  const result: [start: number, end: number][] = []
  let currentIntervalStart = 0

  for (const [start, end] of original) {
    // Add valleys at intervals x
    while (currentIntervalStart + x < start) {
      result.push([currentIntervalStart + x, currentIntervalStart + x + 3])
      currentIntervalStart += x + 3
    }

    // Add the original valley
    result.push([start, end])
    currentIntervalStart = end
  }

  // Add any remaining valleys at the end
  while (currentIntervalStart + x < original[original.length - 1]?.[1]) {
    result.push([currentIntervalStart, currentIntervalStart + x])
    currentIntervalStart += x
  }

  return result
}

function detectValleys(array: number[], threshold: number, minWindow: number) {
  const t = threshold / 100

  const valleys: [start: number, end: number][] = []
  let startIdx = 0

  for (let i = 1; i < array.length; i++) {
    const diff = array[i] - array[i - 1]

    if (Math.abs(diff) - t <= 0) {
      continue
    } else {
      if (i - startIdx > minWindow) {
        valleys.push([startIdx, i - 1])
      }
      startIdx = i
    }
  }

  if (array.length - startIdx > minWindow) {
    valleys.push([startIdx, array.length - 1])
  }

  return valleys
}

export function applyExternalBodySpace(
  tracks: KeyframeTrack[],
  options: typeof Params.prototype.space,
  key: string,
): THREE.KeyframeTrack[] {
  const { delay, threshold, minWindow } = options ?? {}

  // Do not compute anything if the delay is zero.
  if (delay === 0) return tracks

  // TODO: cache the average value for a HUGE speedup!
  const averages = ebsCache.averages(tracks, key)

  // Valleys in a graph with low change.
  const valleys: [start: number, end: number][] = padValley(
    detectValleys(cappedNormalize(averages, 0.05), threshold, minWindow),
    Math.floor(100 * (1 - threshold)),
  )

  // Every track must apply the same rotation freeze.
  tracks.forEach((track) => {
    // apply it to rotations and hips position
    // ! character will float in the air if hips position is not adjusted
    const isTargetTrack =
      track instanceof QuaternionKeyframeTrack || track.name === 'Hips.position'

    if (!isTargetTrack) return

    // Pre-compute Sets for fast existence checks
    const startFramesSet = new Set(valleys.map(([start]) => start))
    const endFramesSet = new Set(valleys.map(([, end]) => end))

    // Create a Map for direct frame-to-valley mapping
    const frameToValleyMap = new Map(
      valleys.map(([start, end]) => [start, [start, end]]),
    )

    // Current region's delay offset.
    let delayPerFrame = 0

    // Total accumulated delay from previous delay regions.
    let globalDelay = 0

    // Are we currently adjusting the delay?
    let shouldAdjust = true

    track.times.forEach((_, frame) => {
      if (endFramesSet.has(frame)) {
        shouldAdjust = false
        globalDelay += delay
        delayPerFrame = 0
      }

      // Increase the offset if the frame is a start frame.
      if (startFramesSet.has(frame)) {
        const valley = frameToValleyMap.get(frame)
        if (!valley) return

        const [start, end] = valley
        const numFrames = Math.abs(end - start)

        delayPerFrame = delay / numFrames
        shouldAdjust = true
      }

      let offset = globalDelay
      if (shouldAdjust) offset += delayPerFrame

      // Apply the timing offset for each frame.
      track.times[frame] += offset
    })
  })

  return tracks
}

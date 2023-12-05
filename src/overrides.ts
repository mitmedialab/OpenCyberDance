import * as THREE from 'three'
import { Euler, KeyframeTrack, QuaternionKeyframeTrack } from 'three'

import {
  CorePartKey,
  CurvePartKey,
  DelayPartKey,
  trackNameToPart,
} from './parts'
import { TransformKey } from './transforms'

interface CurveConfig {
  parts: Record<CurvePartKey, boolean>
  equation: TransformKey | 'none'
  axes: { x: boolean; y: boolean; z: boolean }
  threshold: number
  dirty: boolean
}

export class Params {
  time = 0
  timescale = 1
  paused = false
  lockPosition = false
  showGraph = true
  camera = 'front'

  /** External body space */
  space = {
    /** Slow down the movement for the entire valley for X seconds. */
    delay: 0,

    /** Ignore changes below this threshold. */
    threshold: 0.005,

    /** Ignore region of change smaller than this window. */
    minWindow: 3,

    /** The window size to calculate the averages. */
    windowSize: 30,
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
      y: false,
      z: false,
    },

    equation: 'none',
    threshold: 1,

    dirty: false,
  }

  rotations = {
    x: 1,
    y: 1,
    z: 1,
  }

  energy: Record<CorePartKey, number> = {
    head: 1,
    body: 1,
    foot: 1,
  }

  delays: Record<DelayPartKey, number> = {
    head: 0,
    body: 0,
    leftArm: 0,
    rightArm: 0,
    leftLeg: 0,
    rightLeg: 0,
  }

  characters = {
    first: {
      model: 'abstract',
      action: '',
    },
    second: {
      model: 'abstract',
      action: '',
    },
  }
}

/** Scale up or down keyframe tracks. */
export function overrideEnergy(track: KeyframeTrack, factor = 1) {
  track.times = track.times.map((t) => {
    if (factor === 1) return t

    const value = t / factor
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
) {
  const part = trackNameToPart(track.name, 'delay')
  if (!part) return

  const offset = config[part] ?? 0
  if (offset > 0) track.shift(offset)
}

export function applyExternalBodySpace(
  tracks: KeyframeTrack[],
  options: typeof Params.prototype.space,
): THREE.KeyframeTrack[] {
  const { delay, threshold, minWindow, windowSize } = options ?? {}

  // Do not compute anything if the delay is zero.
  if (delay === 0) return tracks

  const timing = tracks[0].times

  // TODO: cache the average value for a HUGE speedup!
  const averages = [...timing].map((_, frame) => {
    const sums = tracks.map((track) => {
      const size = track.getValueSize()

      let sum = 0
      for (let axis = 0; axis < size; axis++) {
        sum += Math.abs(track.values[frame * size + axis])
      }

      // Average of quaternion x/y/z/w values
      return sum / size
    })

    return sums.reduce((a, b) => a + b, 0) / sums.length
  })

  // Valleys in a graph with low change.
  const valleys: [start: number, end: number][] = []

  let windowStart = 0
  let windowEnd = windowSize - 1

  while (windowEnd < averages.length) {
    const w = averages.slice(windowStart, windowEnd + 1)

    const diffs = w.map((v, i) => {
      return i < windowSize - 1 ? w[i + 1] - v : 0
    })

    // Check if all differences in the window are below the threshold
    const isValley =
      diffs.every((diff) => Math.abs(diff) <= threshold) &&
      windowEnd - windowStart >= minWindow

    // Consider these regions as no-change regions
    if (isValley) valleys.push([windowStart, windowEnd])

    // Move the window to the next non-overlapping position
    windowStart += windowSize
    windowEnd += windowSize
  }

  // Every track must apply the same rotation freeze.
  tracks.forEach((track, ti) => {
    // Only apply external body space for rotations
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) return

    const startFrames = valleys.map(([start]) => start)
    const endFrames = valleys.map(([start]) => start)

    // Current region's delay offset.
    let delayPerFrame = 0

    // Total accumulated delay from previous delay regions.
    let globalDelay = 0

    // Are we currently adjusting the delay?
    let isAdjusting = true

    track.times.forEach((_, frame) => {
      if (endFrames.includes(frame)) {
        isAdjusting = false
        globalDelay += delay
        delayPerFrame = 0
      }

      // Increase the offset if the frame is a start frame.
      if (startFrames.includes(frame)) {
        const [, end] = valleys[startFrames.findIndex((s) => s === frame)]
        const numFrames = Math.abs(end - frame)

        delayPerFrame = delay / numFrames
        isAdjusting = true
      }

      // Apply the accumulated delay.
      track.times[frame] += globalDelay

      // Apply the local delay for each frame.
      if (isAdjusting) {
        track.times[frame] += delayPerFrame
      }
    })

    tracks[ti] = track
  })

  console.log(`Found ${valleys.length} valleys with low change.`)

  return tracks
}

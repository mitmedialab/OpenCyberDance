// @ts-check

import * as THREE from 'three'

import {trackNameToPart, coreParts, delayParts, curveParts} from './parts.js'
import {transformers} from './transforms.js'

export class Params {
  time = 0
  timescale = 1
  paused = false
  lockPosition = false

  // External body space
  space = 0

  curve = {
    /** @type {Record<keyof typeof curveParts, boolean>} */
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

    /** @type {keyof typeof transformers | 'none'} */
    equation: 'none',
    threshold: 1,

    dirty: false,
  }

  rotations = {
    x: 1,
    y: 1,
    z: 1,
  }

  /** @type {Record<keyof typeof coreParts, number>} */
  energy = {
    head: 1,
    body: 1,
    foot: 1,
  }

  /** @type {Record<keyof typeof delayParts, number>} */
  delays = {
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

/**
 * Scale up or down keyframe tracks.
 *
 * @param {THREE.KeyframeTrack} track
 */
export function overrideEnergy(track, factor = 1) {
  track.times = track.times.map((t) => {
    if (factor === 1) return t

    const value = t / factor
    if (isNaN(value)) return t

    return value
  })
}

/**
 * @param {THREE.KeyframeTrack} track
 * @param {{x: number, y: number, z: number}} config
 * @param {THREE.Euler[]} base
 * @returns
 */
export function overrideRotation(track, config, base) {
  if (!(track instanceof THREE.QuaternionKeyframeTrack)) return

  const size = track.getValueSize()

  track.times.forEach((_, i) => {
    const euler = base[i].clone()

    // Apply the new rotation to the target.
    euler.x *= config.x
    euler.y *= config.y
    euler.z *= config.z

    const q = new THREE.Quaternion()
      .setFromEuler(euler)
      .toArray(track.values, i * size)
  })
}

/**
 * @param {THREE.KeyframeTrack} track
 * @param {Map<string, number>} config
 */
export function overrideDelay(track, config) {
  const part = trackNameToPart(track.name, 'delay')
  if (!part) return

  const offset = config[part] ?? 0
  if (offset > 0) track.shift(offset)
}

/**
 * @param {THREE.KeyframeTrack[]} tracks
 * @returns {THREE.KeyframeTrack[]}
 */
export function applyExternalBodySpace(tracks) {
  // Stall the movement by X seconds.
  const DELAY = 0.05

  // Ignore changes below this threshold.
  const THRESHOLD = 0.0005

  // Ignore areas smaller than this.
  const MIN_CHANGE_SIZE = 3

  // The moving window size to calculate the moving averages.
  const WINDOW_SIZE = 5

  const timing = tracks[0].times

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

  // Find rate of change across frames
  const noChangeRegions = []
  let windowStart = 0
  let windowEnd = WINDOW_SIZE - 1

  while (windowEnd < averages.length) {
    const w = averages.slice(windowStart, windowEnd + 1)

    const diffs = w.map((v, i) => {
      return i < WINDOW_SIZE - 1 ? w[i + 1] - v : 0
    })

    // Check if all differences in the window are below the threshold
    const isStalled =
      diffs.every((diff) => Math.abs(diff) <= THRESHOLD) &&
      windowEnd - windowStart >= MIN_CHANGE_SIZE

    // Consider these regions as no-change regions
    if (isStalled) noChangeRegions.push([windowStart, windowEnd])

    // Move the window to the next non-overlapping position
    windowStart += WINDOW_SIZE
    windowEnd += WINDOW_SIZE
  }

  // Every track must apply the same rotation freeze.
  const out = tracks.map((track, ti) => {
    // Only apply external body space for rotations
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) return

    const size = track.getValueSize()

    // Apply external body space to the track.
    for (const [start, end] of noChangeRegions) {
      const first = track.values.slice(start, start + size)

      // Freeze the animation track using the first value.
      // ? should we really use the first value,
      // ? or really just drag the keyframe to extend all frames?
      for (let frame = start; frame < end; frame++) {
        first.forEach((value, axis) => {
          track.values[frame * size + axis] = 0
        })
      }
    }

    const startFrames = noChangeRegions.map(([start]) => start)
    let delayOffset = 0

    track.times.forEach((time, frame) => {
      // Delay the animation by X seconds.
      track.times[frame] = time + delayOffset

      // Increase the offset if the frame is a start frame.
      if (startFrames.includes(frame)) {
        delayOffset += DELAY
      }
    })

    tracks[ti] = track
  })

  console.log({averages, noChangeRegions, out})

  return tracks
}

// @ts-check

import * as THREE from 'three'

import {trackNameToPart, coreParts, delayParts, curveParts} from './parts.js'
import {transformers} from './transforms.js'
import {getRateOfChange, keyframesAt} from './keyframes.js'

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

  // If the rate of change dips below this threshold,
  // the area is considered as no change.
  const THRESH = 0.1

  const timing = tracks[0].times

  const averages = [...timing].map((_, frame) => {
    const sums = tracks.map((track) => {
      const size = track.getValueSize()

      let sum = 0
      for (let axis = 0; axis < size; axis++) {
        sum += Math.abs(track.values[frame * size + axis])
      }

      return sum
    })

    return sums.reduce((a, b) => a + b, 0) / sums.length
  })

  // Find rate of change across frames
  const rates = averages.map((_, frame) => {
    const value = Math.abs(averages[frame] - averages[frame - 1] ?? 0)

    // When the rate of change dips below the threshold,
    // we consider this as zero change.
    return value < THRESH ? 0 : value
  })

  // Find the areas where there is no change.
  const noChangeRegions = []
  let hasNoChange = false
  let noChangeStart = 0

  rates.forEach((rate, frame) => {
    if (rate === 0) {
      hasNoChange = true
      noChangeStart = frame
    } else if (rate > 0 && hasNoChange) {
      noChangeRegions.push([noChangeStart, frame])
      hasNoChange = false
      noChangeStart = -1
    }
  })

  // Every track must apply the same rotation freeze.
  tracks.forEach((track, ti) => {
    // Only apply external body space for rotations
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) return

    const size = track.getValueSize()

    const times = [...track.times]
    const values = [...track.values]

    // Apply external body space to the track.
    for (const [start, end] of noChangeRegions) {
      // Skip the region if it's too small.
      if (end - start < 5) continue

      const first = values.slice(start, start * size)

      // Freeze the animation track using the first value.
      for (let frame = start; frame < end; frame++) {
        first.forEach((value, axis) => {
          values[frame * size + axis] = value
        })
      }
    }

    const startFrames = noChangeRegions.map(([start]) => start)
    let offset = 0

    times.forEach((time, frame) => {
      // Increase the offset if the frame is a start frame.
      if (startFrames.includes(frame)) offset += DELAY

      // Delay the animation by X seconds.
      times[frame] = time + offset
    })

    track.times = new Float32Array(times)
    track.values = new Float32Array(values)

    tracks[ti] = track
  })

  return tracks
}

// @ts-check

import * as THREE from 'three'

import {trackNameToPart, coreParts, delayParts, curveParts} from './parts.js'
import {transformers} from './transforms.js'

export class Params {
  time = 0
  timescale = 1
  paused = false
  lockPosition = false

  /** External body space */
  space = {
    /** Stall the movement by X seconds. */
    delay: 0.05,

    /** Ignore changes below this threshold. */
    threshold: 0.005,

    /** Ignore region of change smaller than this window. */
    minWindow: 3,

    /** The window size to calculate the averages. */
    windowSize: 5,
  }

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
 * @param {typeof Params.prototype.space} options
 * @returns {THREE.KeyframeTrack[]}
 */
export function applyExternalBodySpace(tracks, options) {
  const {
    delay = 0.05,
    threshold = 0.005,
    minWindow = 3,
    windowSize = 5,
  } = options ?? {}

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
  let windowEnd = windowSize - 1

  while (windowEnd < averages.length) {
    const w = averages.slice(windowStart, windowEnd + 1)

    const diffs = w.map((v, i) => {
      return i < windowSize - 1 ? w[i + 1] - v : 0
    })

    // Check if all differences in the window are below the threshold
    const isStalled =
      diffs.every((diff) => Math.abs(diff) <= threshold) &&
      windowEnd - windowStart >= minWindow

    // Consider these regions as no-change regions
    if (isStalled) noChangeRegions.push([windowStart, windowEnd])

    // Move the window to the next non-overlapping position
    windowStart += windowSize
    windowEnd += windowSize
  }

  // Every track must apply the same rotation freeze.
  const out = tracks.map((track, ti) => {
    // Only apply external body space for rotations
    if (!(track instanceof THREE.QuaternionKeyframeTrack)) return

    const startFrames = noChangeRegions.map(([start]) => start)
    const endFrames = noChangeRegions.map(([start]) => start)

    // Current region's delay offset.
    let delayPerFrame = 0

    // Total accumulated delay from previous delay regions.
    let globalDelay = 0

    // Are we currently adjusting the delay?
    let isAdjusting = true

    track.times.forEach((time, frame) => {
      if (endFrames.includes(frame)) {
        isAdjusting = false
        globalDelay += delay
        delayPerFrame = 0
      }

      // Increase the offset if the frame is a start frame.
      if (startFrames.includes(frame)) {
        const [_, end] =
          noChangeRegions[startFrames.findIndex((s) => s === frame)]
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

  console.log({averages, noChangeRegions, out})

  return tracks
}

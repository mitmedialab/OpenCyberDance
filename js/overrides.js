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

export function applyExternalBodySpace(track) {
  // Only apply external body space for rotations
  if (!(track instanceof THREE.QuaternionKeyframeTrack)) return

  // TODO: apply in chunks?
  const {series} = keyframesAt(track, {
    from: 0,
    offset: 0,
    windowSize: track.times.length,
    axes: ['x', 'y'],
  })

  // Stall the movement by X seconds.
  const DELAY = 0.05

  // If the rate of change dips below this threshold,
  // the area is considered as no change.
  const THRESH = 0.1

  // TODO: wider window to consider rate of change, e.g. 4 at a time?
  const rates = getRateOfChange(series, {threshold: THRESH, skip: 1})

  // Offset the time by this amount.
  // Time has to accumulate as the track is shifted to the right.
  let offset = 0

  // Which frame are we processing right now?
  let frame = 0

  const times = [...track.times]
  const values = [...track.values]

  const size = track.getValueSize()

  let isNoChange = false
  let noChangeStart = 0
  let noChangeValue = new Float32Array()

  while (frame < track.times.length) {
    const rate = rates[frame]

    if (rate > 0 && isNoChange) {
      isNoChange = false

      console.log(`freezing ${noChangeStart} to ${frame}. offset = ${offset}`)

      // 1 - Freezing movement values in time.
      for (let f = noChangeStart; f < frame; f++) {
        for (let i = 0; i < size; i++) {
          values[f * size + i] = noChangeValue[i]
        }
      }
    }

    if (rate > 0 || isNoChange) {
      times[frame] += offset
      frame++

      continue
    }

    isNoChange = true
    noChangeStart = frame
    noChangeValue = track.values.slice(frame, frame + size)

    // Extend the keyframes when there is no change.
    offset += DELAY

    frame += 1
  }

  track.times = new Float32Array(times)
  track.values = new Float32Array(values)

  return track
}

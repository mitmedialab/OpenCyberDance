import * as THREE from 'three'

import {
  Vector3,
  Quaternion,
  KeyframeTrack,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three'

/** @type {Axis[]} */

/** @typedef {'x' | 'y' | 'z' | 'w'} Axis */
/** @typedef {(v: number[], axis: Axis) => void} Transform */

/**
 * @param {KeyframeTrack} track
 * @param {Transform} transform
 * @returns {Float32Array}
 **/
export function applyTrackTransform(track, transform) {
  const axes = ['x', 'y', 'z']

  const isRotation = track instanceof QuaternionKeyframeTrack
  const isVector = track instanceof VectorKeyframeTrack

  // Add w axis if it's a quaternion
  if (isRotation) axes.push('w')

  /** @type {Record<string, number[]>} */
  const series = {}

  // Setup each axis' series
  for (const a of axes) series[a] = []

  const size = track.getValueSize()

  track.times.forEach((time, timeIdx) => {
    const offset = timeIdx * size

    let v = isRotation ? new Quaternion() : new Vector3()
    v = v.fromArray(track.values, offset)

    // Append each axis' value to their series
    for (const a of axes) series[a].push(v[a])
  })

  // Process each axis' data
  for (const a of axes) series[a] = transform(series[a], a)

  // Zip back the transformed value in each axis.
  const values = []

  for (let i = 0; i < series.x.length; i++) {
    for (const a of axes) values.push(series[a][i])
  }

  // debugger

  return new Float32Array(series)
}

export function lowpass(source, windowSize) {
  const out = []

  for (let i = 0; i < source.length; i++) {
    let sum = 0
    let count = 0

    for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
      sum += source[j]
      count++
    }

    out.push(sum / count)
  }

  return out
}

export function highpass(source, windowSize) {
  const out = []

  for (let i = 0; i < source.length; i++) {
    let sum = 0
    let count = 0

    for (let j = Math.max(0, i - windowSize + 1); j <= i; j++) {
      sum += source[j]
      count++
    }

    out.push(source[i] - sum / count)
  }

  return out
}

export function gaussianSmoothing(source, windowSize) {
  const sigma = windowSize / 2.0
  let sum = 0

  const gaussianKernel = []
  const out = []

  // Calculate Gaussian kernel
  for (
    let x = -Math.floor(windowSize / 2);
    x <= Math.floor(windowSize / 2);
    x++
  ) {
    let g =
      Math.exp(-(0.5 * (x / sigma) * (x / sigma))) /
      (sigma * Math.sqrt(2 * Math.PI))
    gaussianKernel.push(g)
    sum += g
  }

  // Normalize the kernel
  for (let i = 0; i < gaussianKernel.length; i++) {
    gaussianKernel[i] /= sum
  }

  for (let i = 0; i < source.length; i++) {
    let newValue = 0
    let kernelIndex = 0

    for (
      let j = Math.max(0, i - Math.floor(windowSize / 2));
      j <= Math.min(source.length - 1, i + Math.floor(windowSize / 2));
      j++
    ) {
      newValue += source[j] * gaussianKernel[Math.abs(i - j)]
      kernelIndex++
    }

    out.push(newValue)
  }

  return out
}

/**
 * @param {number[]} source
 * @param {number} order
 * @returns {number[]}
 */
function derivative(source, order) {
  const out = []

  // this represents the difference in points which is assumed to be 1
  let h = 1

  for (let i = 0; i < source.length; i++) {
    if (i - order < 0 || i + order >= source.length) {
      // boundary case where we can't compute the derivative
      out.push(0)
    } else {
      let sum = 0

      for (let j = -order; j <= order; j++) {
        if (j != 0) {
          let coeff =
            (Math.pow(-1, Math.abs(j) - 1 + order) *
              Math.pow(h, order - 1) *
              Math.pow(j, order - 1)) /
            (2 * Math.abs(j) * factorial(Math.abs(j)) * factorial(order - 1))

          sum += coeff * source[i + j]
        }
      }

      out.push(sum)
    }
  }

  return out
}

function factorial(n) {
  let result = 1

  for (let i = 2; i <= n; i++) {
    result *= i
  }

  return result
}

export const transformers = {
  lowpass: (v) => lowpass(v, 5),
  highpass: (v) => highpass(v, 5),
  gaussianSmooth: (v) => gaussianSmoothing(v, 5),
  derivative: (v) => derivative(v, 5),
}

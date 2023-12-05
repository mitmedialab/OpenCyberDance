import * as THREE from 'three'
import { KeyframeTrack, Quaternion, VectorKeyframeTrack } from 'three'

export type Axis = 'x' | 'y' | 'z' | 'w'

export interface TransformOptions {
  threshold?: number
  axis?: Axis[]
  tracks?: number[]
}

export type Transform = (v: number[], o: TransformOptions) => number[]

/// We are transforming in Euler space, so we don't need `w`
const AXES: readonly Axis[] = ['x', 'y', 'z'] as const

function factorial(n: number) {
  let result = 1

  for (let i = 2; i <= n; i++) {
    result *= i
  }

  return result
}

export function applyTrackTransform(
  track: KeyframeTrack,
  transform: Transform,
  options: TransformOptions = {},
): Float32Array {
  const { axis } = options ?? {}

  // Temporarily disable transform for vector tracks.
  const isVector = track instanceof VectorKeyframeTrack
  if (isVector) return track.values

  const series: Record<string, number[]> = {}

  // Setup each axis' series
  for (const a of AXES) series[a] = []

  const size = track.getValueSize()

  track.times.forEach((_, timeIdx) => {
    const offset = timeIdx * size

    const q = new Quaternion().fromArray(track.values, offset)
    q.normalize()

    const e = new THREE.Euler().setFromQuaternion(q, 'XYZ')

    // Append each axis' value to their series
    series.x.push(e.x)
    series.y.push(e.y)
    series.z.push(e.z)
  })

  // Process each axis' data
  for (const a of AXES) {
    // Exclude the axis that are not filtered
    if (axis && !axis?.includes(a)) continue

    series[a] = transform(series[a], options)
  }

  // Zip back the transformed value in each axis.
  const values = []

  for (let i = 0; i < series.x.length; i++) {
    // Convert euler back to quaternion
    const e = new THREE.Euler(series.x[i], series.y[i], series.z[i])
    const q = new Quaternion().setFromEuler(e)

    values.push(q.x || 0, q.y || 0, q.z || 0, q.w || 0)
  }

  return new Float32Array(values)
}

export const lowpass: Transform = (source, options) => {
  const out = []

  const { threshold: windowSize = 2 } = options ?? {}

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

export const highpass: Transform = (source, options) => {
  const out = []

  const { threshold: windowSize = 2 } = options ?? {}

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

export const gaussian: Transform = (source, options) => {
  const { threshold: windowSize = 2 } = options ?? {}

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
    const g =
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

    for (
      let j = Math.max(0, i - Math.floor(windowSize / 2));
      j <= Math.min(source.length - 1, i + Math.floor(windowSize / 2));
      j++
    ) {
      newValue += source[j] * gaussianKernel[Math.abs(i - j)]
    }

    // const deviation = source[i] - newValue

    // // ? Poom: avoid sudden change!
    // if (Math.abs(deviation) > 0.2) {
    //   newValue = source[i]
    // }

    // // ? Poom: avoid zero!
    // if (newValue < 0.1 || newValue > 0.9) {
    //   newValue = source[i]
    // }

    // newValue = source[i]

    out.push(newValue)
  }

  return out
}

const derivative: Transform = (source, options) => {
  const { threshold: order = 2 } = options ?? {}

  const out = []

  // this represents the difference in points which is assumed to be 1
  const h = 1

  for (let i = 0; i < source.length; i++) {
    if (i - order < 0 || i + order >= source.length) {
      // boundary case where we can't compute the derivative
      out.push(0)
    } else {
      let sum = 0

      for (let j = -order; j <= order; j++) {
        if (j != 0) {
          const coeff =
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

const capMin: Transform = (source, options) => {
  const { threshold = 0.1 } = options ?? {}
  const out = []
  let previous = source[0]

  for (let i = 0; i < source.length; i++) {
    if (source[i] >= threshold) {
      out.push(source[i])
      previous = source[i]
    } else {
      out.push(previous)
    }
  }

  return out
}

const capMax: Transform = (source, options) => {
  const { threshold = 0.1 } = options ?? {}

  const out = []

  let previous = source[0]

  for (let i = 0; i < source.length; i++) {
    if (source[i] <= threshold) {
      out.push(source[i])
      previous = source[i]
    } else {
      out.push(previous)
    }
  }

  return out
}

export const transformers = {
  lowpass,
  highpass,
  gaussian,
  derivative,
  capMin,
  capMax,
} satisfies Record<string, Transform>

export type TransformKey = keyof typeof transformers

type FormulaRange = [min: number, max: number, step: number, initial: number]

const rWindow: FormulaRange = [1, 2000, 1, 1]

export const formulaRanges = {
  capMin: [-2, 3, 0.01, 0.1],
  capMax: [-2, 3, 0.01, 0.1],
  lowpass: rWindow,
  highpass: rWindow,
  gaussian: rWindow,
  derivative: [0, 3, 1, 0],
} satisfies Record<TransformKey, FormulaRange>

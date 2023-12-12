import * as THREE from 'three'

export function trackToEuler(
  track: THREE.QuaternionKeyframeTrack,
  offset: number | undefined,
) {
  const quaternion = new THREE.Quaternion().fromArray(track.values, offset)

  return new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')
}

export function randVariance(variance: number) {
  if (variance < 0 || variance > 10) {
    throw new Error('variance must be between 0 and 10!')
  }

  const minRange = -10 + variance
  const maxRange = 10 - variance

  return Math.random() * (maxRange - minRange) + minRange
}

export function easeIn(value: number, min: number, max: number) {
  console.log('ease', value, min, max)
  const normalizedValue = (value - min) / (max - min)
  return normalizedValue ** 1.5
}

export function easeOut(value: number, min: number, max: number) {
  const normalizedValue = (value - min) / (max - min)
  const eased = 1 - (1 - normalizedValue) ** 1.5
  return min + eased * (max - min)
}

export function uneaseIn(value: number, min: number, max: number) {
  const normalizedValue = Math.pow(value, 2 / 3)
  return min + normalizedValue * (max - min)
}

export function uneaseOut(value: number, min: number, max: number) {
  const normalizedValue = (value - min) / (max - min)
  const uneased = 1 - Math.pow(1 - normalizedValue, 2 / 3)
  return min + uneased * (max - min)
}

export function unease(value: number, min: number, max: number) {
  if (value > max) {
    return uneaseOut(value, max, 3)
  } else {
    return uneaseIn(value, min, max)
  }
}

export function percentToValue(
  percent: number,
  min: number,
  max: number,
  maxPercent = 100,
): number {
  // Ensure that percent is within the range [0, maxPercent]
  const perc = Math.min(maxPercent, Math.max(0, percent))

  // Map the percentage to the range [min, max]
  const rng = min + (perc / 100) * (max - min)
  let eased = rng

  // Transform some inputs
  if (maxPercent > 100) {
    eased = rng <= 1 ? easeIn(rng, min, 1) : easeOut(rng, 1, maxPercent / 100)
  } else if (min === 0) {
    eased = easeIn(rng, min, max)
  }

  return eased
}

export function getMaxOccurence(arr: string[]) {
  const n = arr.map((x) => Math.abs(parseInt(x)).toString())
  const o = n.reduce(
    (a: Record<string, number>, c: string): Record<string, number> => {
      !(c in a) ? (a[c] = 1) : (a[c] += 1)
      return a
    },
    {},
  )

  const s: [el: string, ord: number][] = Object.entries(o).sort(
    ([, a], [, b]) => b - a,
  )

  const ord = s
    .filter(([, occ]) => occ === s[0][1])
    .map((x) => [x[0], arr.indexOf(x[0])])
    .sort(([, a], [, b]) => (a as number) - (b as number))

  return ord.length > 0 ? ord[0][0] : ''
}

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

export function percentToValue(
  percent: number,
  min: number,
  max: number,
  maxPercent = 100,
): number {
  // Ensure that percent is within the range [0, maxPercent]
  const perc = Math.min(maxPercent, Math.max(0, percent))

  // Map the percentage to the range [min, max]
  return min + (perc / 100) * (max - min)
}

export function getMaxOccurence(arr: string[]) {
  const n = arr
    .map((x) => x.replace('%', '').replace('$', ''))
    .map((x) => Math.abs(parseInt(x)).toString())

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

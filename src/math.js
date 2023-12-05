import * as THREE from 'three'

/**
 *
 * @param {THREE.KeyframeTrack} track
 * @param {number} offset
 * @returns
 */
export function trackToEuler(track, offset) {
  const quaternion = new THREE.Quaternion().fromArray(track.values, offset)

  return new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')
}

/**
 * @param {number} variance
 * @returns
 */
export function randVariance(variance) {
  if (variance < 0 || variance > 10) {
    throw new Error('variance must be between 0 and 10!')
  }

  const minRange = -10 + variance
  const maxRange = 10 - variance

  return Math.random() * (maxRange - minRange) + minRange
}

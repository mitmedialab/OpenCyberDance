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

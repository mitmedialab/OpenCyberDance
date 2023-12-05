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

export class Params {
  timescale = 1

  rotations = {
    x: 1,
    y: 1,
    z: 1,
  }

  /** @type {Record<keyof typeof coreParts, number>} */
  energy = {
    head: 1,
    body: 1,
    legs: 1,
  }

  /** @type {Record<keyof typeof delayParts, number>} */
  delays = {
    leftArm: 0,
    rightArm: 0,
    leftLeg: 0,
    rightLeg: 0,
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
 * @param {KeyframeTrack} track
 * @param {{x: number, y: number, z: number}} settings
 * @param {THREE.Euler[]} base
 * @returns
 */
export function overrideRotation(track, settings, base) {
  if (!(track instanceof THREE.QuaternionKeyframeTrack)) return

  const size = track.getValueSize()

  track.times.forEach((_, timeIndex) => {
    const offset = timeIndex * size
    const quaternion = new THREE.Quaternion().fromArray(track.values, offset)
    const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ')
    const original = base[timeIndex]

    // Revert back to original from the model file.
    euler.x = original.x
    euler.y = original.y
    euler.z = original.z

    // Apply the new rotation to the target.
    euler.x *= settings.x
    euler.y *= settings.y
    euler.z *= settings.z

    quaternion.setFromEuler(euler)
    quaternion.toArray(track.values, offset)
  })
}

/**
 * @param {THREE.KeyframeTrack} track
 * @param {Map<string, number>} settings
 */
export function overrideDelay(track, settings) {
  const part = trackNameToPart(track.name, 'delay')

  const offset = delays[part] ?? 0
  if (offset > 0) track.shift(offset)
}

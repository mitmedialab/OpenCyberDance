import * as THREE from 'three'

import {
  KeyframeTrack,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three'

/**
 * Value of movement for analysis.
 * @typedef {THREE.Vector3|THREE.Quaternion} MoveValue
 */

/**
 * @param {THREE.Quarternion} q
 */
export function toEuler(q) {
  return new THREE.Euler().setFromQuaternion(q, 'XYZ')
}

export class KeyframeAnalyzer {
  /** @type {KeyframeTrack[]} */
  tracks = []

  /** @type {Map<string, {time: number, value: MoveValue}[]>} */
  movesByTrack = new Map()

  /** @type {Map<number, {track: string, value: MoveValue}[]>} */
  movesByTime = new Map()

  /**
   * @param {number} time
   * @param {string} track
   * @param {any} value
   */
  addMove(time, track, value) {
    if (!this.movesByTrack.has(track)) this.movesByTrack.set(track, [])
    if (!this.movesByTime.has(time)) this.movesByTime.set(time, [])

    this.movesByTime.get(time).push({track, value})
    this.movesByTrack.get(track).push({time, ...value})
  }

  getTimes() {
    return [...this.movesByTime.keys()]
  }

  getPartsAtTime(matcher, time) {
    const parts = this.movesByTime.get(time)
    if (!parts) return null

    const keyframes = parts.filter((move) => move.track.includes(matcher))
    if (!keyframes) return null

    return keyframes
  }

  /**
   * Analyze a particular keyframe track.
   * @param {KeyframeTrack[]} tracks
   */
  analyze(tracks) {
    if (tracks) this.tracks = tracks

    this.tracks.forEach((track, trackIdx) => {
      const valueSize = track.getValueSize()

      // Translation and scaling
      if (track instanceof VectorKeyframeTrack) {
        track.times.forEach((time, timeIdx) => {
          const offset = timeIdx * valueSize
          const vector = new THREE.Vector3().fromArray(track.values, offset)

          this.addMove(time, track.name, vector)
        })
      }

      // Rotational movement
      if (track instanceof QuaternionKeyframeTrack) {
        track.times.forEach((time, timeIdx) => {
          const offset = timeIdx * valueSize
          const q = new THREE.Quaternion().fromArray(track.values, offset)

          this.addMove(time, track.name, q)
        })
      }
    })

    window.analyzer = this
  }
}

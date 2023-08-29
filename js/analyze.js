import * as THREE from 'three'

import {
  KeyframeTrack,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three'

/**
 * Value of movement for analysis.
 * @typedef {{v: THREE.Vector3|THREE.Quaternion}} MoveValue
 */

/**
 * @typedef {{track: string, value: MoveValue}} Keyframe
 */

/**
 * @param {THREE.Quarternion} q
 */
export function toEuler(q) {
  return new THREE.Euler().setFromQuaternion(q, 'XYZ')
}

export function toBone(name) {
  return name.replace(/\.(position|quaternion)/, '')
}

export class KeyframeAnalyzer {
  /** @type {KeyframeTrack[]} */
  tracks = []

  /** @type {number[]} */
  times = []

  /** @type {Map<string, {time: number, value: MoveValue}[]>} */
  movesByTrack = new Map()

  /** @type {Map<number, Keyframes>} */
  movesByTime = new Map()

  get ready() {
    return this.movesByTime.size > 0
  }

  /**
   * Reset the analyzer's internal state.
   * @param {KeyframeTrack[]} tracks
   */
  reset(tracks) {
    if (tracks) this.tracks = tracks

    this.movesByTrack.clear()
    this.movesByTime.clear()
  }

  /**
   * @param {number} time
   * @param {string} track
   * @param {MoveValue} value
   */
  addMove(time, track, value) {
    if (!this.movesByTrack.has(track)) this.movesByTrack.set(track, [])
    if (!this.movesByTime.has(time)) this.movesByTime.set(time, [])

    this.movesByTime.get(time).push({track, value})
    this.movesByTrack.get(track).push({time, ...value})
  }

  /**
   * @param {number} index
   * @param {string|RegExp} matcher
   */
  getKeyframes(index, matcher) {
    const time = this.times[index]

    return {time, keyframes: this.getKeyframesAtTime(matcher, time)}
  }

  /**
   * @param {number} time
   * @param {string|RegExp|null} matcher
   * @returns
   */
  getKeyframesAtTime(time, matcher) {
    const keyframes = this.movesByTime.get(time)
    if (!keyframes || keyframes.length === 0) return []

    return this.filterKeyframes(keyframes, matcher) ?? []
  }

  /**
   * @param {number} time
   * @param {string|RegExp|null} matcher
   * @param {number} range
   * @returns {Keyframe[]}
   */
  searchKeyframesAroundTime(time, matcher, range = 0.1, limit = 1) {
    // If there is an exact match, use that value.
    const keyframes = this.getKeyframesAtTime(time, matcher) ?? []
    if (keyframes.length > 0) return keyframes

    // Search for keyframes within the range.
    return this.nearbyTimes(time, range)
      .slice(0, limit)
      .map((t) => this.getKeyframesAtTime(t, matcher) ?? [])
      .reduce((a, b) => [...a, ...b], [])
  }

  /**
   * @param {number} time
   * @param {number} range
   */
  nearbyTimes(time, range = 0.1) {
    // t >= time - range &&
    return this.times.filter((t) => t <= time + range)
  }

  /**
   * @param {Keyframe[]} keyframes
   * @param {string|RegExp|null} matcher
   * @returns
   */
  filterKeyframes(keyframes, matcher) {
    if (!matcher) return keyframes ?? []

    if (typeof matcher === 'string') {
      return keyframes.filter((move) => move.track.includes(matcher)) ?? []
    }

    if (matcher instanceof RegExp) {
      return keyframes.filter((move) => matcher.test(move.track)) ?? []
    }

    return []
  }

  /**
   * Analyze a particular keyframe track.
   * @param {KeyframeTrack[]} tracks
   */
  analyze(tracks) {
    this.reset(tracks)

    this.tracks.forEach((track, trackIdx) => {
      const valueSize = track.getValueSize()

      // Translation and scaling
      if (track instanceof VectorKeyframeTrack) {
        track.times.forEach((time, timeIdx) => {
          const offset = timeIdx * valueSize
          const vector = new THREE.Vector3().fromArray(track.values, offset)

          this.addMove(time, track.name, {v: vector})
        })
      }

      // Rotational movement
      if (track instanceof QuaternionKeyframeTrack) {
        track.times.forEach((time, timeIdx) => {
          const offset = timeIdx * valueSize
          const q = new THREE.Quaternion().fromArray(track.values, offset)

          this.addMove(time, track.name, {v: q})
        })
      }
    })

    this.times = [...this.movesByTime.keys()]

    console.log(`> analyzed ${this.tracks.length} tracks.`)
  }
}

import * as THREE from 'three'
import {
  KeyframeTrack,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three'

/**
 * Value of movement for analysis.
 */
interface MoveValue {
  v: THREE.Vector3 | THREE.Quaternion
}

interface Keyframe {
  track: string
  value: MoveValue
}

type Matcher = string | RegExp | null

export const toEuler = (q: THREE.Quaternion) =>
  new THREE.Euler().setFromQuaternion(q, 'XYZ')

export const toBone = (name: string) =>
  name.replace(/\.(position|quaternion)/, '')

export class KeyframeAnalyzer {
  tracks: KeyframeTrack[] = []
  times: number[] = []
  movesByTrack: Map<string, {time: number; value: MoveValue}[]> = new Map()
  movesByTime: Map<number, Keyframe[]> = new Map()

  get ready() {
    return this.movesByTime.size > 0
  }

  /**
   * Reset the analyzer's internal state.
   */
  reset(tracks: KeyframeTrack[]) {
    if (tracks) this.tracks = tracks

    this.movesByTrack.clear()
    this.movesByTime.clear()
  }

  addMove(time: number, track: string, value: MoveValue) {
    if (!this.movesByTrack.has(track)) this.movesByTrack.set(track, [])
    if (!this.movesByTime.has(time)) this.movesByTime.set(time, [])

    this.movesByTime.get(time)?.push({track, value})
    this.movesByTrack.get(track)?.push({time, value})
  }

  getKeyframes(index: number, matcher: Matcher) {
    const time = this.times[index]

    return {time, keyframes: this.getKeyframesAtTime(time, matcher)}
  }

  getKeyframesAtTime(time: number, matcher: Matcher) {
    const keyframes = this.movesByTime.get(time)
    if (!keyframes || keyframes.length === 0) return []

    return this.filterKeyframes(keyframes, matcher) ?? []
  }

  searchKeyframesAroundTime(
    time: number,
    matcher: Matcher,
    range = 0.1,
    limit = 1
  ): Keyframe[] {
    // If there is an exact match, use that value.
    const keyframes = this.getKeyframesAtTime(time, matcher) ?? []
    if (keyframes.length > 0) return keyframes

    // Search for keyframes within the range.
    return this.nearbyTimes(time, range)
      .slice(0, limit)
      .map((t) => this.getKeyframesAtTime(t, matcher) ?? [])
      .reduce((a, b) => [...a, ...b], [])
  }

  nearbyTimes(time: number, range = 0.1) {
    return this.times.filter((t) => t <= time + range)
  }

  filterKeyframes(keyframes: Keyframe[], matcher: Matcher) {
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
   */
  analyze(tracks: KeyframeTrack[]) {
    this.reset(tracks)

    this.tracks.forEach((track) => {
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

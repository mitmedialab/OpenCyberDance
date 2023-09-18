import {f32Append} from './floats.js'

/**
 * Lengthen the keyframe tracks, so that it loops properly.
 * We are only using one animation clip, so we need to lengthen the tracks.
 *
 * @param {THREE.KeyframeTrack[]} tracks
 */
export function lengthenKeyframeTracks(tracks) {
  tracks.forEach((track) => {
    const finalTime = track.times[track.times.length - 1]
    const next = [...track.times].map((t) => t + finalTime)

    track.times = f32Append(track.times, next)
    track.values = f32Append(track.values, track.values)

    // track.validate()
  })
}

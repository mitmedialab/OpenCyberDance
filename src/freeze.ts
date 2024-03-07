import {
  KeyframeTrack,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three'

export function freezeTrack(track: KeyframeTrack, time = 1) {
  // Freeze the rotation keyframes
  if (track instanceof QuaternionKeyframeTrack) {
    const size = track.getValueSize()
    if (size !== 4) throw new Error('invalid quaternion track')

    const len = track.times.length - 1
    const frame = Math.round((time / track.times[len]) * len)
    const data = track.values.slice(frame * size, frame * size + size)

    const [x, y, z, w] = data
    if (data.length !== 4) throw new Error('invalid data length')

    // Modify the entire keyframe values to this moment in time.
    for (let i = 0; i < track.values.length; i += size) {
      track.values[i] = x
      track.values[i + 1] = y
      track.values[i + 2] = z
      track.values[i + 3] = w
    }
  }

  // Freeze the position keyframes
  if (track instanceof VectorKeyframeTrack && track.name.includes('position')) {
    const size = track.getValueSize()
    if (size !== 3) throw new Error('invalid position track')

    const len = track.times.length - 1
    const frame = Math.round((time / track.times[len]) * len)
    const data = track.values.slice(frame * size, frame * size + size)

    const [x, y, z] = data
    if (data.length !== 3) throw new Error('invalid data length')

    // Modify the entire keyframe values to this moment in time.
    for (let i = 0; i < track.values.length; i += size) {
      track.values[i] = x
      track.values[i + 1] = y
      track.values[i + 2] = z
    }
  }
}

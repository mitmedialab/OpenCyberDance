import { KeyframeTrack } from 'three'

import { f32Append } from './floats'
import { Axis } from './transforms'

export const AXES: Axis[] = ['x', 'y', 'z', 'w']

/**
 * Lengthen the keyframe tracks, so that it loops properly.
 * We are only using one animation clip, so we need to lengthen the tracks.
 */
export function lengthenKeyframeTracks(tracks: KeyframeTrack[]) {
  for (const track of tracks) {
    const finalTime = track.times[track.times.length - 1]
    const next = [...track.times].map((t) => t + finalTime)

    track.times = f32Append(track.times, next)
    track.values = f32Append(track.values, [...track.values])

    track.validate()
  }
}

interface KeyframesOptions {
  from: number
  offset: number
  windowSize: number
  axes: Axis[]
}

export function keyframesAt(track: KeyframeTrack, options?: KeyframesOptions) {
  const { offset, windowSize, axes = AXES, from } = options ?? {}

  if (typeof from !== 'number' || typeof offset !== 'number') return
  if (typeof windowSize !== 'number') return

  let start = track.times.findIndex((t) => t >= from)
  start = Math.max(0, start, start + offset)

  const end = Math.min(start + windowSize, track.times.length)
  const valueSize = track.getValueSize()

  const series: { x: number; y: number }[][] = Array.from({
    length: valueSize,
  }).map(() => [])

  const visibility = AXES.map((a) => axes.includes(a))

  for (let frame = start; frame < end; frame++) {
    const time = track.times[frame]

    for (let axis = 0; axis < valueSize; axis++) {
      // Do not render the axis that are not visible.
      if (!visibility[axis]) continue

      series[axis].push({ x: time, y: track.values[frame * valueSize + axis] })
    }
  }

  return { series, start: track.times[start], end: track.times[end] }
}

export function getAcceleration(data: { x: number; y: number }[]) {
  const start = data[0]
  const end = data[data.length - 1]

  return (end.y - start.y) / (end.x - start.x)
}

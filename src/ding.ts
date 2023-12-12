import { Howl } from 'howler'

const ding1 = new Howl({
  src: '/sounds/khongwong_1.wav',
  preload: true,
  volume: 1,
})

export function ding() {
  stopAll()
  ding1.play()
}

export function stopAll() {
  ding1.stop()
}

import { Howl } from 'howler'

const ding1 = new Howl({
  src: '/sounds/khongwong_1.wav',
  preload: true,
  volume: 1,
})

// const ding2 = new Howl({ src: '/sounds/khongwong_2.wav' })
// const ding3 = new Howl({ src: '/sounds/khongwong_3.wav' })
// const ding4 = new Howl({ src: '/sounds/khongwong_4.wav' })
// const ding5 = new Howl({ src: '/sounds/khongwong_5.wav' })
// const ding6 = new Howl({ src: '/sounds/khongwong_6.wav' })

export function ding(level: number) {
  stopAll()
  ding1.play()
}

export function stopAll() {
  ding1.stop()
}

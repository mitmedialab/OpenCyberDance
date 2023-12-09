import { Howl } from 'howler'

const ding1 = new Howl({ src: '/sounds/khongwong_1.wav' })
const ding2 = new Howl({ src: '/sounds/khongwong_2.wav' })
const ding3 = new Howl({ src: '/sounds/khongwong_3.wav' })
const ding4 = new Howl({ src: '/sounds/khongwong_4.wav' })
const ding5 = new Howl({ src: '/sounds/khongwong_5.wav' })
const ding6 = new Howl({ src: '/sounds/khongwong_6.wav' })

export function ding(level: number) {
  stopAll()

  switch (level) {
    case 1:
      ding1.play()
      break
    case 2:
      ding2.play()
      break
    case 3:
      ding3.play()
      break
    case 4:
      ding4.play()
      break
    case 5:
      ding5.play()
      break
    case 6:
      ding6.play()
      break
  }
}

export function stopAll() {
  ding1.stop()
  ding2.stop()
  ding3.stop()
  ding4.stop()
  ding5.stop()
  ding6.stop()
}
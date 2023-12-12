import { Howl } from 'howler'
import { atom } from 'nanostores'

export const $musicPlaying = atom<number | null>(null)

// 0.0 - 1.0
export const $musicVolume = atom<1>(1)

// default volume...
const DEFAULT_VOLUME = $musicVolume.get()

export const music1 = new Howl({
  src: '/sounds/Program1_6mins.m4a',
  html5: true,
  preload: true,
  loop: false,
  volume: DEFAULT_VOLUME,
  onend: () => $musicPlaying.set(null),
})

export const music2 = new Howl({
  src: '/sounds/Program2_6mins.m4a',
  html5: true,
  preload: true,
  loop: false,
  volume: DEFAULT_VOLUME,
  onend: () => $musicPlaying.set(null),
})

export const music3 = new Howl({
  src: '/sounds/Program3_11mins.m4a',
  html5: true,
  preload: true,
  loop: false,
  volume: DEFAULT_VOLUME,
  onend: () => $musicPlaying.set(null),
})

export function stopMusic() {
  music1.stop()
  music2.stop()
  music3.stop()

  $musicPlaying.set(null)
}

export function playMusic(program: number) {
  stopMusic()

  $musicPlaying.set(program)

  if (program === 1) music1.play()
  if (program === 2) music2.play()
  if (program === 3) music3.play()
}

export function toggleMusic(program: number) {
  if ($musicPlaying.get() !== null) {
    stopMusic()
  } else {
    playMusic(program)
  }
}

export function setVolume(volume: number) {
  music1.volume(volume)
  music2.volume(volume)
  music3.volume(volume)
}

import { map } from 'nanostores'
import { OrthographicCamera } from 'three'

interface DebugLog {
  // camera's position
  cpx: number
  cpy: number
  cpz: number

  // camera's euler rotation
  crx: number
  cry: number
  crz: number

  // camera zoom
  czoom: number
}

export const $debugLog = map<DebugLog>({
  cpx: 0,
  cpy: 0,
  cpz: 0,
  crx: 0,
  cry: 0,
  crz: 0,
  czoom: 0,
})

export function updateDebugLogCamera(camera: OrthographicCamera) {
  const pos = camera?.position
  const rot = camera?.rotation

  $debugLog.set({
    cpx: pos?.x ?? 0,
    cpy: pos?.y ?? 0,
    cpz: pos?.z ?? 0,
    crx: rot?.x ?? 0,
    cry: rot?.y ?? 0,
    crz: rot?.z ?? 0,
    czoom: camera?.zoom ?? 0,
  })
}

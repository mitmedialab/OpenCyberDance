import { map } from 'nanostores'

interface DebugLog {
  px: number
  py: number
  pz: number

  rx: number
  ry: number
  rz: number
  rw: number
}

export const $debugLog = map<DebugLog>({
  px: 0,
  py: 0,
  pz: 0,
  rx: 0,
  ry: 0,
  rz: 0,
  rw: 0,
})

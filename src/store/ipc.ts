import { atom } from 'nanostores'

import { IPCMode } from '../ipc'

export const $ipcMode = atom<IPCMode | null>(null)

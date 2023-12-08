import { atom } from 'nanostores'

import { ListeningStatus } from '../voice'

export const $status = atom<ListeningStatus>('disabled')
export const $transcript = atom('')
export const $gptResult = atom('')

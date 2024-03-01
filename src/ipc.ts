import { nanoid } from 'nanoid'

import { World } from './world'

// random unique identifier representing the current browser window
const WINDOW_ID = nanoid()

export type IPCMessage =
  | { type: 'connect'; windowId: string }
  | { type: 'close'; windowId: string }

const IPC_CHANNEL_KEY = 'DANCE_IPC'
const IPC_STATE_PREFIX = 'DANCE_IPC:'

const ipcKey = (key: string) => IPC_STATE_PREFIX + key

export class IPCManager {
  world: World
  channel: BroadcastChannel | null = null

  constructor(world: World) {
    this.world = world
    this.setup()
  }

  /**
   * Used for inter-window communication for ending scene.
   * Projecting both overhead and front view into different browser windows.
   */
  async setup() {
    // do not create a new broadcast channel if it already exists
    if (this.channel) return

    this.channel = new BroadcastChannel(IPC_CHANNEL_KEY)

    this.channel.addEventListener('message', (e) => {
      this.handleMessage(e.data as IPCMessage)
    })

    this.channel.addEventListener('messageerror', (e) => {
      console.log(`bc message error:`, e.data)
    })

    this.send({ type: 'connect', windowId: WINDOW_ID })

    addEventListener('beforeunload', () => {
      this.send({ type: 'close', windowId: WINDOW_ID })
      this.channel?.close()
    })

    addEventListener('storage', (e) => {
      if (e.storageArea !== localStorage) return

      if (e.key?.startsWith(IPC_STATE_PREFIX)) {
        this.handleState(e.key.replace(IPC_STATE_PREFIX, ''), e.newValue)
      }
    })
  }

  set<T>(key: string, value: T) {
    localStorage.setItem(ipcKey(key), JSON.stringify(value))
  }

  get<T>(key: string): T | null {
    const item = localStorage.getItem(ipcKey(key))
    if (!item) return null

    return JSON.parse(item)
  }

  send(message: IPCMessage) {
    this.channel?.postMessage(message)
  }

  handleMessage(message: IPCMessage) {
    console.log(`IPC message:`, message)
  }

  handleState(key: string, value: string | null) {
    console.log(`IPC state:`, key, value)
  }
}

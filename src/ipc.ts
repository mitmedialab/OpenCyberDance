import { nanoid } from 'nanoid'

import { World } from './world'

// random unique identifier representing the current browser window
const WINDOW_ID = nanoid()

export type IPCMessage =
  | { type: 'connect'; id: string }
  | { type: 'close'; id: string }

const IPC_CHANNEL_KEY = 'DANCE_IPC'
const IPC_STATE_PREFIX = 'DANCE_IPC:'

const ipcKey = (key: string) => IPC_STATE_PREFIX + key

type IPCWindow = {
  id: string
  mode: 'leader' | 'follower'
}

export class IPCManager {
  world: World
  channel: BroadcastChannel | null = null

  constructor(world: World) {
    this.world = world
    this.setup()
  }

  get id() {
    return WINDOW_ID
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

    addEventListener('beforeunload', () => {
      this.handleWindowClose()
    })

    addEventListener('storage', (e) => {
      if (e.storageArea !== localStorage) return

      if (e.key?.startsWith(IPC_STATE_PREFIX)) {
        this.handleState(e.key.replace(IPC_STATE_PREFIX, ''), e.newValue)
      }
    })

    this.registerWindow()
  }

  windows() {
    return this.get<IPCWindow[]>('windows')
  }

  registerWindow() {
    let windows = this.windows()
    if (!windows) windows = []

    const hasLeader = windows.some((w) => w.mode === 'leader')
    const mode = hasLeader ? 'follower' : 'leader'

    windows.push({ mode, id: WINDOW_ID })

    this.set('windows', windows)
    this.send({ type: 'connect', id: WINDOW_ID })
  }

  unregisterWindow() {
    let windows = this.windows()
    if (!windows) windows = []

    // is the current window the leader?
    const isLeader = windows.find((w) => w.id === WINDOW_ID)?.mode === 'leader'

    // exclude current window
    windows = windows.filter((w) => w.id !== WINDOW_ID)

    // does the current windows have a leader?
    const hasNextLeader = windows.some((w) => w.mode === 'leader')

    // if the leader window is closed, promote the next window to leader
    if (isLeader && !hasNextLeader && windows.length > 0) {
      windows[0].mode = 'leader'
    }

    this.set('windows', windows)
    this.send({ type: 'close', id: WINDOW_ID })
  }

  set<T>(key: string, value: T) {
    localStorage.setItem(ipcKey(key), JSON.stringify(value))
  }

  get<T>(key: string): T | null {
    const item = localStorage.getItem(ipcKey(key))
    if (!item) return null

    try {
      return JSON.parse(item)
    } catch (e) {
      return null
    }
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

  handleWindowClose() {
    this.unregisterWindow()

    this.channel?.close()
  }
}

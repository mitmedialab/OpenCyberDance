// @ts-check

import {Character} from './character.js'
import {World} from './world.js'

const AXES = ['x', 'y', 'z', 'w']

const colors = {
  x: 'rgb(255, 99, 132)',
  y: 'rgb(54, 162, 235)',
  z: 'rgb(255, 205, 86)',
  w: 'rgb(75, 192, 192)',
}

export class Plotter {
  /**
   * How many frames per second to plot?
   */
  fps = 1

  /**
   * Number of keyframes to show; indicates how wide the time window is.
   */
  windowSize = 500

  /**
   * Number of keyframes to skip; indicates how far back in time to start.
   */
  offset = -100

  /**
   * Track index of the animation to plot.
   * @type {number[]}
   */
  tracks = [6, 7]

  /** @type {HTMLDivElement | null} */
  domElement = null

  /**
   * Map<CharacterName, Map<TrackId, {Chart, Canvas}>>
   * @type {Map<string, Map<number, {chart: Chart, canvas: HTMLCanvasElement}>>}
   **/
  charts = new Map()

  /** @type {World | null} */
  world = null

  /// Internal timer
  timer = 0

  constructor(world) {
    this.world = world
    this.domElement = document.createElement('div')

    const s = this.domElement.style
    s.position = 'fixed'
    s.left = '0px'
    s.top = '40px'
    s.pointerEvents = 'none'

    this.run()
  }

  add(chrId) {
    if (this.charts.has(chrId)) return

    this.tracks.forEach((id) => this.createChart(chrId, id))
  }

  createChart(chrId, trackId) {
    console.log(`> plt_add ${chrId}#${trackId}`)

    const canvas = document.createElement('canvas')
    canvas.style.width = '400px'
    canvas.style.height = '200px'

    this.domElement?.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    const values = []

    const ds = {
      label: `${chrId}#${trackId}`,
      data: values,
      fill: false,
      borderWidth: 2,
      lineTension: 0.1,
      pointRadius: 0,
    }

    // Create chart
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: AXES.map((a) => ({...ds, label: a, borderColor: colors[a]})),
      },
      options: {
        scales: {
          x: {display: false},
          y: {display: false},
        },
        plugins: {
          legend: {
            display: false,
          },
        },
      },
    })

    // Initialize the charts mapping
    if (!this.charts.has(chrId)) this.charts.set(chrId, new Map())

    this.charts.get(chrId)?.set(trackId, {chart, canvas})
  }

  /**
   * @param {Character} char
   */
  update(char) {
    const name = char.options.name
    if (!this.charts.has(name)) this.add(name)

    const {windowSize, offset} = this

    this.tracks.forEach((id) => {
      const state = this.charts.get(name)?.get(id)
      if (!state) return

      const {chart} = state
      if (!chart) return

      const frame = char.getCurrentKeyframes(id, windowSize, offset)
      if (!frame) return

      const splits = Plotter.split(frame.values)
      chart.data.labels = frame.times

      AXES.forEach((axis, i) => {
        chart.data.datasets[i].data = splits[axis]
      })

      chart.update()
    })
  }

  /** @param {Float32Array} v */
  static split(v) {
    const s = {}

    AXES.forEach((axis) => {
      s[axis] = []
    })

    for (let i = 0; i < v.length; i += 4) {
      AXES.forEach((axis, j) => {
        s[axis].push(v[i + j])
      })
    }

    return s
  }

  run() {
    clearInterval(this.timer)

    this.timer = setInterval(() => {
      this.world?.characters?.forEach(this.update.bind(this))
    }, 1000 / this.fps)
  }
}

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
  /// How many frames per second to plot?
  fps = 1

  /// Number of keyframes to show; indicates how wide the time window is.
  windowSize = 500

  /// Number of keyframes to skip; indicates how far back in time to start.
  offset = -100

  /// Track index of the animation to plot.
  tid = 6

  /** @type {HTMLDivElement} */
  domElement = null

  /** @type {Record<string, Chart>} */
  charts = {}

  /** @type {Record<string, HTMLCanvasElement>} */
  canvases = {}

  /** @type {World} */
  world = null

  /// Internal timer
  timer = 0

  constructor(world) {
    this.world = world
    this.domElement = document.createElement('div')

    const s = this.domElement.style
    s.position = 'fixed'
    s.left = 0
    s.top = '40px'

    this.run()
  }

  add(key) {
    console.log(`> plotter#add ${key}`)

    const canvas = document.createElement('canvas')
    canvas.style.width = '400px'
    canvas.style.height = '200px'

    this.domElement.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    const values = []

    const ds = {
      label: key,
      data: values,
      fill: false,
      borderWidth: 2,
      lineTension: 0.1,
      pointRadius: 0,
    }

    // Create chart
    this.charts[key] = new Chart(ctx, {
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

    this.canvases[key] = canvas
  }

  /**
   * @param {Character} char
   */
  update(char) {
    const name = char.options.name
    if (!this.charts[name]) this.add(name)

    const chart = this.charts[name]

    const {tid, windowSize, offset} = this

    const frame = char.getCurrentKeyframes(tid, windowSize, offset)
    if (!frame) return

    const splits = Plotter.split(frame.values)
    chart.data.labels = frame.times

    AXES.forEach((axis, i) => {
      chart.data.datasets[i].data = splits[axis]
    })

    chart.update()
  }

  /** @param {number[]} v */
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
      this.world.characters?.forEach(this.update.bind(this))
    }, 1000 / this.fps)
  }
}

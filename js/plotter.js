import {Character} from './character.js'
import {World} from './world.js'

const PLOTTER_FPS = 1

const AXES = ['x', 'y', 'z', 'w']

export class Plotter {
  /// Number of keyframes to show; indicates how wide the time window is.
  windowSize = 100

  /** @type {HTMLDivElement} */
  domElement = null

  /** @type {Record<string, Chart>} */
  charts = {}

  /** @type {Record<string, HTMLCanvasElement>} */
  canvases = {}

  /** @type {World} */
  world = null

  constructor(world) {
    this.world = world
    this.domElement = document.createElement('div')

    const s = this.domElement.style
    s.position = 'fixed'
    s.left = 0
    s.top = '40px'

    this.render()
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
      borderColor: 'rgb(75, 192, 192)',
      borderWidth: 2,
      lineTension: 0.1,
      pointRadius: 0,
    }

    // Create chart
    this.charts[key] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: AXES.map((a) => ({...ds, label: a})),
      },
      options: {},
    })

    this.canvases[key] = canvas
  }

  /**
   * @param {Character} char
   */
  update(char) {
    const name = char.options.name
    if (!this.charts[name]) this.add(name)

    const canvas = this.canvases[name]
    const chart = Chart.getChart(canvas)

    const frame = char.getCurrentKeyframes(/foot/i, this.windowSize)
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

  render() {
    setInterval(() => {
      this.world.characters?.forEach(this.update.bind(this))
    }, 1000 / PLOTTER_FPS)
  }
}

// @ts-check

import {Chart} from 'chart.js'
import {Character} from './character.js'
import {World} from './world.js'

const AXES = ['x', 'y', 'z', 'w']

const colors = {
  x: 'rgb(255, 99, 132)',
  y: 'rgb(54, 162, 235)',
  z: 'rgb(255, 205, 86)',
  w: 'rgb(75, 192, 192)',
}

const layout = {
  w: 100,
  h: 50,
  cols: 2,
  top: 50,
  px: 5,
  py: 5,
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
   * @type {Set<number>}
   */
  tracks = new Set([6, 9])

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
    s.top = `${layout.top}px`
    // s.pointerEvents = 'none'

    s.display = 'grid'
    s.gridTemplateColumns = `repeat(${layout.cols}, ${layout.w}px)`
    s.gap = `${layout.py}px ${layout.px}px`

    this.run()
  }

  add(chrId) {
    if (this.charts.has(chrId)) return

    this.tracks.forEach((id) => this.createChart(chrId, id))
  }

  createChart(chrId, trackId) {
    const canvas = document.createElement('canvas')
    canvas.style.width = `${layout.w}px`
    canvas.style.height = `${layout.h}px`

    this.domElement?.appendChild(canvas)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const values = []

    let label = `${trackId}`

    const ds = {
      label,
      data: values,
      fill: false,
      borderWidth: 2,
      lineTension: 0.1,
      pointRadius: 0,
    }

    const totalDuration = 10000
    const delayBetweenPoints = totalDuration / values.length

    const previousY = (ctx) =>
      ctx.index === 0
        ? ctx.chart.scales.y.getPixelForValue(100)
        : ctx.chart
            .getDatasetMeta(ctx.datasetIndex)
            .data[ctx.index - 1].getProps(['y'], true).y

    const animation = {
      x: {
        type: 'number',
        easing: 'linear',
        duration: delayBetweenPoints,

        // the point is initially skipped
        from: NaN,

        delay(ctx) {
          if (ctx.type !== 'data' || ctx.xStarted) return 0
          ctx.xStarted = true

          return ctx.index * delayBetweenPoints
        },
      },
      y: {
        type: 'number',
        easing: 'linear',
        duration: delayBetweenPoints,
        from: previousY,
        delay(ctx) {
          if (ctx.type !== 'data' || ctx.yStarted) return 0
          ctx.yStarted = true

          return ctx.index * delayBetweenPoints
        },
      },
    }

    // Create chart
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: AXES.map((a) => ({...ds, label: a, borderColor: colors[a]})),
      },
      options: {
        font: {
          size: 2,
        },
        // animation,
        interaction: {
          intersect: false,
        },
        responsive: false,
        scales: {
          x: {display: false},
          y: {display: false},
        },
        plugins: {
          legend: {
            display: false,
          },
          decimation: {
            enabled: true,
            algorithm: 'lttb',
          },
          // subtitle: {
          //   display: true,
          //   text: ds.label,
          //   font: {size: 1, weight: 'light'},
          //   fullSize: false,
          //   padding: {top: 2},
          // },
        },
      },
    })

    // Initialize the charts mapping
    if (!this.charts.has(chrId)) this.charts.set(chrId, new Map())

    this.charts.get(chrId)?.set(trackId, {chart, canvas})
  }

  /**
   * @param {number[]} next
   */
  updateTracks(next) {
    next.forEach((id) => {
      if (!this.tracks.has(id)) {
        console.log(`+ ${id}`)

        this.tracks.add(id)
        this.charts.forEach((_, chrId) => {
          this.createChart(chrId, id)
        })
      }
    })

    this.tracks.forEach((id) => {
      if (!next.includes(id)) {
        console.log(`- ${id}`)
        this.tracks.delete(id)

        this.charts.forEach((_, chrId) => {
          const map = this.charts.get(chrId)
          const item = map?.get(id)
          item?.chart.destroy()
          item?.canvas?.remove()
          map?.delete(id)
        })
      }
    })
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
      chart.data.labels = Array.from(frame.times)

      AXES.forEach((axis, i) => {
        if (!chart.data.datasets) return

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

  get interval() {
    return 1000 / this.fps
  }

  run() {
    clearInterval(this.timer)

    const b = profile('plot')

    this.timer = setInterval(() => {
      b(() => {
        this.world?.characters?.forEach(this.update.bind(this))
      })
    }, this.interval)
  }
}

const profile = (k, t) => (cb) => {
  performance.mark(`${k}-s`)
  cb()

  performance.mark(`${k}-e`)

  const m = performance.measure(k, `${k}-s`, `${k}-e`)
  if (t && m.duration > t) console.log(`perf: ${k} took ${m.duration}ms`)
}

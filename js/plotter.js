// @ts-check

import {Character} from './character.js'
import {World} from './world.js'
import {profile} from './perf.js'
import * as THREE from 'three'

import {Chart, TimeScale, TimeSeriesScale} from 'chart.js'

import 'date-fns'
import 'chartjs-adapter-date-fns'

const p = {
  p: profile('plot', 30),
  df: profile('chart:dataframe', 1),
  cu: profile('chart:update', 10),
}

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
  windowSize = 300

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
    Chart.register(TimeScale, TimeSeriesScale)

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

    const axes = ['x', 'y', 'z', 'w']

    // Create chart
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: axes.map((a) => ({
          ...ds,
          label: a,
          borderColor: colors[a],
        })),
      },
      options: {
        parsing: false,
        font: {
          size: 2,
        },
        // animation,
        interaction: {
          intersect: false,
        },
        responsive: false,
        scales: {
          x: {display: false, type: 'timeseries'},
          y: {display: false, type: 'timeseries'},
        },
        plugins: {
          legend: {
            display: false,
          },
          decimation: {
            enabled: true,
            algorithm: 'lttb',
          },
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

    this.tracks.forEach((id) => {
      const state = this.charts.get(name)?.get(id)
      if (!state) return

      const {chart} = state
      if (!chart) return

      const track = char.currentClip?.tracks[id]
      if (!track) return

      p.df(() => {
        this.points(track, char.mixer.time).forEach((df, i) => {
          chart.data.datasets[i].data = df
        })

        debugger
      })

      p.cu(() => chart.update())
    })
  }

  /**
   * @param {THREE.KeyframeTrack} track
   * @param {number} now
   * @returns {{x: number, y: number}[][]}
   */
  points(track, now) {
    const {windowSize, offset} = this

    const valueSize = track.getValueSize()
    const axes = track instanceof THREE.QuaternionKeyframeTrack ? 4 : 3

    let start = track.times.findIndex((t) => t >= now)
    start = start + offset < 0 ? start : start + offset

    const end = start + windowSize

    /** @type {{x: number, y: number}[][]} */
    const s = [...Array(axes)].map(() => [])

    track.times.slice(start, end).forEach((time, timeIdx) => {
      const offset = timeIdx * valueSize

      for (let ai = 0; ai < axes; ai++) {
        s[ai].push({x: time, y: track.values[offset + ai]})
      }
    })

    return s
  }

  get interval() {
    return 1000 / this.fps
  }

  run() {
    clearInterval(this.timer)

    this.timer = setInterval(() => {
      p.p(() => this.world?.characters?.forEach(this.update.bind(this)))
    }, this.interval)
  }
}

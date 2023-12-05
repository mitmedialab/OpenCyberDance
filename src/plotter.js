import {Character} from './character.js'
import {World} from './world.js'
import {profile} from './perf.js'
import * as THREE from 'three'

import {Chart, registerables} from 'chart.js'
import AnnotationPlugin from 'chartjs-plugin-annotation'
import {AXES, keyframesAt} from './keyframes.js'

const p = {
  u: profile('chart', 30),
  o: profile('plotter', 80),
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
   * Is the plotter visible?
   */
  visible = true

  /**
   * Number of keyframes to show; indicates how wide the time window is.
   */
  windowSize = 250

  /**
   * Number of keyframes to skip; indicates how far back in time to start.
   */
  offset = -30

  /**
   * Track index of the animation to plot.
   * @type {Set<number>}
   */
  tracks = new Set()

  /** @type {HTMLDivElement | null} */
  domElement = null

  /**
   * Map<CharacterName, Map<TrackId, *>>
   * @type {Map<string, Map<number, {chart: Chart, canvas: HTMLCanvasElement}>>}
   **/
  charts = new Map()

  /** @type {World | null} */
  world = null

  /// Internal timer
  timer = 0

  /// Visible axis
  /** @type {import('./transforms.js').Axis[]} */
  axes = [...AXES]

  constructor(world) {
    this.world = world

    Chart.register(...registerables, AnnotationPlugin)

    this.prepare()
    this.run()

    // @ts-ignore
    window.p = this
  }

  get trackNames() {
    return [...this.tracks].map((i) => this.world?.trackNames[i])
  }

  prepare() {
    this.domElement = document.createElement('div')

    const s = this.domElement.style
    s.position = 'fixed'
    s.left = '0px'
    s.top = `${layout.top}px`
    // s.pointerEvents = 'none'

    s.display = 'flex'
  }

  trackById(id, chr = 'first') {
    return this.world?.characterByName(chr)?.trackByKey(id)
  }

  createChart(chrId, trackId) {
    // Do not create charts when the plotter is invisible.
    if (!this.visible) return

    const track = this.trackById(trackId, chrId)
    if (!track) return

    // Log the track name for debugging.
    if (chrId === 'first') console.log(`+ ${track.name}`)

    const canvas = document.createElement('canvas')
    canvas.style.width = `${layout.w}px`
    canvas.style.height = `${layout.h}px`
    canvas.setAttribute('data-plotter-id', `${chrId}:${trackId}`)
    canvas.setAttribute('data-plotter-track-name', track.name)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Create chart
    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: AXES.map((a) => ({
          parsing: false,
          normalized: true,
          data: [],
          borderWidth: 2,
          borderColor: colors[a],
        })),
      },
      options: {
        animation: false,
        parsing: false,
        normalized: true,
        interaction: {
          intersect: false,
          mode: 'x',
        },
        responsive: false,
        maintainAspectRatio: false,
        scales: {
          x: {display: false, type: 'linear'},
          y: {display: false, type: 'linear', stacked: true},
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            enabled: false,
            external(t) {
              // @ts-ignore
              // window.t = t
            },
          },
          decimation: {
            enabled: true,
            algorithm: 'min-max',
          },
          annotation: {
            annotations: [
              // {
              //   type: 'line',
              //   scaleID: 'x',
              //   value: Math.abs(this.offset),
              // },
            ],
          },
        },
      },
    })

    // Appending canvas to the DOM
    if (this.domElement) {
      const container = this.containerOf(chrId)
      if (!container) return

      container?.appendChild(canvas)
    }

    this.charts.get(chrId)?.set(trackId, {chart, canvas})
  }

  containerOf(id) {
    return this.domElement?.querySelector(`[data-plotter-character="${id}"]`)
  }

  /**
   * @param {import('./character.js').Q[]} query
   */
  select(...query) {
    if (!this.world) return

    const next = this.world.query(...query)

    next.forEach((id) => {
      if (!this.tracks.has(id)) {
        this.tracks.add(id)

        this.charts.forEach((_, chrId) => {
          this.createChart(chrId, id)
        })
      }
    })

    this.tracks.forEach((id) => {
      if (!next.includes(id)) {
        this.tracks.delete(id)

        // Remove each charts
        this.charts.forEach((_, chrId) => {
          const map = this.charts.get(chrId)
          const item = map?.get(id)

          item?.chart.destroy()
          item?.canvas?.remove()
          map?.delete(id)
        })

        // Log deletion
        const name = this.trackById(id)?.name
        console.log(`- ${name}`)
      }
    })
  }

  setupCharts(name) {
    if (this.charts.has(name)) return

    // Initialize the plotter container.
    const container = document.createElement('div')
    container.setAttribute('data-plotter-character', name)
    this.domElement?.appendChild(container)

    // Setup the charts.
    this.charts.set(name, new Map())
    this.tracks.forEach((id) => this.createChart(name, id))
  }

  /** @param {number} id */
  current(id = [...this.tracks][0]) {
    if (!this.world) return []

    const c = this.world.first
    const track = c.currentClip?.tracks[id]
    if (!track || !c.mixer) return []

    return this.view(track, c.mixer.time)
  }

  /**
   * @param {boolean} visible
   * @returns
   */
  updateVisibility(visible) {
    this.visible = visible

    if (!visible) return this.destroy()
    if (!this.world?.characters) return

    // Setup the charts if it hasn't been done yet.
    for (const c of this.world.characters) {
      this.setupCharts(c.options.name)
      this.update(c)
    }
  }

  /**
   * @param {Character} char
   */
  update(char, options = {seeking: false}) {
    if (!this.domElement) return
    if (this.world?.params.paused && !options.seeking) return

    // Destroy the chart if it is not visible.
    if (!this.visible) return

    const {name} = char.options

    const charts = this.charts.get(name)

    // Setup the charts if it hasn't been done yet.
    this.setupCharts(name)

    this.tracks.forEach((id) => {
      const track = char.currentClip?.tracks[id]
      if (!track) return

      const {chart} = charts?.get(id) ?? {}
      if (!chart || !char.mixer) return

      // Apply the dataset.
      const view = this.view(track, char.mixer.time)

      // Adjust the chart scaling.
      const scale = chart.config.options?.scales?.x

      if (scale) {
        scale.min = view.start
        scale.max = view.end
      }

      view.series.forEach((points, axis) => {
        chart.data.datasets[axis].data = points
        chart.data.datasets[axis].clip = false
      })
    })

    p.u(() => {
      this.tracks.forEach((t) => {
        charts?.get(t)?.chart?.update()
      })
    })
  }

  // Fully destroy the chart.
  destroy() {
    if (this.charts.size === 0) return

    for (const [character, tracks] of this.charts) {
      for (const [track, state] of tracks) {
        const {chart, canvas} = state

        chart.destroy()
        canvas.remove()

        this.charts.get(character)?.delete(track)
      }

      this.charts.delete(character)
    }

    document
      .querySelectorAll('div[data-plotter-character]')
      .forEach((c) => c.remove())
  }

  /**
   * @param {THREE.KeyframeTrack} track
   * @param {number} now
   */
  view(track, now) {
    return keyframesAt(track, {
      from: now,
      axes: this.axes,
      offset: this.offset,
      windowSize: this.windowSize,
    })
  }

  get interval() {
    return 1000 / this.fps
  }

  run() {
    clearInterval(this.timer)

    this.timer = setInterval(() => {
      p.o(() => {
        this.world?.characters?.forEach(this.update.bind(this))
      })
    }, this.interval)
  }
}

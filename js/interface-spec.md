## External Body Space

- Slider for the % possibility of freeze when the acceleration decrease (to show the external body space)
- When graph is below certain threshold, pause it
  - pause หมดเลย​ (ไปก่อน)
  - pause แค่บางส่วน (ค่อยทำ)
- Parameter: หยุดนานแค่ไหน

## Feature: Graph

- Graph Legends
  - Legend: character left/right
  - Legend: color legend (แดง x, เขียว y)
  - Legend: parts, e.g. "Hand", etc.

- Scrollable views in graph

- Graphing energy and delays
  - Energy and delays applies to timing, so they affect the x (time) scale, unlike others which affect the y scale.

## Visualization

- axes -> according to selected
- body parts -> according to selected
  - blacklist อันที่ไม่ค่อยเปลี่ยน ไม่ต้องแสดง

--- Completed ---

- Body Parts Checklist
- Equation
  - Threshold
  - min, max -> differently for each equation
- Axes: X, Y, Z

--- Console Notes ---

## Plotter Parameters

```ts
p.axes = ['x', 'y']
p.select(/leg|arm/i)
```

## Transform Parameters

```ts
w.transform('capMax', {
  // Select axes (x, y, z)
  axis: ['x'],

  // Define threshold
  threshold: 0.7,

  // Define body parts to apply to (regex match)
  tracks: /leg/i
})

w.transform('capMin', {
  axis: ['y'],
  threshold: 0.2,
  tracks: /hand/i
})
```

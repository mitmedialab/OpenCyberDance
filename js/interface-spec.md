# Interface

- Apply to all
  - ทุกๆ body parts ที่เราสนใจ
- Apply to each individually

## Visualization

- axes -> according to selected
- body parts -> according to selected
  - blacklist อันที่ไม่ค่อยเปลี่ยน ไม่ต้องแสดง
- graph legend/label
  - character left/right
  - scrollable to find each one
  - "Hand", etc.
  - color legend (แดง x, เขียว y)

## Body Parts Checklist

- [ ] Head
- [ ] Body
- [ ] Left Arm
- [Select All]

## Equation

- Equation Type
- Threshold
  - min, max -> differently for each equation
    - 0.1 - 0.9
    - 100 - 1000 (track timing len)
    - differential order

## Axes

- [ ] X
- [ ] Y
- [ ] Z
- [Select All]

```ts
head: /Head|Neck/
body: /Hips|Spine/
leftArm: /LeftShoulder|LeftArm|LeftForeArm|LeftHand|LeftInHand/
rightArm: /RightShoulder|RightArm|RightForeArm|RightHand|RightInHand/
leftLeg: /LeftUpLeg|LeftLeg|LeftFoot/
rightLeg: /RightUpLeg|RightLeg|RightFoot/
```

Interface
- Dropdown
  - Filters

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
````

## External Body Space

- Slider for the % possibility of freeze when the acceleration decrease (to show the external body space)
- When graph is below certain threshold, pause it
  - pause หมดเลย​ (ไปก่อน)
  - pause แค่บางส่วน (ค่อยทำ)
- หยุดนานแค่ไหน? กำหนดเองได้
  - Parameters
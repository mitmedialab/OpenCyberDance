export interface Accessor {
  bufferView: number
  componentType: number
  count: number
  max?: number[]
  min?: number[]
  type: Type
}

export enum Type {
  Mat4 = 'MAT4',
  Scalar = 'SCALAR',
  Vec2 = 'VEC2',
  Vec3 = 'VEC3',
  Vec4 = 'VEC4',
}

export interface Animation {
  channels: Channel[]
  name: string
  samplers: Sampler[]
}

export interface Channel {
  sampler: number
  target: Target
}

export interface Target {
  node: number
  path: Path
}

export enum Path {
  Rotation = 'rotation',
  Scale = 'scale',
  Translation = 'translation',
}

export interface Sampler {
  input: number
  interpolation: Interpolation
  output: number
}

export enum Interpolation {
  Linear = 'LINEAR',
  Step = 'STEP',
}

export interface Asset {
  generator: string
  version: string
}

export interface BufferView {
  buffer: number
  byteLength: number
  byteOffset: number
  target?: number
}

export interface Buffer {
  byteLength: number
  uri: string
}

export interface Material {
  doubleSided: boolean
  extensions: Extensions
  name: string
  pbrMetallicRoughness: PbrMetallicRoughness
}

export interface Extensions {
  KHR_materials_specular: KHRMaterialsSpecular
  KHR_materials_ior: KHRMaterialsIor
}

export interface KHRMaterialsIor {
  ior: number
}

export interface KHRMaterialsSpecular {
  specularColorFactor: number[]
}

export interface PbrMetallicRoughness {
  baseColorFactor: number[]
  metallicFactor: number
  roughnessFactor: number
}

export interface Mesh {
  name: string
  primitives: Primitive[]
}

export interface Primitive {
  attributes: Attributes
  indices: number
  material: number
}

export interface Attributes {
  POSITION: number
  NORMAL: number
  TEXCOORD_0: number
  JOINTS_0: number
  WEIGHTS_0: number
}

export interface Node {
  name: string
  rotation?: number[]
  translation?: number[]
  children?: number[]
  scale?: number[]
  mesh?: number
  skin?: number
}

export interface Scene {
  name: string
  nodes: number[]
}

export interface Skin {
  inverseBindMatrices: number
  joints: number[]
  name: string
}

// Converts JSON strings to/from your types
// and asserts the results of JSON.parse at runtime
export class Convert {
  public static toWelcome(json: string): Welcome {
    return cast(JSON.parse(json), r('Welcome'))
  }

  public static welcomeToJson(value: Welcome): string {
    return JSON.stringify(uncast(value, r('Welcome')), null, 2)
  }
}

function invalidValue(typ: any, val: any, key: any = ''): never {
  if (key) {
    throw Error(
      `Invalid value for key "${key}". Expected type ${JSON.stringify(
        typ,
      )} but got ${JSON.stringify(val)}`,
    )
  }
  throw Error(
    `Invalid value ${JSON.stringify(val)} for type ${JSON.stringify(typ)}`,
  )
}

function jsonToJSProps(typ: any): any {
  if (typ.jsonToJS === undefined) {
    const map: any = {}
    typ.props.forEach((p: any) => (map[p.json] = { key: p.js, typ: p.typ }))
    typ.jsonToJS = map
  }
  return typ.jsonToJS
}

function jsToJSONProps(typ: any): any {
  if (typ.jsToJSON === undefined) {
    const map: any = {}
    typ.props.forEach((p: any) => (map[p.js] = { key: p.json, typ: p.typ }))
    typ.jsToJSON = map
  }
  return typ.jsToJSON
}

function transform(val: any, typ: any, getProps: any, key: any = ''): any {
  function transformPrimitive(typ: string, val: any): any {
    if (typeof typ === typeof val) return val
    return invalidValue(typ, val, key)
  }

  function transformUnion(typs: any[], val: any): any {
    // val must validate against one typ in typs
    const l = typs.length
    for (let i = 0; i < l; i++) {
      const typ = typs[i]
      try {
        return transform(val, typ, getProps)
      } catch (_) {}
    }
    return invalidValue(typs, val)
  }

  function transformEnum(cases: string[], val: any): any {
    if (cases.indexOf(val) !== -1) return val
    return invalidValue(cases, val)
  }

  function transformArray(typ: any, val: any): any {
    // val must be an array with no invalid elements
    if (!Array.isArray(val)) return invalidValue('array', val)
    return val.map((el) => transform(el, typ, getProps))
  }

  function transformDate(val: any): any {
    if (val === null) {
      return null
    }
    const d = new Date(val)
    if (isNaN(d.valueOf())) {
      return invalidValue('Date', val)
    }
    return d
  }

  function transformObject(
    props: { [k: string]: any },
    additional: any,
    val: any,
  ): any {
    if (val === null || typeof val !== 'object' || Array.isArray(val)) {
      return invalidValue('object', val)
    }
    const result: any = {}
    Object.getOwnPropertyNames(props).forEach((key) => {
      const prop = props[key]
      const v = Object.prototype.hasOwnProperty.call(val, key)
        ? val[key]
        : undefined
      result[prop.key] = transform(v, prop.typ, getProps, prop.key)
    })
    Object.getOwnPropertyNames(val).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(props, key)) {
        result[key] = transform(val[key], additional, getProps, key)
      }
    })
    return result
  }

  if (typ === 'any') return val
  if (typ === null) {
    if (val === null) return val
    return invalidValue(typ, val)
  }
  if (typ === false) return invalidValue(typ, val)
  while (typeof typ === 'object' && typ.ref !== undefined) {
    typ = typeMap[typ.ref]
  }
  if (Array.isArray(typ)) return transformEnum(typ, val)
  if (typeof typ === 'object') {
    return typ.hasOwnProperty('unionMembers')
      ? transformUnion(typ.unionMembers, val)
      : typ.hasOwnProperty('arrayItems')
        ? transformArray(typ.arrayItems, val)
        : typ.hasOwnProperty('props')
          ? transformObject(getProps(typ), typ.additional, val)
          : invalidValue(typ, val)
  }
  // Numbers can be parsed by Date but shouldn't be.
  if (typ === Date && typeof val !== 'number') return transformDate(val)
  return transformPrimitive(typ, val)
}

function cast<T>(val: any, typ: any): T {
  return transform(val, typ, jsonToJSProps)
}

function uncast<T>(val: T, typ: any): any {
  return transform(val, typ, jsToJSONProps)
}

function a(typ: any) {
  return { arrayItems: typ }
}

function u(...typs: any[]) {
  return { unionMembers: typs }
}

function o(props: any[], additional: any) {
  return { props, additional }
}

function m(additional: any) {
  return { props: [], additional }
}

function r(name: string) {
  return { ref: name }
}

const typeMap: any = {
  Welcome: o(
    [
      { json: 'asset', js: 'asset', typ: r('Asset') },
      { json: 'extensionsUsed', js: 'extensionsUsed', typ: a('') },
      { json: 'scene', js: 'scene', typ: 0 },
      { json: 'scenes', js: 'scenes', typ: a(r('Scene')) },
      { json: 'nodes', js: 'nodes', typ: a(r('Node')) },
      { json: 'animations', js: 'animations', typ: a(r('Animation')) },
      { json: 'materials', js: 'materials', typ: a(r('Material')) },
      { json: 'meshes', js: 'meshes', typ: a(r('Mesh')) },
      { json: 'skins', js: 'skins', typ: a(r('Skin')) },
      { json: 'accessors', js: 'accessors', typ: a(r('Accessor')) },
      { json: 'bufferViews', js: 'bufferViews', typ: a(r('BufferView')) },
      { json: 'buffers', js: 'buffers', typ: a(r('Buffer')) },
    ],
    false,
  ),
  Accessor: o(
    [
      { json: 'bufferView', js: 'bufferView', typ: 0 },
      { json: 'componentType', js: 'componentType', typ: 0 },
      { json: 'count', js: 'count', typ: 0 },
      { json: 'max', js: 'max', typ: u(undefined, a(3.14)) },
      { json: 'min', js: 'min', typ: u(undefined, a(3.14)) },
      { json: 'type', js: 'type', typ: r('Type') },
    ],
    false,
  ),
  Animation: o(
    [
      { json: 'channels', js: 'channels', typ: a(r('Channel')) },
      { json: 'name', js: 'name', typ: '' },
      { json: 'samplers', js: 'samplers', typ: a(r('Sampler')) },
    ],
    false,
  ),
  Channel: o(
    [
      { json: 'sampler', js: 'sampler', typ: 0 },
      { json: 'target', js: 'target', typ: r('Target') },
    ],
    false,
  ),
  Target: o(
    [
      { json: 'node', js: 'node', typ: 0 },
      { json: 'path', js: 'path', typ: r('Path') },
    ],
    false,
  ),
  Sampler: o(
    [
      { json: 'input', js: 'input', typ: 0 },
      { json: 'interpolation', js: 'interpolation', typ: r('Interpolation') },
      { json: 'output', js: 'output', typ: 0 },
    ],
    false,
  ),
  Asset: o(
    [
      { json: 'generator', js: 'generator', typ: '' },
      { json: 'version', js: 'version', typ: '' },
    ],
    false,
  ),
  BufferView: o(
    [
      { json: 'buffer', js: 'buffer', typ: 0 },
      { json: 'byteLength', js: 'byteLength', typ: 0 },
      { json: 'byteOffset', js: 'byteOffset', typ: 0 },
      { json: 'target', js: 'target', typ: u(undefined, 0) },
    ],
    false,
  ),
  Buffer: o(
    [
      { json: 'byteLength', js: 'byteLength', typ: 0 },
      { json: 'uri', js: 'uri', typ: '' },
    ],
    false,
  ),
  Material: o(
    [
      { json: 'doubleSided', js: 'doubleSided', typ: true },
      { json: 'extensions', js: 'extensions', typ: r('Extensions') },
      { json: 'name', js: 'name', typ: '' },
      {
        json: 'pbrMetallicRoughness',
        js: 'pbrMetallicRoughness',
        typ: r('PbrMetallicRoughness'),
      },
    ],
    false,
  ),
  Extensions: o(
    [
      {
        json: 'KHR_materials_specular',
        js: 'KHR_materials_specular',
        typ: r('KHRMaterialsSpecular'),
      },
      {
        json: 'KHR_materials_ior',
        js: 'KHR_materials_ior',
        typ: r('KHRMaterialsIor'),
      },
    ],
    false,
  ),
  KHRMaterialsIor: o([{ json: 'ior', js: 'ior', typ: 3.14 }], false),
  KHRMaterialsSpecular: o(
    [{ json: 'specularColorFactor', js: 'specularColorFactor', typ: a(3.14) }],
    false,
  ),
  PbrMetallicRoughness: o(
    [
      { json: 'baseColorFactor', js: 'baseColorFactor', typ: a(3.14) },
      { json: 'metallicFactor', js: 'metallicFactor', typ: 3.14 },
      { json: 'roughnessFactor', js: 'roughnessFactor', typ: 3.14 },
    ],
    false,
  ),
  Mesh: o(
    [
      { json: 'name', js: 'name', typ: '' },
      { json: 'primitives', js: 'primitives', typ: a(r('Primitive')) },
    ],
    false,
  ),
  Primitive: o(
    [
      { json: 'attributes', js: 'attributes', typ: r('Attributes') },
      { json: 'indices', js: 'indices', typ: 0 },
      { json: 'material', js: 'material', typ: 0 },
    ],
    false,
  ),
  Attributes: o(
    [
      { json: 'POSITION', js: 'POSITION', typ: 0 },
      { json: 'NORMAL', js: 'NORMAL', typ: 0 },
      { json: 'TEXCOORD_0', js: 'TEXCOORD_0', typ: 0 },
      { json: 'JOINTS_0', js: 'JOINTS_0', typ: 0 },
      { json: 'WEIGHTS_0', js: 'WEIGHTS_0', typ: 0 },
    ],
    false,
  ),
  Node: o(
    [
      { json: 'name', js: 'name', typ: '' },
      { json: 'rotation', js: 'rotation', typ: u(undefined, a(3.14)) },
      { json: 'translation', js: 'translation', typ: u(undefined, a(3.14)) },
      { json: 'children', js: 'children', typ: u(undefined, a(0)) },
      { json: 'scale', js: 'scale', typ: u(undefined, a(3.14)) },
      { json: 'mesh', js: 'mesh', typ: u(undefined, 0) },
      { json: 'skin', js: 'skin', typ: u(undefined, 0) },
    ],
    false,
  ),
  Scene: o(
    [
      { json: 'name', js: 'name', typ: '' },
      { json: 'nodes', js: 'nodes', typ: a(0) },
    ],
    false,
  ),
  Skin: o(
    [
      { json: 'inverseBindMatrices', js: 'inverseBindMatrices', typ: 0 },
      { json: 'joints', js: 'joints', typ: a(0) },
      { json: 'name', js: 'name', typ: '' },
    ],
    false,
  ),
  Type: ['MAT4', 'SCALAR', 'VEC2', 'VEC3', 'VEC4'],
  Path: ['rotation', 'scale', 'translation'],
  Interpolation: ['LINEAR', 'STEP'],
}

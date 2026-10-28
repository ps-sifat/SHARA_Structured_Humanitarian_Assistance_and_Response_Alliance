import { PLACES, type Place } from './data'
import { DISTRICT_SHAPES, H, OUTLINE, W } from './bdgeo'

export { W, H }
export const outlinePath = OUTLINE

type Sub = { path: string; c: [number, number]; place?: Place }
type Cell = { key: string; path: string; c: [number, number]; subs: Sub[]; place?: Place; flooded: boolean }

const used = new Map<string, number>()
const subOf = new Map<string, [number, number]>()

export const CELLS: Cell[] = DISTRICT_SHAPES.map((d) => {
  const subs: Sub[] = d.subs.map((s) => ({ path: s.d, c: s.c }))
  const here = PLACES.filter((p) => p.district === d.name)
  here.forEach((p) => {
    const i = used.get(d.name) ?? 0
    used.set(d.name, i + 1)
    const s = subs.length ? subs[(i * 3) % subs.length] : undefined
    if (s) s.place = p
    subOf.set(p.id, s ? s.c : d.c)
  })
  const first = here[0]
  return { key: d.name, path: d.d, c: d.c, subs, place: first, flooded: here.some((p) => p.flooded) }
})

export const pos = (p: Place): [number, number] => subOf.get(p.id) ?? [W / 2, H / 2]

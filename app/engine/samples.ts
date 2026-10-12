export interface SampleSvg { id: string, name: string, svg: string }

export const SAMPLES: SampleSvg[] = [
  {
    id: 'heart',
    name: 'Heart',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 90"><path d="M50 88 C20 62 2 44 2 26 C2 12 13 2 27 2 C37 2 46 8 50 17 C54 8 63 2 73 2 C87 2 98 12 98 26 C98 44 80 62 50 88 Z"/></svg>`
  },
  {
    id: 'star',
    name: 'Star',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,3 61,36 96,36 68,57 79,91 50,70 21,91 32,57 4,36 39,36"/></svg>`
  },
  {
    id: 'rounded-rect',
    name: 'Rounded rectangle',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><rect x="0" y="0" width="120" height="80" rx="16" ry="16"/></svg>`
  },
  {
    id: 'ring',
    name: 'Ring (hole)',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0ZM50 30A20 20 0 1 0 50 70A20 20 0 1 0 50 30Z"/></svg>`
  }
]

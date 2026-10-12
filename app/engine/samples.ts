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
  },
  {
    id: 'cloud',
    name: 'Cloud',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70"><path d="M22 52c0-12 9-22 21-23 3-12 14-20 27-18 15 2 26 14 26 29 0 2 0 4-1 7 10 2 18 11 18 22 0 13-10 23-23 23H31c-13 0-23-10-23-22 0-10 6-18 14-18z"/></svg>`
  },
  {
    id: 'circle',
    name: 'Circle',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="42"/></svg>`
  },
  {
    id: 'box-line',
    name: 'Box with line',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill-rule="evenodd" d="M12 12H88V88H12ZM12 46H88V54H12Z"/></svg>`
  },
  {
    id: 'triangle',
    name: 'Triangle',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,8 92,92 8,92"/></svg>`
  },
  {
    id: 'hexagon',
    name: 'Hexagon',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,5 91,27.5 91,72.5 50,95 9,72.5 9,27.5"/></svg>`
  },
  {
    id: 'plus',
    name: 'Plus',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M38 10h24v28h28v24H62v28H38V62H10V38h28z"/></svg>`
  },
  {
    id: 'arrow',
    name: 'Arrow',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="10,35 58,35 58,18 92,50 58,82 58,65 10,65"/></svg>`
  },
  {
    id: 'house',
    name: 'House',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,8 95,42 85,42 85,92 15,92 15,42 5,42"/></svg>`
  }
]

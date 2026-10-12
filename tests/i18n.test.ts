import { describe, expect, it } from 'vitest'
import { messages, type Locale } from '../app/i18n/messages'

function leafKeys(dict: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = []
  for (const [k, v] of Object.entries(dict)) {
    const path = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out.push(path)
    else if (v && typeof v === 'object') out.push(...leafKeys(v as Record<string, unknown>, path))
  }
  return out.sort()
}

describe('i18n messages', () => {
  it('en and pt-BR share the same keys', () => {
    const en = leafKeys(messages.en as Record<string, unknown>)
    const pt = leafKeys(messages['pt-BR'] as Record<string, unknown>)
    expect(pt).toEqual(en)
  })

  it('sample ids resolve', () => {
    const ids = ['heart', 'star', 'rounded-rect', 'ring'] as const
    for (const loc of ['en', 'pt-BR'] as Locale[]) {
      for (const id of ids) {
        const v = (messages[loc].sample as Record<string, string>)[id]
        expect(v).toBeTruthy()
      }
    }
  })
})

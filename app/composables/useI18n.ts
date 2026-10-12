import { computed, ref, watch } from 'vue'
import { LOCALES, messages, type Locale } from '~/i18n/messages'

const STORAGE_KEY = 'svg-parametric-locale'

function defaultLocale(): Locale {
  if (import.meta.client && typeof navigator !== 'undefined') {
    const lang = navigator.language
    if (lang.startsWith('pt')) return 'pt-BR'
  }
  return 'en'
}

function readStoredLocale(): Locale {
  if (!import.meta.client) return defaultLocale()
  const raw = localStorage.getItem(STORAGE_KEY)
  return raw === 'pt-BR' || raw === 'en' ? raw : defaultLocale()
}

const locale = ref<Locale>(readStoredLocale())

function getByPath(dict: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.')
  let cur: unknown = dict
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return typeof cur === 'string' ? cur : undefined
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`))
}

let started = false

function applyDocumentLocale(loc: Locale) {
  if (!import.meta.client) return
  document.documentElement.lang = loc === 'pt-BR' ? 'pt-BR' : 'en'
  const meta = messages[loc].meta as { title?: string, description?: string }
  if (meta.title) document.title = meta.title
  const desc = document.querySelector('meta[name="description"]')
  if (desc && meta.description) desc.setAttribute('content', meta.description)
}

function start() {
  if (started) return
  started = true
  applyDocumentLocale(locale.value)
  watch(locale, (loc) => {
    if (import.meta.client) localStorage.setItem(STORAGE_KEY, loc)
    applyDocumentLocale(loc)
  })
}

export function useI18n() {
  start()
  const dict = computed(() => messages[locale.value])

  function t(path: string, params?: Record<string, string | number>): string {
    const raw = getByPath(dict.value as Record<string, unknown>, path)
      ?? getByPath(messages.en as Record<string, unknown>, path)
      ?? path
    return interpolate(raw, params)
  }

  function setLocale(loc: Locale) {
    locale.value = loc
  }

  function toggleLocale() {
    locale.value = locale.value === 'en' ? 'pt-BR' : 'en'
  }

  function sampleName(id: string): string {
    return t(`sample.${id}`)
  }

  return { locale, locales: LOCALES, t, setLocale, toggleLocale, sampleName }
}

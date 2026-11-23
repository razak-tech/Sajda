export type Prayer = 'Fajr' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha'

export type Occurrence = {
  name: Prayer
  date: string
  time: string
  instant: string
}

export type Schedule = { fetched_at: string; prayers: Occurrence[] }

export const arabicPrayers: Record<Prayer, string> = {
  Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء',
}

export function localDate(now: number, timezone: string) {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (name: string) => date.find(({ type }) => type === name)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function nextPrayer(schedule: Schedule | null, now: number, timezone: string) {
  const today = localDate(now, timezone)
  const lastToday = schedule?.prayers.find(({ date, name }) => date === today && name === 'Isha')
  if (!lastToday) return null
  const next = schedule?.prayers.find(({ instant }) => Date.parse(instant) > now)
  if (!next) return null
  const tomorrow = new Date(`${today}T00:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  if (next.date !== today && next.date !== tomorrow.toISOString().slice(0, 10)) return null
  return { ...next, tomorrow: next.date !== today }
}

export function countdown(instant: string, now: number) {
  const seconds = Math.max(0, Math.ceil((Date.parse(instant) - now) / 1000))
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0')).join(':')
}

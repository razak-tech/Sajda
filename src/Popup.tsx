import type { CSSProperties } from 'react'
import { arabicPrayers, countdown, localDate, type nextPrayer, type Schedule } from './prayers'
import locationPin from './assets/lucide-map-pin.svg'

type Props = {
  ar: boolean
  city: string
  cityName: string
  timezone: string
  schedule: Schedule
  next: ReturnType<typeof nextPrayer>
  now: number
  offline: boolean
  loading: boolean
  retry: () => void
}

export function Popup({ ar, city, cityName, timezone, schedule, next, now, offline, loading, retry }: Props) {
  const local = ar ? `بتوقيت ${cityName} المحلي` : `${cityName} local time`
  const today = localDate(now, timezone)
  const prayers = schedule.prayers.filter((prayer) => prayer.date === today)
  const previous = next ? schedule.prayers[schedule.prayers.findIndex((prayer) => prayer.instant === next.instant) - 1] : undefined
  const nextTime = next ? Date.parse(next.instant) : 0
  const interval = previous ? nextTime - Date.parse(previous.instant) : 0
  const remaining = interval > 0 ? Math.min(1, Math.max(0, (nextTime - now) / interval)) : 0
  return <>
    <div className="dashboard-heading" aria-label={ar ? 'مواقيت الصلاة' : 'Prayer times'}>
      <span className="dashboard-location"><img src={locationPin} alt="" /><bdi>{city}</bdi></span>
      <time className="local-clock" dir="ltr">{new Intl.DateTimeFormat(ar ? 'ar' : 'en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit' }).format(now)}</time>
    </div>
    {next ? <section className="prayer prayer-hero">
      <div className="hero-details" aria-live="polite" aria-atomic="true">
        <p className="caption">{ar ? 'الصلاة القادمة' : 'Next prayer'}</p>
        <h1>{ar ? arabicPrayers[next.name] : next.name}</h1>
        <time className="prayer-time" dir="ltr" dateTime={next.instant}>{next.time}</time>
        {next.tomorrow && <p className="caption">{ar ? 'غدًا' : 'Tomorrow'}</p>}
      </div>
      <div className="hero-clock">
        <div className="countdown-ring" style={{ '--remaining': `${remaining * 100}%` } as CSSProperties}>
          <p className="countdown" role="timer" aria-live="off" aria-label={ar ? 'الوقت المتبقي' : 'Time remaining'}>
            <bdi dir="ltr">{countdown(next.instant, now)}</bdi>
          </p>
        </div>
      </div>
    </section> : loading ? <section className="prayer loading" role="status">
      <p className="caption">{ar ? 'مواقيت الصلاة' : 'Prayer schedule'}</p>
      <h2>{ar ? 'جارٍ تحميل مواقيت الصلاة…' : 'Loading prayer times…'}</h2>
    </section> : <section className="prayer unavailable">
      <p className="caption">{ar ? 'مواقيت الصلاة' : 'Prayer schedule'}</p>
      <div role="status">
        <h2>{ar ? 'المواقيت غير متاحة' : 'Schedule unavailable'}</h2>
        <p className="caption">{ar ? 'تحقّق من اتصالك بالإنترنت.' : 'No usable times. Check your connection.'}</p>
      </div>
      <button className="action error" onClick={retry}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>
    </section>}
    {!!prayers.length && <div className="prayer-table-card"><table className="prayer-table" aria-label={ar ? 'مواقيت صلاة اليوم' : 'Today’s prayer times'}>
      <tbody>{prayers.map((prayer) => <tr key={prayer.name} className={next?.instant === prayer.instant ? 'upcoming' : undefined}>
        <th scope="row">{ar ? arabicPrayers[prayer.name] : prayer.name}</th>
        <td><time dir="ltr" dateTime={prayer.instant}>{prayer.time}</time></td>
      </tr>)}</tbody>
    </table></div>}
    <footer className="popup-status" role="status">
      {next && offline ? (ar ? 'غير متصل · مواقيت محفوظة' : 'Offline · Using saved times')
        : next || loading ? local : (ar ? 'التذكيرات متوقفة حتى تحديث المواقيت' : 'Reminders paused until times load')}
    </footer>
  </>
}

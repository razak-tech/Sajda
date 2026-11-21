import { countdown, type nextPrayer } from './prayers'

const arabicPrayers = { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' }

type Props = {
  ar: boolean
  city: string
  cityName: string
  next: ReturnType<typeof nextPrayer>
  now: number
  offline: boolean
  loading: boolean
  retry: () => void
}

export function Popup({ ar, city, cityName, next, now, offline, loading, retry }: Props) {
  const local = ar ? `بتوقيت ${cityName} المحلي` : `${cityName} local time`
  return <>
    <p className="caption">{city}</p>
    {next ? <section className="prayer">
      <p className="caption">{ar ? 'الصلاة القادمة' : 'Next prayer'}</p>
      <div className="prayer-line" aria-live="polite" aria-atomic="true">
        <h1>{ar ? arabicPrayers[next.name] : next.name}</h1>
        <time dir="ltr" dateTime={next.instant}>{next.time}</time>
      </div>
      {next.tomorrow && <p className="caption">{ar ? `غدًا · ${local}` : `Tomorrow · ${local}`}</p>}
      <p className="countdown" role="timer" aria-live="off"><bdi dir="ltr">{countdown(next.instant, now)}</bdi></p>
      <p className="caption">{ar ? 'الوقت المتبقي' : 'Time remaining'}</p>
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
    <footer className="popup-status" role="status">
      {next && offline ? (ar ? 'غير متصل · مواقيت محفوظة' : 'Offline · Using saved times')
        : next || loading ? local : (ar ? 'التذكيرات متوقفة حتى تحديث المواقيت' : 'Reminders paused until times load')}
    </footer>
  </>
}

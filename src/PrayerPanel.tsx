import { arabicPrayers, countdown, localDate, nextPrayer, type Prayer, type Schedule } from './prayers'
import { prayerArtwork } from './prayerArtwork'
import locationIcon from './assets/lucide-map-pin.svg'
import settingsIcon from './assets/lucide-settings.svg'

type Props = {
  ar: boolean
  city: string
  timezone: string
  schedule: Schedule
  now: number
  offline: boolean
  loading: boolean
  settings: () => void
  retry: () => void
}

export function PrayerPanel({ ar, city, timezone, schedule, now, offline, loading, settings, retry }: Props) {
  const today = localDate(now, timezone)
  const prayers = schedule.prayers.filter((prayer) => prayer.date === today)
  const next = nextPrayer(schedule, now, timezone)
  const prayerName = (name: Prayer) => ar ? arabicPrayers[name] : name
  const localTime = new Intl.DateTimeFormat(ar ? 'ar' : 'en-GB', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit',
  }).format(now)
  return <div className="prayer-view">
    <div className="prayer-toolbar">
      <span className="prayer-city" title={city}><img src={locationIcon} alt="" /><bdi>{city}</bdi></span>
      <time className="caption local-time" dir="ltr">{localTime}</time>
      <button type="button" className="icon" onClick={settings} aria-label={ar ? 'الإعدادات' : 'Settings'}>
        <img src={settingsIcon} alt="" />
      </button>
    </div>

    {next ? <section className="prayer-hero">
      <img className="prayer-art" src={prayerArtwork[next.name]} alt="" />
      <div className="prayer-hero-details">
        <p className="prayer-kicker">{ar ? 'الصلاة القادمة' : 'Next prayer'}</p>
        <h1>{prayerName(next.name)}</h1>
        <p className="prayer-countdown" role="timer" aria-label={ar ? 'الوقت المتبقي' : 'Time left'}>
          <bdi dir="ltr">{countdown(next.instant, now)}</bdi>
        </p>
        <p className="scheduled-time caption">
          <time dir="ltr" dateTime={next.instant}>{next.time}</time>
          {next.tomorrow && <> · {ar ? 'غدًا' : 'Tomorrow'}</>}
        </p>
      </div>
    </section> : <section className="prayer-unavailable" role="status">
      <h1>{loading ? (ar ? 'جارٍ تحميل المواقيت…' : 'Loading prayer times…')
        : (ar ? 'المواقيت غير متاحة' : 'Schedule unavailable')}</h1>
      {!loading && <button className="action secondary" onClick={retry}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>}
    </section>}

    {!!prayers.length && <ul className="prayer-times" aria-label={ar ? 'مواقيت اليوم' : 'Today’s prayers'}>
      {prayers.map((prayer) => <li key={prayer.name}
        aria-current={next?.instant === prayer.instant ? 'true' : undefined}>
        <span>{prayerName(prayer.name)}</span>
        <time dir="ltr" dateTime={prayer.instant}>{prayer.time}</time>
      </li>)}
    </ul>}

    {offline && <p className="prayer-offline caption" role="status">
      {ar ? 'غير متصل · مواقيت محفوظة' : 'Offline · Using saved times'}
    </p>}
  </div>
}

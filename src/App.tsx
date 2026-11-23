import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EdgePicker, PrayerPanel } from './Edge'
import { Chrome } from './Chrome'
import { CityPicker } from './CityPicker'
import { LanguagePicker } from './LanguagePicker'
import { Popup } from './Popup'
import { StartupSwitch } from './StartupSwitch'
import { cityLabel, type City, type Language } from './cities'
import { nextPrayer, type Schedule } from './prayers'

type View = 'popup' | 'setup' | 'startup' | 'settings' | 'picker' | 'setup-load' | 'change-load'
type Location = { city: City; schedule: Schedule }
export type Snapshot = {
  location: Location | null
  language: Language
  offline: boolean
  refreshing: boolean
  startup: boolean
  setup_city: City | null
  revision: number
}

export function App() {
  const [view, setView] = useState<View>('setup')
  const [language, setLanguage] = useState<Language>('en')
  const [active, setActive] = useState<Location | null>(null)
  const [candidate, setCandidate] = useState<City | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [offline, setOffline] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [preferenceError, setPreferenceError] = useState(false)
  const [startup, setStartup] = useState(false)
  const [startupChoice, setStartupChoice] = useState(false)
  const [savingStartup, setSavingStartup] = useState(false)
  const [ready, setReady] = useState(!isTauri())
  const [now, setNow] = useState(Date.now)
  const request = useRef(0)
  const revision = useRef(-1)
  const frame = useRef<HTMLElement>(null)
  const ar = language === 'ar'
  const popup = view === 'popup' && active !== null
  const errorLabel = ar ? 'إعادة المحاولة' : 'Retry'
  const changeLabel = ar ? 'تغيير المدينة' : 'Change city'
  const cancelLabel = ar ? 'إلغاء' : 'Cancel'

  useEffect(() => {
    const tick = () => setNow(Date.now())
    const interval = window.setInterval(tick, 250)
    window.addEventListener('focus', tick)
    let disposed = false
    const listeners = isTauri() ? Promise.all([
      listen<Snapshot>('state-changed', ({ payload }) => applySnapshot(payload)),
      listen('open-settings', () => {
        setView((current) => current === 'popup' ? 'settings' : current)
      }),
      listen('open-popup', () => {
        setView((current) => ['settings', 'picker', 'change-load'].includes(current) ? 'popup' : current)
      }),
    ]) : Promise.resolve([])
    if (isTauri()) void listeners.then(() => invoke<Snapshot>('get_state')).then((snapshot) => {
      if (disposed) return
      applySnapshot(snapshot)
      if (snapshot.location) setView('popup')
      else if (snapshot.setup_city) void load(snapshot.setup_city, true)
    }).catch(() => setPreferenceError(true)).finally(() => {
      if (!disposed) setReady(true)
    })
    return () => {
      disposed = true
      window.removeEventListener('focus', tick)
      clearInterval(interval)
      void listeners.then((stops) => stops.forEach((stop) => stop()))
    }
  }, [])

  useLayoutEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = ar ? 'rtl' : 'ltr'
  }, [language, ar])

  useLayoutEffect(() => {
    const element = frame.current
    if (!element || !isTauri()) return
    let oldHeight = 0
    const resize = () => {
      const height = Math.ceil(element.getBoundingClientRect().height)
      if (height === oldHeight) return
      oldHeight = height
      void invoke('fit_window', { width: popup ? 600 : 400, height, popup })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [popup])

  function applySnapshot(snapshot: Snapshot) {
    if (snapshot.revision <= revision.current) return
    revision.current = snapshot.revision
    setActive(snapshot.location)
    setLanguage(snapshot.language)
    setOffline(snapshot.offline)
    setRefreshing(snapshot.refreshing)
    setStartup(snapshot.startup)
  }

  async function chooseLanguage(language: Language) {
    if (!isTauri()) {
      setLanguage(language)
      return
    }
    try {
      await invoke('save_language', { language })
      setPreferenceError(false)
    } catch {
      setPreferenceError(true)
    }
  }

  async function saveStartup(enabled: boolean, city: City | null = null) {
    setSavingStartup(true)
    try {
      const snapshot = await invoke<Snapshot>('save_startup', { enabled, setupCity: city })
      applySnapshot(snapshot)
      setPreferenceError(false)
      if (city) void load(city, true)
    } catch {
      setPreferenceError(true)
    } finally {
      setSavingStartup(false)
    }
  }

  async function load(city: City, setup: boolean) {
    const id = ++request.current
    setCandidate(city)
    setFailed(false)
    setLoading(true)
    setView(setup ? 'setup-load' : 'change-load')
    try {
      const schedule = await invoke<Schedule>('load_schedule', { city })
      if (request.current !== id) return
      setCommitting(true)
      const snapshot = await invoke<Snapshot>('save_location', { location: { city, schedule } })
      applySnapshot(snapshot)
      setView((current) => setup || current === 'popup' ? 'popup' : 'settings')
    } catch {
      if (request.current === id) setFailed(true)
    } finally {
      if (request.current === id) {
        setLoading(false)
        setCommitting(false)
      }
    }
  }

  async function cancel() {
    if (!active && view === 'setup-load') {
      try {
        await invoke('clear_setup')
      } catch {
        setPreferenceError(true)
        return
      }
    }
    ++request.current
    setCandidate(null)
    setFailed(false)
    setLoading(false)
    setView(active ? 'settings' : 'setup')
  }

  function dismiss() {
    if (isTauri()) void invoke('dismiss')
  }

  return <main ref={frame} className={`frame${popup ? ' popup' : ''}`} onKeyDown={(event) => {
    if (event.key === 'Escape') dismiss()
  }}>
    {(!popup || !nextPrayer(active.schedule, now, active.city.timezone)) && <Chrome ar={ar} close={dismiss} settings={popup ? () => setView('settings') : undefined} />}
    {popup && nextPrayer(active.schedule, now, active.city.timezone) && <PrayerPanel snapshot={{ location: active, language }} now={now} settings={() => setView('settings')} />}
    {popup && !nextPrayer(active.schedule, now, active.city.timezone) && <Popup ar={ar} city={cityLabel(active.city, language)} cityName={active.city.name}
      next={nextPrayer(active.schedule, now, active.city.timezone)} now={now} offline={offline}
      loading={refreshing} retry={() => void invoke('refresh_schedule').catch(() => undefined)} />}
    {preferenceError && !popup && <p className="notice error" role="alert">
      {ar ? 'تعذّر حفظ التفضيلات أو قراءتها.' : 'Couldn’t save or read your preferences.'}
    </p>}
    {ready && view === 'setup' && <>
      <p className="note">{ar ? 'الإعداد · ١ من ٣' : 'SETUP / 1 OF 3'}</p>
      <h1>{ar ? 'اختر مدينتك' : 'Choose your city'}</h1>
      <p className="description">{ar ? 'مواقيت الصلاة حسب التوقيت المحلي لمدينتك.' : 'Prayer times in your city’s local time.'}</p>
      <LanguagePicker language={language} select={(choice) => void chooseLanguage(choice)} />
      <CityPicker key={language} language={language} select={(city) => {
        setCandidate(city)
        setStartupChoice(startup)
        setView('startup')
      }} />
    </>}
    {view === 'startup' && candidate && <>
      <p className="note">{ar ? 'الإعداد · ٢ من ٣' : 'SETUP / 2 OF 3'}</p>
      <h1>{ar ? 'ابدأ مع ويندوز' : 'Start with Windows'}</h1>
      <p className="description">{ar ? 'شغّل سجدة تلقائيًا عند تسجيل الدخول لتبقى التذكيرات فعّالة في الخلفية.'
        : 'Launch Sajda at sign-in to keep prayer reminders running in the background.'}</p>
      <StartupSwitch ar={ar} enabled={startupChoice} disabled={savingStartup} change={setStartupChoice} />
      <p className="notice">{ar ? 'المدينة المختارة: ' : 'Selected city: '}<bdi>{cityLabel(candidate, language)}</bdi></p>
      <button className="action" disabled={savingStartup} onClick={() => void saveStartup(startupChoice, candidate)}>
        {ar ? 'متابعة' : 'Continue'}
      </button>
      <button className="action secondary" disabled={savingStartup} onClick={() => void cancel()}>
        {ar ? 'تغيير المدينة ←' : '← Change city'}
      </button>
    </>}
    {view === 'settings' && active && <>
      <h1>{ar ? 'الإعدادات' : 'Settings'}</h1>
      <EdgePicker ar={ar} />
      <section className="city-card">
        <p className="caption">{ar ? 'المدينة المختارة' : 'Selected city'}</p>
        <h2><bdi>{cityLabel(active.city, language)}</bdi></h2>
        <button className="action secondary" onClick={() => setView('picker')}>{changeLabel}</button>
      </section>
      <StartupSwitch ar={ar} enabled={startup} disabled={savingStartup} change={(value) => void saveStartup(value)} />
      <p className="caption">{ar ? 'تشغيل سجدة عند تسجيل الدخول.' : 'Launch Sajda automatically at sign-in.'}</p>
      <LanguagePicker language={language} select={(choice) => void chooseLanguage(choice)} />
      <p className="note">{ar ? 'تُحفظ التغييرات تلقائيًا.' : 'Changes are saved automatically.'}</p>
      <button className="action" onClick={() => setView('popup')}>{ar ? 'تم' : 'Done'}</button>
    </>}
    {view === 'picker' && active && <>
      <h1>{changeLabel}</h1>
      <p className="notice">{ar ? 'تبقى مواقيت مدينتك الحالية وتذكيراتها فعّالة حتى تجهز المواقيت الجديدة.'
        : `${active.city.name}’s times and reminders stay active until your new schedule is ready.`}</p>
      <CityPicker language={language} select={(city) => void load(city, false)} />
      <button className="action secondary" onClick={cancel}>{cancelLabel}</button>
    </>}
    {(view === 'setup-load' || view === 'change-load') && candidate && <>
      {view === 'setup-load' && <p className="note">{ar ? 'الإعداد · ٣ من ٣' : 'SETUP / 3 OF 3'}</p>}
      <h1>{view === 'change-load' ? changeLabel : ar ? 'مواقيتك، جاهزة قريبًا' : 'Your times, almost ready'}</h1>
      {active && <p className="notice">{ar ? 'تبقى مواقيت مدينتك الحالية وتذكيراتها فعّالة حتى تجهز المواقيت الجديدة.'
        : `${active.city.name}’s times and reminders stay active until your new schedule is ready.`}</p>}
      <h2><bdi>{cityLabel(candidate, language)}</bdi></h2>
      {!active && <p className="caption">{ar
        ? `البدء مع ويندوز: ${startup ? 'مفعّل' : 'متوقف'}`
        : `Start with Windows: ${startup ? 'On' : 'Off'}`}</p>}
      {!active && <p className="notice">{ar ? 'طريقة الحساب الافتراضية لمزوّد المواقيت.' : 'Using the provider’s default calculation method.'}</p>}
      {loading && <h2 role="status">{ar ? 'جارٍ تحميل مواقيت الصلاة…' : 'Loading prayer times…'}</h2>}
      {loading && !active && <p className="caption">{ar ? 'سنفتح سجدة عند اكتمال التحميل.' : 'Sajda will open when your schedule is ready.'}</p>}
      {failed && <>
        <p role="alert" className="notice error">{active
          ? (ar ? 'تعذّر تحميل المواقيت الجديدة. بقيت مدينتك الحالية كما هي.' : `Couldn’t load the new times. ${active.city.name} is still your current city.`)
          : (ar ? 'تعذّر تحميل المواقيت. اتصل بالإنترنت ثم أعد المحاولة.' : 'Couldn’t load prayer times. Connect to the internet and try again.')}</p>
        <button className="action" autoFocus onClick={() => void load(candidate, !active)}>{errorLabel}</button>
      </>}
      {(active || failed) && <button className="action secondary" disabled={committing} onClick={cancel}>{active ? cancelLabel : changeLabel}</button>}
    </>}
  </main>
}

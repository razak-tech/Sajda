import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Chrome } from './Chrome'
import { CityPicker } from './CityPicker'
import { LanguagePicker } from './LanguagePicker'
import { Popup } from './Popup'
import { cityLabel, type City, type Language } from './cities'
import { nextPrayer, type Schedule } from './prayers'

type View = 'popup' | 'setup' | 'settings' | 'picker' | 'setup-load' | 'change-load'
type Location = { city: City; schedule: Schedule }

export function App() {
  const [view, setView] = useState<View>('setup')
  const [language, setLanguage] = useState<Language>('en')
  const [active, setActive] = useState<Location | null>(null)
  const [candidate, setCandidate] = useState<City | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(Date.now)
  const request = useRef(0)
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
    if (!isTauri()) return () => clearInterval(interval)
    const unsubscribe = listen('open-settings', () => {
      setView((current) => current === 'popup' ? 'settings' : current)
    })
    return () => {
      window.removeEventListener('focus', tick)
      clearInterval(interval)
      void unsubscribe.then((stop) => stop())
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
      void invoke('fit_window', { width: popup ? 360 : 400, height, popup })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [popup])

  async function load(city: City, setup: boolean) {
    const id = ++request.current
    setCandidate(city)
    setFailed(false)
    setLoading(true)
    setView(setup ? 'setup-load' : 'change-load')
    try {
      const schedule = await invoke<Schedule>('load_schedule', { city })
      if (request.current !== id) return
      setActive({ city, schedule })
      setView(setup ? 'popup' : 'settings')
    } catch {
      if (request.current === id) setFailed(true)
    } finally {
      if (request.current === id) setLoading(false)
    }
  }

  function cancel() {
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
    <Chrome ar={ar} close={dismiss} settings={popup ? () => setView('settings') : undefined} />
    {popup && <Popup ar={ar} city={cityLabel(active.city, language)} cityName={active.city.name}
      next={nextPrayer(active.schedule, now, active.city.timezone)} now={now} offline={false}
      loading={loading} retry={() => void load(active.city, false)} />}
    {view === 'setup' && <>
      <p className="note">{ar ? 'الإعداد · ١ من ٣' : 'SETUP / 1 OF 3'}</p>
      <h1>{ar ? 'اختر مدينتك' : 'Choose your city'}</h1>
      <p className="description">{ar ? 'مواقيت الصلاة حسب التوقيت المحلي لمدينتك.' : 'Prayer times in your city’s local time.'}</p>
      <LanguagePicker language={language} select={setLanguage} />
      <CityPicker key={language} language={language} select={(city) => void load(city, true)} />
    </>}
    {view === 'settings' && active && <>
      <h1>{ar ? 'الإعدادات' : 'Settings'}</h1>
      <section className="city-card">
        <p className="caption">{ar ? 'المدينة المختارة' : 'Selected city'}</p>
        <h2><bdi>{cityLabel(active.city, language)}</bdi></h2>
        <button className="action secondary" onClick={() => setView('picker')}>{changeLabel}</button>
      </section>
      <LanguagePicker language={language} select={setLanguage} />
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
      {!active && <p className="notice">{ar ? 'طريقة الحساب الافتراضية لمزوّد المواقيت.' : 'Using the provider’s default calculation method.'}</p>}
      {loading && <h2 role="status">{ar ? 'جارٍ تحميل مواقيت الصلاة…' : 'Loading prayer times…'}</h2>}
      {loading && !active && <p className="caption">{ar ? 'سنفتح سجدة عند اكتمال التحميل.' : 'Sajda will open when your schedule is ready.'}</p>}
      {failed && <>
        <p role="alert" className="notice error">{active
          ? (ar ? 'تعذّر تحميل المواقيت الجديدة. بقيت مدينتك الحالية كما هي.' : `Couldn’t load the new times. ${active.city.name} is still your current city.`)
          : (ar ? 'تعذّر تحميل المواقيت. اتصل بالإنترنت ثم أعد المحاولة.' : 'Couldn’t load prayer times. Connect to the internet and try again.')}</p>
        <button className="action" autoFocus onClick={() => void load(candidate, !active)}>{errorLabel}</button>
      </>}
      {(active || failed) && <button className="action secondary" onClick={cancel}>{active ? cancelLabel : changeLabel}</button>}
    </>}
  </main>
}

import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Edge } from './Edge'
import { CityPicker } from './CityPicker'
import { LanguagePicker } from './LanguagePicker'
import { PrayerPanel } from './PrayerPanel'
import { StartupSwitch } from './StartupSwitch'
import { cityLabel, type City, type Language } from './cities'
import type { Schedule } from './prayers'
import lightIcon from './assets/lucide-sun.svg'
import darkIcon from './assets/lucide-moon.svg'

type View = 'prayers' | 'setup' | 'startup' | 'settings' | 'picker' | 'setup-load' | 'change-load'
type Location = { city: City; schedule: Schedule }
type Sound = 'chime' | 'soft' | 'silent'
type Theme = 'light' | 'dark'
const settingsSections = [
  { id: 'general', en: 'General', ar: 'عام' },
  { id: 'appearance', en: 'Appearance', ar: 'المظهر' },
  { id: 'location', en: 'Location', ar: 'الموقع' },
  { id: 'notifications', en: 'Notifications', ar: 'التنبيهات' },
  { id: 'edge', en: 'Screen edge', ar: 'حافة الشاشة' },
] as const
type Detection = { phase: 'idle' | 'loading' | 'failed' } | { phase: 'found'; city: City }
type Snapshot = {
  location: Location | null
  language: Language
  offline: boolean
  refreshing: boolean
  startup: boolean
  setup_city: City | null
  sound: Sound
  revision: number
}

export function App() {
  const [view, setView] = useState<View>(() => isTauri() ? 'prayers' : 'setup')
  const [settingsSection, setSettingsSection] = useState<(typeof settingsSections)[number]['id']>('general')
  const [language, setLanguage] = useState<Language>('en')
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('sajda.theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
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
  const [sound, setSound] = useState<Sound>('chime')
  const [savingSound, setSavingSound] = useState(false)
  const [detection, setDetection] = useState<Detection>({ phase: 'idle' })
  const [ready, setReady] = useState(!isTauri())
  const request = useRef(0)
  const revision = useRef(-1)
  const ar = language === 'ar'
  const errorLabel = ar ? 'إعادة المحاولة' : 'Retry'
  const changeLabel = ar ? 'تغيير المدينة' : 'Change city'
  const cancelLabel = ar ? 'إلغاء' : 'Cancel'
  const sectionTitle = settingsSections.find(({ id }) => id === settingsSection)?.[ar ? 'ar' : 'en']

  useEffect(() => {
    if (!isTauri()) return
    let disposed = false
    const listener = listen<Snapshot>('state-changed', ({ payload }) => applySnapshot(payload))
    void listener.then(() => invoke<Snapshot>('get_state')).then((snapshot) => {
      if (disposed) return
      applySnapshot(snapshot)
      if (snapshot.location) return
      if (snapshot.setup_city) void load(snapshot.setup_city, true)
      else setView('setup')
    }).catch(() => {
      if (!disposed) {
        setView('setup')
        setPreferenceError(true)
      }
    }).finally(() => {
      if (!disposed) setReady(true)
    })
    return () => {
      disposed = true
      void listener.then((stop) => stop()).catch(() => undefined)
    }
  }, [])

  useLayoutEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = ar ? 'rtl' : 'ltr'
  }, [language, ar])

  function applySnapshot(snapshot: Snapshot) {
    if (snapshot.revision <= revision.current) return
    revision.current = snapshot.revision
    setActive(snapshot.location)
    setLanguage(snapshot.language)
    setOffline(snapshot.offline)
    setRefreshing(snapshot.refreshing)
    setStartup(snapshot.startup)
    setSound(snapshot.sound)
  }

  async function detect() {
    setDetection({ phase: 'loading' })
    try {
      const city = await invoke<City>('detect_city')
      setDetection({ phase: 'found', city })
    } catch {
      setDetection({ phase: 'failed' })
    }
  }

  function selectSetupCity(city: City) {
    setCandidate(city)
    setStartupChoice(startup)
    setView('startup')
  }

  async function chooseSound(choice: Sound) {
    if (!isTauri()) {
      setSound(choice)
      return
    }
    setSavingSound(true)
    try {
      applySnapshot(await invoke<Snapshot>('save_sound', { sound: choice }))
      setPreferenceError(false)
    } catch {
      setPreferenceError(true)
    } finally {
      setSavingSound(false)
    }
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
      setDetection({ phase: 'idle' })
      setView((current) => setup || current === 'prayers' ? 'prayers' : 'settings')
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

  function showPrayers() {
    setView((current) => current === 'settings' || current === 'picker' || current === 'change-load' ? 'prayers' : current)
  }

  function showSettings() {
    setView((current) => current === 'prayers' ? 'settings' : current)
  }

  const locationDetection = (setup: boolean) => isTauri() && <div className="detection">
    {detection.phase === 'loading' && <p className="caption" role="status">{ar ? 'جارٍ اقتراح المدينة حسب اتصال الإنترنت…' : 'Finding a city from your internet connection…'}</p>}
    {detection.phase === 'found' && <>
      <p className="caption">{ar ? 'المدينة المقترحة' : 'Suggested city'} · <bdi>{cityLabel(detection.city, language)}</bdi></p>
      <button className="action secondary" onClick={() => setup ? selectSetupCity(detection.city) : void load(detection.city, false)}>
        {ar ? 'استخدام هذه المدينة' : 'Use this city'}
      </button>
    </>}
    {detection.phase === 'failed' && <p className="caption" role="status">
      {ar ? 'تعذّر تحديد المدينة تلقائيًا. يمكنك البحث عنها يدويًا.' : 'Automatic detection failed. You can search for your city manually.'}
    </p>}
    {detection.phase !== 'loading' && detection.phase !== 'found' && <>
      <p className="caption">{ar
        ? 'يستخدم الاكتشاف التلقائي عنوان IP العام عبر ipapi.co لاقتراح مدينة تقريبية.'
        : 'Automatic detection uses your public IP via ipapi.co to suggest an approximate city.'}</p>
      <button className="action secondary" onClick={() => void detect()}>
        {ar ? 'اكتشاف مدينتي تلقائيًا' : 'Detect my city automatically'}
      </button>
    </>}
  </div>

  const back = view === 'settings' ? showPrayers
    : view === 'picker' || (view === 'change-load' && !committing) ? () => void cancel()
    : undefined

  return <Edge ar={ar} ready={ready} hasLocation={Boolean(active)} view={view} theme={theme} back={back}
    showSettings={showSettings} showPrayers={showPrayers}
    renderPrayers={(now, settings) => active && <PrayerPanel ar={ar} settings={settings}
      city={cityLabel(active.city, language)} timezone={active.city.timezone} schedule={active.schedule}
      now={now} offline={offline}
      loading={refreshing} retry={() => void invoke('refresh_schedule').catch(() => undefined)} />}
    renderWorkspace={(edgeSettings) => <>
    {preferenceError && <p className="notice error" role="alert">
      {ar ? 'تعذّر حفظ التفضيلات أو قراءتها.' : 'Couldn’t save or read your preferences.'}
    </p>}
    {ready && view === 'setup' && <>
      <p className="note">{ar ? 'الإعداد · ١ من ٣' : 'SETUP / 1 OF 3'}</p>
      <h1>{ar ? 'اختر مدينتك' : 'Choose your city'}</h1>
      <p className="description">{ar ? 'مواقيت الصلاة حسب التوقيت المحلي لمدينتك.' : 'Prayer times in your city’s local time.'}</p>
      <section className="settings-card setup-section" aria-label={ar ? 'اللغة' : 'Language'}>
        <LanguagePicker language={language} select={(choice) => void chooseLanguage(choice)} />
      </section>
      <div className="setup-options">
        <section className="settings-card setup-section">
          <h2>{ar ? 'البحث عن مدينة' : 'Find a city'}</h2>
          <CityPicker key={language} language={language} select={selectSetupCity} />
        </section>
        {isTauri() && <section className="settings-card setup-section">
          <h2>{ar ? 'الموقع التقريبي' : 'Approximate location'}</h2>
          {locationDetection(true)}
        </section>}
      </div>
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
      <div className="settings-layout">
        <nav className="settings-menu" aria-label={ar ? 'أقسام الإعدادات' : 'Settings sections'}>
          {settingsSections.map((section) => <button key={section.id}
            aria-current={settingsSection === section.id ? 'true' : undefined}
            onClick={() => setSettingsSection(section.id)}>
            {ar ? section.ar : section.en}
          </button>)}
        </nav>
        <section className="settings-card" aria-labelledby="settings-section-title">
          <h2 id="settings-section-title">{sectionTitle}</h2>
          {settingsSection === 'location' && <>
          <p className="caption"><bdi>{cityLabel(active.city, language)}</bdi></p>
          <button className="action secondary" onClick={() => setView('picker')}>{changeLabel}</button>
          {locationDetection(false)}
          </>}
          {settingsSection === 'notifications' && <>
          <label className="sound-choice">{ar ? 'صوت التنبيه' : 'Reminder sound'}
            <select value={sound} disabled={savingSound} onChange={(event) => void chooseSound(event.target.value as Sound)}>
              <option value="chime">{ar ? 'جرس' : 'Chime'}</option>
              <option value="soft">{ar ? 'نغمة هادئة' : 'Soft'}</option>
              <option value="silent">{ar ? 'صامت' : 'Silent'}</option>
            </select>
          </label>
          <button className="action secondary" disabled={savingSound || sound === 'silent'}
            onClick={() => void invoke('preview_sound', { sound }).catch(() => setPreferenceError(true))}>{ar ? 'استمع للصوت' : 'Preview sound'}</button>
          </>}
          {settingsSection === 'edge' && edgeSettings}
          {settingsSection === 'general' && <>
          <StartupSwitch ar={ar} enabled={startup} disabled={savingStartup} change={(value) => void saveStartup(value)} />
          <LanguagePicker language={language} select={(choice) => void chooseLanguage(choice)} />
          </>}
          {settingsSection === 'appearance' && <div className="theme-options" role="group" aria-label={ar ? 'مظهر التطبيق' : 'App theme'}>
            {(['light', 'dark'] as const).map((option) => <button key={option} aria-pressed={theme === option}
              onClick={() => {
                localStorage.setItem('sajda.theme', option)
                setTheme(option)
              }}>
              <img src={option === 'light' ? lightIcon : darkIcon} alt="" />
              {option === 'light' ? (ar ? 'فاتح' : 'Light') : (ar ? 'داكن' : 'Dark')}
            </button>)}
          </div>}
        </section>
      </div>
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
  </>} />
}

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Snapshot } from './App'
import { arabicPrayers as arabic, countdown, localDate, nextPrayer, type Occurrence } from './prayers'
import gear from './assets/Settings.svg'
import niche from './assets/PrayerNiche.svg'

const edges = ['top', 'left', 'right', 'off'] as const
const labels = ['أعلى', 'يسار', 'يمين', 'إيقاف']
const radii = [8, 14, 24] as const
const hoverSizes = [
  { value: 'small', en: 'Small', ar: 'صغيرة' },
  { value: 'medium', en: 'Medium', ar: 'متوسطة' },
  { value: 'large', en: 'Large', ar: 'كبيرة' },
] as const
const minTrigger = 1
const maxTrigger = 12
function edgePreferences() {
  const savedThickness = Number(localStorage.getItem('sajda.edge.trigger-thickness') ?? 3)
  return {
    position: edges.find((value) => value === localStorage.getItem('sajda.edge')) ?? 'top',
    radius: radii.find((value) => value === Number(localStorage.getItem('sajda.edge.radius'))) ?? 14,
    delay: localStorage.getItem('sajda.edge.delay') === '0' ? 0 : 180,
    sounds: localStorage.getItem('sajda.edge.sounds') === 'true',
    hoverSize: hoverSizes.find(({ value }) => value === localStorage.getItem('sajda.edge.hover-size'))?.value ?? 'small',
    triggerThickness: Number.isInteger(savedThickness) ? Math.max(minTrigger, Math.min(maxTrigger, savedThickness)) : 3,
  }
}

export function EdgePicker({ ar }: { ar: boolean }) {
  const [prefs, setPrefs] = useState(edgePreferences)
  function save(key: string, value: string) {
    localStorage.setItem(key, value)
    setPrefs(edgePreferences())
  }
  return <div className="edge-settings">
    <div className="edge-options" role="group" aria-label={ar ? 'موضع الحافة' : 'Edge position'}>
      {edges.map((value, index) => <button key={value} aria-pressed={prefs.position === value}
        onClick={() => save('sajda.edge', value)}>{ar ? labels[index] : value}</button>)}
    </div>
    <div className="edge-control">
      <strong id="hover-area-label">{ar ? 'حجم منطقة التحويم' : 'Hover area size'}</strong>
      <p className="caption">{ar ? 'طول منطقة التحويم على امتداد الحافة.' : 'Length of the hover area along the screen edge.'}</p>
      <div className="edge-options" role="group" aria-labelledby="hover-area-label">
        {hoverSizes.map(({ value, en, ar: label }) => <button key={value}
          aria-pressed={prefs.hoverSize === value} onClick={() => save('sajda.edge.hover-size', value)}>
          {ar ? label : en}
        </button>)}
      </div>
    </div>
    <div className="edge-control">
      <label className="sound-choice" htmlFor="edge-trigger">
        <strong>{ar ? 'سماكة شريط التفعيل' : 'Edge trigger thickness'}</strong>
        <output dir="ltr">{prefs.triggerThickness} px</output>
      </label>
      <p id="edge-trigger-description" className="caption">{ar ? 'سماكة منطقة التفعيل بالبكسل الفعلي.' : 'Thickness of the trigger area in physical pixels.'}</p>
      <input id="edge-trigger" type="range" min={minTrigger} max={maxTrigger} step={1}
        aria-describedby="edge-trigger-description" aria-valuetext={ar ? `${prefs.triggerThickness} بكسل` : `${prefs.triggerThickness} pixels`}
        value={prefs.triggerThickness} onChange={(event) => save('sajda.edge.trigger-thickness', event.target.value)} />
      <div className="edge-scale caption" aria-hidden="true">
        <span>{ar ? 'الأدنى' : 'Min'}</span><span>{ar ? 'الوسط' : 'Mid'}</span><span>{ar ? 'الأقصى' : 'Max'}</span>
      </div>
    </div>
    <label className="sound-choice">{ar ? 'استدارة الزوايا' : 'Corner radius'}
      <select value={prefs.radius} onChange={(event) => save('sajda.edge.radius', event.target.value)}>
        {radii.map((value) => <option key={value} value={value}>{value} px</option>)}
      </select>
    </label>
    <label className="sound-choice">{ar ? 'تأخير الفتح' : 'Open delay'}
      <select value={prefs.delay} onChange={(event) => save('sajda.edge.delay', event.target.value)}>
        <option value={0}>{ar ? 'فوري' : 'Instant'}</option>
        <option value={180}>{ar ? 'قصير' : 'Short'}</option>
      </select>
    </label>
    <label className="sound-choice">{ar ? 'أصوات الحافة' : 'Edge sounds'}
      <input type="checkbox" checked={prefs.sounds}
        onChange={(event) => save('sajda.edge.sounds', String(event.target.checked))} />
    </label>
  </div>
}

type PanelProps = { snapshot: Pick<Snapshot,'location'|'language'>; now: number; settings: () => void }
export function PrayerPanel({ snapshot, now, settings }: PanelProps) {
  const location = snapshot.location
  if (!location) return null
  const ar = snapshot.language === 'ar'
  const next = nextPrayer(location.schedule,now,location.city.timezone)
  const day = localDate(now, location.city.timezone)
  const times = location.schedule.prayers.filter(p => p.date === day)
  return <section className="notch" dir={ar ? 'rtl' : 'ltr'}>
    <header><img src={niche} alt=""/><strong>{ar ? 'سجدة' : 'Sajda'}</strong><button aria-label={ar ? 'الإعدادات' : 'Settings'} onClick={settings}><img src={gear} alt=""/></button></header>
    <div className="notch-body"><div className={`arch scene ${next?.name ?? 'Isha'}`} aria-hidden><span>☾</span></div>
      <div className="next"><small>{ar ? 'الصلاة القادمة' : 'Next prayer'}</small><h2>{next ? ar ? arabic[next.name] : next.name : '—'}</h2><time dir="ltr">{next ? countdown(next.instant,now) : '—'}</time></div>
      <div className="times">{times.map(p => <div key={p.name}><small>{ar ? arabic[p.name] : p.name}</small><time>{p.time}</time></div>)}</div>
    </div>
  </section>
}

export function Edge() {
  const [snapshot,update] = useState<Snapshot|null>(null)
  const [prefs, setPrefs] = useState(edgePreferences)
  const [opened,open] = useState(false)
  const [closing, setClosing] = useState(false)
  const [alert,notify] = useState<Occurrence|null>(null)
  const [now,tick] = useState(Date.now)
  const hover = useRef<number | undefined>(undefined)
  const leave = useRef<number | undefined>(undefined)
  const { hoverSize, triggerThickness } = prefs
  const edge = prefs.position
  useEffect(() => {
    const reset = () => {
      clearTimeout(hover.current)
      clearTimeout(leave.current)
      setClosing(false)
      open(false)
    }
    const store = (event: StorageEvent) => {
      if (event.key && event.key !== 'sajda.edge' && !event.key.startsWith('sajda.edge.')) return
      setPrefs(edgePreferences())
      if (!event.key || event.key === 'sajda.edge') reset()
    }
    window.addEventListener('storage',store)
    const apply = (s:Snapshot) => update(previous => previous && previous.revision > s.revision ? previous : s)
    const listeners = Promise.all([listen<Snapshot>('state-changed',e => apply(e.payload)),listen<Occurrence>('prayer-alert',e => { notify(e.payload); reset() })])
    void listeners.then(() => invoke<Snapshot>('get_state')).then(apply).catch(() => undefined)
    return () => {
      window.removeEventListener('storage', store)
      void listeners.then((stops) => stops.forEach((stop) => stop()))
      clearTimeout(hover.current)
      clearTimeout(leave.current)
    }
  },[])
  useEffect(() => {
    if (!opened) return
    tick(Date.now())
    const timer = setInterval(()=>tick(Date.now()),500)
    return ()=>clearInterval(timer)
  },[opened])
  useEffect(()=>{
    if (!alert) return
    const id=setTimeout(()=>notify(null),9000)
    return ()=>clearTimeout(id)
  },[alert])
  const mode = alert ? 'alert' : !snapshot?.location || edge === 'off' ? 'hidden' : opened ? 'panel' : 'handle'
  useEffect(() => {
    void invoke('edge_layout', { edge, mode, hoverSize, triggerThickness }).catch(() => undefined)
  }, [edge, mode, hoverSize, triggerThickness])
  const ar = snapshot?.language === 'ar'
  function showPanel() {
    clearTimeout(hover.current)
    setClosing(false)
    open(true)
    if (prefs.sounds) void invoke('edge_sound', { expanding: true }).catch(() => undefined)
  }
  function enter() {
    clearTimeout(leave.current)
    setClosing(false)
    if (mode === 'handle') hover.current = window.setTimeout(showPanel, prefs.delay)
  }
  function exit() {
    clearTimeout(hover.current)
    if (mode !== 'panel') return
    setClosing(true)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    leave.current = window.setTimeout(() => {
      open(false)
      setClosing(false)
      if (prefs.sounds) void invoke('edge_sound', { expanding: false }).catch(() => undefined)
    }, reducedMotion ? 0 : 180)
  }
  const settings = () => { exit(); void invoke('edge_settings').catch(() => undefined) }
  return <div className={['edge', edge, mode, closing ? 'closing' : ''].join(' ')}
    dir={ar ? 'rtl' : 'ltr'} style={{ '--edge-radius': `${prefs.radius}px` } as CSSProperties} onMouseEnter={enter} onMouseLeave={exit}>
    {mode==='handle' && <button className="grip" aria-label={ar ? 'فتح سجدة' : 'Open Sajda'} onClick={showPanel}/>}
    {mode==='panel' && snapshot && <PrayerPanel snapshot={snapshot} now={now} settings={settings}/>}
    {alert && <button className={'toast scene '+alert.name} onClick={()=>notify(null)} aria-label="Dismiss reminder"><small>{snapshot?.language==='ar' ? 'حان وقت الصلاة' : 'Time to pray'} · {alert.time}</small><strong>{snapshot?.language==='ar' ? arabic[alert.name] : alert.name}</strong></button>}
  </div>
}

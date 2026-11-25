import { useCallback, useEffect, useEffectEvent, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { arabicPrayers, type Occurrence } from './prayers'
import { prayerArtwork } from './prayerArtwork'
import { Chrome } from './Chrome'
import { Switch } from './Switch'

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
    position: edges.find((value) => value === localStorage.getItem('sajda.edge')) ?? 'right',
    radius: radii.find((value) => value === Number(localStorage.getItem('sajda.edge.radius'))) ?? 14,
    delay: localStorage.getItem('sajda.edge.delay') === '0' ? 0 : 180,
    sounds: localStorage.getItem('sajda.edge.sounds') === 'true',
    hoverSize: hoverSizes.find(({ value }) => value === localStorage.getItem('sajda.edge.hover-size'))?.value ?? 'small',
    triggerThickness: Number.isInteger(savedThickness) ? Math.max(minTrigger, Math.min(maxTrigger, savedThickness)) : 3,
  }
}

type EdgePrefs = ReturnType<typeof edgePreferences>

export function EdgePicker({ ar, prefs, onChange }: { ar: boolean; prefs: EdgePrefs; onChange: (prefs: EdgePrefs) => void }) {
  const soundsLabel = ar ? 'أصوات الحافة' : 'Edge sounds'
  function save(key: string, value: string) {
    localStorage.setItem(key, value)
    onChange(edgePreferences())
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
    <label className="sound-choice">{soundsLabel}
      <Switch label={soundsLabel} checked={prefs.sounds}
        change={(enabled) => save('sajda.edge.sounds', String(enabled))} />
    </label>
  </div>
}

type EdgeHover = { mode: 'handle' | 'panel'; inside: boolean }
type EdgeAction = 'open' | 'toggle' | 'settings' | 'close'
type EdgeProps = {
  ar: boolean
  ready: boolean
  hasLocation: boolean
  view: string
  theme: 'light' | 'dark'
  showSettings: () => void
  showPrayers: () => void
  back: (() => void) | undefined
  renderWorkspace: (edgeSettings: ReactNode) => ReactNode
  renderPrayers: (now: number, settings: () => void) => ReactNode
}

export function Edge({ ar, ready, hasLocation, view, theme, showSettings, showPrayers,
  back, renderWorkspace, renderPrayers }: EdgeProps) {
  const [prefs, setPrefs] = useState(edgePreferences)
  const [lastEdge, setLastEdge] = useState(prefs.position === 'off' ? 'right' : prefs.position)
  const [opened, open] = useState(false)
  const [pinned, setPinned] = useState(!isTauri())
  const [activation, setActivation] = useState(0)
  const [closing, setClosing] = useState<'hover' | 'manual' | null>(null)
  const [pointer, setPointer] = useState<EdgeHover | null>(null)
  const [alert,notify] = useState<Occurrence|null>(null)
  const [now,tick] = useState(Date.now)
  const frame = useRef<HTMLElement>(null)
  const hover = useRef<number | undefined>(undefined)
  const { hoverSize, triggerThickness } = prefs
  const collapse = useCallback(() => {
    clearTimeout(hover.current)
    setClosing(null)
    open(false)
    setPointer(null)
  }, [])
  function close() {
    clearTimeout(hover.current)
    setClosing('manual')
  }
  function navigate(changeView: () => void) {
    clearTimeout(hover.current)
    setClosing(null)
    changeView()
    setPinned(true)
  }
  const handleAction = useEffectEvent((action: EdgeAction | null) => {
    if (!action) return
    notify(null)
    if (action === 'close' || (action === 'toggle' && pinned)) {
      if (pinned || opened) close()
    } else {
      navigate(action === 'settings' ? showSettings : showPrayers)
      setActivation((previous) => previous + 1)
    }
  })
  const handleAlert = useEffectEvent((occurrence: Occurrence) => {
    notify(occurrence)
    if (!pinned) collapse()
  })
  useEffect(() => {
    if (!isTauri()) return
    let disposed = false
    const readAction = () => void invoke<EdgeAction | null>('take_edge_action').then((action) => {
      if (!disposed) handleAction(action)
    }).catch(() => undefined)
    const listeners = Promise.all([
      listen('edge-action', readAction),
      listen<Occurrence>('prayer-alert', (event) => handleAlert(event.payload)),
      listen<EdgeHover>('edge-hover', (event) => setPointer(event.payload)),
    ])
    void listeners.then(readAction).catch(() => undefined)
    return () => {
      disposed = true
      void listeners.then((stops) => stops.forEach((stop) => stop())).catch(() => undefined)
      clearTimeout(hover.current)
    }
  },[])
  function updatePrefs(next: EdgePrefs) {
    setPrefs(next)
    if (next.position !== 'off') setLastEdge(next.position)
  }
  const edge = prefs.position === 'off' && pinned ? lastEdge : prefs.position
  const workspace = !hasLocation || view !== 'prayers'
  const mode = !ready ? 'hidden'
    : pinned ? 'panel'
    : alert ? 'alert'
    : !hasLocation || edge === 'off' ? 'hidden'
    : opened ? 'panel' : 'handle'
  const interactive = pinned && mode === 'panel'
  const showingPrayers = mode === 'panel' && !workspace
  useEffect(() => {
    if (interactive) frame.current?.focus({ preventScroll: true })
  }, [interactive, activation])
  useEffect(() => {
    if (interactive && !frame.current?.contains(document.activeElement)) {
      frame.current?.focus({ preventScroll: true })
    }
  }, [interactive, view])
  useEffect(() => {
    if (!showingPrayers) return
    tick(Date.now())
    const timer = setInterval(()=>tick(Date.now()),500)
    return ()=>clearInterval(timer)
  },[showingPrayers])
  useEffect(()=>{
    if (!alert) return
    const id=setTimeout(()=>notify(null),9000)
    return ()=>clearTimeout(id)
  },[alert])
  useEffect(() => {
    if (isTauri()) void invoke('edge_layout', { edge, mode, hoverSize, triggerThickness, interactive }).catch(() => undefined)
  }, [edge, mode, hoverSize, triggerThickness, interactive, activation])
  const showPanel = useCallback(() => {
    clearTimeout(hover.current)
    setClosing(null)
    open(true)
    if (prefs.sounds && isTauri()) void invoke('edge_sound', { expanding: true }).catch(() => undefined)
  }, [prefs.sounds])
  useEffect(() => {
    if (!closing) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => {
      setPinned(false)
      collapse()
      if (prefs.sounds && isTauri()) void invoke('edge_sound', { expanding: false }).catch(() => undefined)
    }, reducedMotion ? 0 : 230)
    return () => clearTimeout(timer)
  }, [closing, collapse, prefs.sounds])
  useEffect(() => {
    if (interactive || closing === 'manual' || pointer?.mode !== mode) return
    if (pointer.inside) {
      setClosing(null)
      if (mode === 'handle') hover.current = window.setTimeout(showPanel, prefs.delay)
    } else if (mode === 'panel') {
      setClosing('hover')
    }
    return () => clearTimeout(hover.current)
  }, [pointer, mode, interactive, closing, prefs.delay, showPanel])
  const alertName = alert && (ar ? arabicPrayers[alert.name] : alert.name)
  const reminder = alert && <button type="button" className={'reminder ' + alert.name} onClick={() => notify(null)}
    aria-label={ar ? `إغلاق تذكير ${alertName}، ${alert.time}` : `Dismiss ${alertName} reminder, ${alert.time}`}>
    <img className="reminder-art" src={prayerArtwork[alert.name]} alt="" />
    <small>{ar ? 'حان وقت الصلاة' : 'Time to pray'} · <bdi>{alert.time}</bdi></small>
    <strong>{alertName}</strong>
  </button>
  return <div className={['edge', edge, mode, closing ? 'closing' : ''].join(' ')}
    dir={ar ? 'rtl' : 'ltr'} style={{ '--edge-radius': `${prefs.radius}px` } as CSSProperties}>
    {mode==='handle' && <button className="grip" aria-label={ar ? 'فتح سجدة' : 'Open Sajda'} onClick={showPanel}/>}
    {mode==='panel' && <main ref={frame} tabIndex={-1} className="app-window" data-theme={theme}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !event.defaultPrevented) (back ?? close)()
      }}>
      <Chrome ar={ar} prayers={hasLocation && workspace ? () => navigate(showPrayers) : undefined} close={close} />
      {reminder && <div className="edge-notice" role="status">{reminder}</div>}
      <div key={view} tabIndex={0} className={'panel-content ' + (workspace ? 'workspace-content' : '')}>
        {workspace ? renderWorkspace(<EdgePicker ar={ar} prefs={prefs} onChange={updatePrefs} />)
          : renderPrayers(now, () => navigate(showSettings))}
      </div>
    </main>}
    {mode==='alert' && <div className="toast" role="status">{reminder}</div>}
  </div>
}

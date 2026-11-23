import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { Snapshot } from './App'
import { countdown, nextPrayer, type Occurrence } from './prayers'
import gear from './assets/Settings.svg'
import niche from './assets/PrayerNiche.svg'

const edges = ['top', 'left', 'right', 'off'] as const
const labels = ['أعلى', 'يسار', 'يمين', 'إيقاف']
const arabic = { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' }
const storageKey = 'sajda.edge'
function position() {
  return edges.find(value => value === localStorage.getItem(storageKey)) ?? 'top'
}

export function EdgePicker({ ar }: { ar: boolean }) {
  const [selected, select] = useState(position)
  return <section><p className="caption">{ar ? 'موضع الحافة' : 'Edge position'}</p><div className="edge-options">
    {edges.map((value,i) => <button key={value} aria-pressed={selected === value} onClick={() => {
      localStorage.setItem(storageKey,value)
      select(value)
    }}>{ar ? labels[i] : value}</button>)}
  </div><small>{ar ? 'إيقاف: الإشعارات فقط' : 'Off shows prayer notifications only.'}</small></section>
}

type PanelProps = { snapshot: Pick<Snapshot,'location'|'language'>; now: number; settings: () => void }
export function PrayerPanel({ snapshot, now, settings }: PanelProps) {
  const location = snapshot.location
  if (!location) return null
  const ar = snapshot.language === 'ar'
  const next = nextPrayer(location.schedule,now,location.city.timezone)
  const day = new Intl.DateTimeFormat('sv-SE',{timeZone:location.city.timezone}).format(now)
  const times = location.schedule.prayers.filter(p => p.date === day)
  return <section className="notch" dir={ar ? 'rtl' : 'ltr'}>
    <header><img src={niche} alt=""/><strong>{ar ? 'سجدة' : 'Sajda'}</strong><button aria-label={ar ? 'الإعدادات' : 'Settings'} onClick={settings}><img src={gear} alt=""/></button></header>
    <div className="notch-body"><div className="arch scene Maghrib"><span>☾</span></div>
      <div className="next"><small>{ar ? 'الصلاة القادمة' : 'Next prayer'}</small><h2>{next ? ar ? arabic[next.name] : next.name : '—'}</h2><time dir="ltr">{next ? countdown(next.instant,now) : '—'}</time></div>
      <div className="times">{times.map(p => <div key={p.name}><small>{ar ? arabic[p.name] : p.name}</small><time>{p.time}</time></div>)}</div>
    </div>
  </section>
}

export function Edge() {
  const [snapshot,update] = useState<Snapshot|null>(null)
  const [edge,setEdge] = useState(position)
  const [opened,open] = useState(false)
  const [alert,notify] = useState<Occurrence|null>(null)
  const [now,tick] = useState(Date.now)
  const leave = useRef<number|undefined>(undefined)
  useEffect(() => {
    const store = () => { setEdge(position()); open(false) }
    window.addEventListener('storage',store)
    const apply = (s:Snapshot) => update(previous => previous && previous.revision > s.revision ? previous : s)
    const listeners = Promise.all([listen<Snapshot>('state-changed',e => apply(e.payload)),listen<Occurrence>('prayer-alert',e => { notify(e.payload); open(false) })])
    void listeners.then(() => invoke<Snapshot>('get_state')).then(apply)
    return () => { window.removeEventListener('storage',store); void listeners.then(stops=>stops.forEach(stop=>stop())); clearTimeout(leave.current) }
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
  useEffect(()=>{ void invoke('edge_layout',{edge,mode}) },[edge,mode])
  const settings = () => { open(false); void invoke('edge_settings') }
  return <div className={['edge',edge,mode].join(' ')} onMouseEnter={()=>{clearTimeout(leave.current); if(mode==='handle')open(true)}} onMouseLeave={()=>{clearTimeout(leave.current); leave.current=window.setTimeout(()=>open(false),320)}}>
    {mode==='handle' && <button className="grip" aria-label="Open Sajda" onClick={()=>open(true)}/>}
    {mode==='panel' && snapshot && <PrayerPanel snapshot={snapshot} now={now} settings={settings}/>}
    {alert && <button className={'toast scene '+alert.name} onClick={()=>notify(null)} aria-label="Dismiss reminder"><small>{snapshot?.language==='ar' ? 'حان وقت الصلاة' : 'Time to pray'} · {alert.time}</small><strong>{snapshot?.language==='ar' ? arabic[alert.name] : alert.name}</strong></button>}
  </div>
}

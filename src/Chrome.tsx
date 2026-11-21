import closeIcon from './assets/Close.svg'
import settingsIcon from './assets/Settings.svg'
import niche from './assets/PrayerNiche.svg'
import sun from './assets/Sun.svg'

export function Chrome({ ar, close, settings }: { ar: boolean; close: () => void; settings?: () => void }) {
  return <header className="chrome">
    <span className="mark" aria-hidden="true">
      <img className="mark-niche" src={niche} alt="" />
      <img className="mark-sun" src={sun} alt="" />
    </span>
    <span className="brand">{ar ? 'سجدة' : 'Sajda'}</span>
    {settings && <button className="icon" onClick={settings} aria-label={ar ? 'الإعدادات' : 'Open Settings'}>
      <img src={settingsIcon} alt="" />
    </button>}
    <button className="icon" onClick={close} aria-label={ar ? 'إغلاق النافذة' : 'Close window'}>
      <img src={closeIcon} alt="" />
    </button>
  </header>
}

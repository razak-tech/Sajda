import closeIcon from './assets/Close.svg'
import settingsIcon from './assets/lucide-settings.svg'
import lightIcon from './assets/lucide-sun.svg'
import darkIcon from './assets/lucide-moon.svg'
import niche from './assets/PrayerNiche.svg'
import sun from './assets/Sun.svg'

export function Chrome({ ar, close, settings, theme, changeTheme }: {
  ar: boolean
  close: () => void
  settings?: () => void
  theme: 'light' | 'dark'
  changeTheme: () => void
}) {
  const dark = theme === 'dark'
  const themeLabel = dark ? (ar ? 'تفعيل المظهر الفاتح' : 'Switch to light mode')
    : (ar ? 'تفعيل المظهر الداكن' : 'Switch to dark mode')
  return <header className="chrome" data-tauri-drag-region>
    <span className="mark" aria-hidden="true">
      <img className="mark-niche" src={niche} alt="" />
      <img className="mark-sun" src={sun} alt="" />
    </span>
    <span className="brand" data-tauri-drag-region>{ar ? 'سجدة' : 'Sajda'}</span>
    <button className="icon theme-toggle" onClick={changeTheme} aria-label={themeLabel} title={themeLabel}>
      <img src={dark ? darkIcon : lightIcon} alt="" />
    </button>
    {settings && <button className="icon" onClick={settings} aria-label={ar ? 'الإعدادات' : 'Open Settings'}>
      <img src={settingsIcon} alt="" />
    </button>}
    <button className="icon" onClick={close} aria-label={ar ? 'إغلاق النافذة' : 'Close window'}>
      <img src={closeIcon} alt="" />
    </button>
  </header>
}

import closeIcon from './assets/Close.svg'
import niche from './assets/PrayerNiche.svg'
import sun from './assets/Sun.svg'

export function Chrome({ ar, close, prayers }: {
  ar: boolean
  close: () => void
  prayers?: () => void
}) {
  return <header className="chrome">
    <span className="mark" aria-hidden="true">
      <img className="mark-niche" src={niche} alt="" />
      <img className="mark-sun" src={sun} alt="" />
    </span>
    <span className="brand">{ar ? 'سجدة' : 'Sajda'}</span>
    {prayers && <nav className="chrome-nav" aria-label={ar ? 'التنقل' : 'Main navigation'}>
      <button onClick={prayers}>
        {ar ? 'المواقيت' : 'Prayers'}
      </button>
    </nav>}
    <button className="icon" onClick={close} aria-label={ar ? 'إغلاق اللوحة' : 'Close panel'}>
      <img src={closeIcon} alt="" />
    </button>
  </header>
}

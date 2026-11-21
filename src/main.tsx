import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource-variable/noto-sans-arabic'
import { invoke } from '@tauri-apps/api/core'
import { Chrome } from './Chrome'
import { Popup } from './Popup'
import './sajda.css'

createRoot(document.getElementById('root')!).render(
  <main className="frame popup">
    <Chrome ar={false} close={() => void invoke('dismiss')} />
    <Popup ar={false} city="Lille, France" cityName="Lille" now={Date.now()} offline={false}
      loading={false} next={null} retry={() => window.location.reload()} />
  </main>,
)

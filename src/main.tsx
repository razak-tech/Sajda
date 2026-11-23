import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/ibm-plex-mono/latin-500.css'
import '@fontsource-variable/noto-sans-arabic'
import { App } from './App'
import { Edge } from './Edge'
import './sajda.css'
import './edge.css'

createRoot(document.getElementById('root')!).render(isTauri() && getCurrentWindow().label === 'edge' ? <Edge /> : <App />)

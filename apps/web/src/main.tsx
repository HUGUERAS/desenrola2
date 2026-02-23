import { createRoot } from 'react-dom/client'
import 'maplibre-gl/dist/maplibre-gl.css'
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'
import App from './App'
import './index.css'
import './styles/tokens.css'
import './styles/app-shell.css'
import './styles/panels.css'
import './styles/map.css'
import './styles/auth.css'

createRoot(document.getElementById('root')!).render(
    <App />,
)

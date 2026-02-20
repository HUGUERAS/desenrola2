import { createRoot } from 'react-dom/client'
import esriConfig from "@arcgis/core/config";
import * as intl from "@arcgis/core/intl";

// Configurar idioma para Português do Brasil
intl.setLocale("pt-br");
esriConfig.assetsPath = "./assets";

import App from './App'
import './index.css'
import './styles/app-shell.css'
import './styles/panels.css'
import './styles/map.css'


createRoot(document.getElementById('root')!).render(
    <App />,
)

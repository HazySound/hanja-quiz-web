import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { applyFontScale, getFontScale } from './lib/prefs.js'

applyFontScale(getFontScale()) // 저장된 글꼴 배율을 첫 렌더 전에 적용

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

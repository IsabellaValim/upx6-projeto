import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'katex/dist/katex.min.css'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/screens.css'
import './styles/navigation.css'
import './styles/responsive.css'
import App from './App.tsx'

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

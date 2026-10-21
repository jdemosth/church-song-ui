import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import AuthenticationGate from './AuthenticationGate.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthenticationGate />
  </StrictMode>,
)

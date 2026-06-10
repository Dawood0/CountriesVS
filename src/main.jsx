import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/App.css'

const rootElement = document.getElementById('root')

try {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  rootElement.innerHTML = `
    <div class="startup-message startup-error">
      <strong>Country Clash Arena could not start.</strong>
      <span>${error.message}</span>
    </div>
  `
  console.error(error)
}

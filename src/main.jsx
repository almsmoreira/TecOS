import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { CSS } from './constants.js'

// Inject CSS once into <head> — never re-renders, prevents input focus loss
const _style = document.createElement('style')
_style.textContent = CSS
document.head.appendChild(_style)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

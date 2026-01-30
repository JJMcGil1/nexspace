import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './contexts/ThemeContext'
import { AIProvider } from './contexts/AIContext'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AIProvider>
        <App />
      </AIProvider>
    </ThemeProvider>
  </React.StrictMode>
)

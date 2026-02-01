import React from 'react'
import ReactDOM from 'react-dom/client'
import { ThemeProvider } from './contexts/ThemeContext'
import { AIProvider } from './contexts/AIContext'
import { UserProvider } from './contexts/UserContext'
import { CanvasProvider } from './contexts/CanvasContext'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <UserProvider>
        <CanvasProvider>
          <AIProvider>
            <App />
          </AIProvider>
        </CanvasProvider>
      </UserProvider>
    </ThemeProvider>
  </React.StrictMode>
)

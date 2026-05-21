import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { SQErrorBoundary } from '../../rae-side-quest/packages/sq-ui/index.js'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SQErrorBoundary label="snibble">
      <ThemeProvider>
        <App />
        <Toaster position="top-center" toastOptions={{ duration: 1800 }} />
      </ThemeProvider>
    </SQErrorBoundary>
  </React.StrictMode>
)

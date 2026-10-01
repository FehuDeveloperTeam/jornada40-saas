import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'

const queryClient = new QueryClient()

// Entorno de pruebas (build con VITE_ENTORNO=staging): no se indexa y se nota a simple vista.
if (import.meta.env.VITE_ENTORNO === 'staging') {
  const meta = document.createElement('meta')
  meta.name = 'robots'
  meta.content = 'noindex, nofollow'
  document.head.appendChild(meta)
  document.title = `[PRUEBAS] ${document.title}`
  const franja = document.createElement('div')
  franja.textContent = 'Entorno de pruebas: los datos no son reales y los pagos van al sandbox.'
  franja.setAttribute('role', 'note')
  franja.className = 'fixed bottom-0 left-0 z-[100] px-3 py-1 rounded-tr-[8px] bg-[#B45309] text-white text-[12px] font-semibold pointer-events-none'
  document.body.appendChild(franja)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
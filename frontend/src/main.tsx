import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext.tsx'
import { ThemeProvider } from './context/ThemeContext.tsx'
import { recargarPorVersion } from './utils/cargaDiferida'

const queryClient = new QueryClient()

// Un archivo de una versión anterior que ya no existe: se recarga para tomar la nueva.
window.addEventListener('vite:preloadError', (evento) => {
  if (recargarPorVersion()) evento.preventDefault()
})

// Entorno de pruebas (build con VITE_ENTORNO=staging): no se indexa y se nota a simple vista.
if (import.meta.env.VITE_ENTORNO === 'staging') {
  const meta = document.createElement('meta')
  meta.name = 'robots'
  meta.content = 'noindex, nofollow'
  document.head.appendChild(meta)
  document.title = `[PRUEBAS] ${document.title}`
  const franja = document.createElement('div')
  franja.textContent = 'Pruebas'
  franja.title = 'Entorno de pruebas: los datos no son reales y los pagos van al sandbox.'
  franja.setAttribute('role', 'note')
  // Discreta: una etiqueta pequeña y semitransparente arriba al centro que no tapa menús ni botones.
  franja.className = 'fixed top-0 left-1/2 -translate-x-1/2 z-[100] px-2 py-px rounded-b-[6px] bg-[#B45309]/60 text-white text-[10.5px] font-medium tracking-wide uppercase pointer-events-none select-none'
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
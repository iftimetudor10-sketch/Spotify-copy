import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { Check, X } from 'lucide-react'

interface ToastItem { id: number; message: string }
const ToastContext = createContext<(message: string) => void>(() => undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const toast = useCallback((message: string) => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current, { id, message }])
    window.setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 3600)
  }, [])
  return <ToastContext.Provider value={toast}>{children}<div className="toast-stack" aria-live="polite">{items.map((item) => <div className="toast" key={item.id}><Check size={16} /><span>{item.message}</span><button className="icon-button" onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} aria-label="Dismiss notification"><X size={15} /></button></div>)}</div></ToastContext.Provider>
}

export function useToast() { return useContext(ToastContext) }
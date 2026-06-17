import { useState, useRef, useEffect } from 'react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
  exiting?: boolean
}

let toastId = 0
const listeners: Set<(toasts: Toast[]) => void> = new Set()
let currentToasts: Toast[] = []

function notify() {
  listeners.forEach(fn => fn([...currentToasts]))
}

export function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = ++toastId
  currentToasts = [...currentToasts, { id, message, type }]
  notify()
  setTimeout(() => {
    currentToasts = currentToasts.map(t =>
      t.id === id ? { ...t, exiting: true } : t
    )
    notify()
    setTimeout(() => {
      currentToasts = currentToasts.filter(t => t.id !== id)
      notify()
    }, 200)
  }, 3000)
}

export function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    listeners.add(setToasts)
    return () => { listeners.delete(setToasts) }
  }, [])

  return (
    <div ref={containerRef} className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.exiting ? 'toast-exit' : 'toast-enter'
          } ${
            toast.type === 'success'
              ? 'bg-green-500 text-white'
              : toast.type === 'error'
                ? 'bg-red-500 text-white'
                : 'bg-[var(--card)] text-[var(--card-foreground)] border border-[var(--border)]'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  )
}

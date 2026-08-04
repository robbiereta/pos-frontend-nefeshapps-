import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import './Toast.css';

const ToastContext = createContext(null);

let _idCounter = 0;
const nextId = () => ++_idCounter;

const ICONS = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
  }, []);

  const show = useCallback((opts) => {
    const id = nextId();
    const toast = {
      id,
      tone: 'info',
      duration: 4000,
      ...opts,
    };
    setToasts((cur) => [...cur, toast]);
    if (toast.duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), toast.duration);
    }
    return id;
  }, [dismiss]);

  const api = {
    show,
    success: (message, opts = {}) => show({ tone: 'success', message, ...opts }),
    error:   (message, opts = {}) => show({ tone: 'error',   message, duration: 6000, ...opts }),
    warning: (message, opts = {}) => show({ tone: 'warning', message, ...opts }),
    info:    (message, opts = {}) => show({ tone: 'info',    message, ...opts }),
    dismiss,
  };

  useEffect(() => () => {
    Object.values(timers.current).forEach(clearTimeout);
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack" role="region" aria-label="Notificaciones" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <div className="toast__icon" aria-hidden>{ICONS[t.tone] || 'i'}</div>
            <div className="toast__body">
              {t.title && <div className="toast__title">{t.title}</div>}
              <div className="toast__message">{t.message}</div>
              {t.action && (
                <button className="toast__action" onClick={() => { t.action.onClick?.(); dismiss(t.id); }}>
                  {t.action.label}
                </button>
              )}
            </div>
            <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Cerrar">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Soft fallback so components don't crash if a provider is missing
    return {
      show: () => {}, success: () => {}, error: () => {},
      warning: () => {}, info: () => {}, dismiss: () => {},
    };
  }
  return ctx;
}

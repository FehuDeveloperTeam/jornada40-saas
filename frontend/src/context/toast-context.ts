import { createContext } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export type ShowToast = (message: string, type?: ToastType) => void;

export const ToastContext = createContext<ShowToast>(() => {});
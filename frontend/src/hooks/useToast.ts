import { useContext } from 'react';
import { ToastContext } from '../context/toast-context';

export function useToast() {
  return useContext(ToastContext);
}
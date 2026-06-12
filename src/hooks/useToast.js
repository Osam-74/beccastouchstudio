import { useContext } from 'react';
import { ToastContext } from '../context/ToastContextObject';

export function useToast() {
  return useContext(ToastContext);
}

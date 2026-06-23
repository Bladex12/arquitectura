/**
 * Wrapper para toast que corrige automáticamente el encoding de los textos
 */
import { toast as sonnerToast } from 'sonner';
import { fixTextEncoding } from './textEncoding';

export const toast = {
  success: (message: string, options?: any) => {
    return sonnerToast.success(fixTextEncoding(message), options);
  },
  
  error: (message: string, options?: any) => {
    return sonnerToast.error(fixTextEncoding(message), options);
  },
  
  info: (message: string, options?: any) => {
    return sonnerToast.info(fixTextEncoding(message), options);
  },
  
  warning: (message: string, options?: any) => {
    return sonnerToast.warning(fixTextEncoding(message), options);
  },
  
  // Mantener compatibilidad con otros métodos
  promise: sonnerToast.promise.bind(sonnerToast),
  message: (message: string, options?: any) => {
    return sonnerToast.message(fixTextEncoding(message), options);
  },
  loading: (message: string, options?: any) => {
    return sonnerToast.loading(fixTextEncoding(message), options);
  },
  custom: sonnerToast.custom.bind(sonnerToast),
  dismiss: sonnerToast.dismiss.bind(sonnerToast),
};


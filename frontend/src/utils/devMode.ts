/**
 * Utilidades para modo desarrollo
 */

/**
 * Verifica si estamos en modo desarrollo
 * Se puede controlar con la variable de entorno VITE_DEV_MODE o por defecto en desarrollo
 */
export const isDevMode = (): boolean => {
  // En desarrollo, siempre mostrar el botón Dev
  // En producción, solo si está explícitamente habilitado
  return import.meta.env.DEV || import.meta.env.VITE_DEV_MODE === 'true';
};


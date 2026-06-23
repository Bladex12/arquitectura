import axios from 'axios';
import { fixEncodingRecursive } from '@/utils/textEncoding';

// En desarrollo, usar el proxy de Vite (/api)
// En producción, usar la variable de entorno VITE_API_URL
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para agregar token a las peticiones
api.interceptors.request.use(
  (config) => {
    // No agregar token de autenticación a rutas de tablets (no requieren autenticación)
    const currentPath = window.location.pathname;
    const isTabletRoute = currentPath.startsWith('/tablet/');
    
    // Verificar si la URL de la petición es de endpoints de tablets (más específico)
    const url = config.url || '';
    const isTabletConnectionEndpoint = url.includes('/tablet-connections/') || 
                                      url.includes('/tablet-connections') ||
                                      url.includes('tablet-connections/connect') ||
                                      url.includes('tablet-connections/status');
    
    // Verificar endpoints de game-sessions que no requieren autenticación (para tablets)
    const isTabletGameSessionEndpoint = (url.includes('/game-sessions/') && url.includes('/lobby/')) ||
                                       (url.includes('/game-sessions/') && url.includes('/activity_timer/')) ||
                                       (url.includes('/game-sessions/') && url.includes('/stage_results/'));
    
    // Verificar otros endpoints de tablets que no requieren autenticación
    const isTabletAPIEndpoint = url.includes('/team-bubble-maps/') ||
                                url.includes('/team-activity-progress/') ||
                                url.includes('/team-personalizations/');
    
    // Verificar endpoints específicos de session-stages que son para tablets (no requieren autenticación)
    const isTabletSessionStageEndpoint = url.includes('/session-stages/') && (
      url.includes('/presentation_status/') ||
      url.includes('/presentation_timer/') ||
      url.includes('/mark_presentation_done/') ||
      url.includes('/presentation_evaluation_progress/')
    );
    
    // Verificar endpoints públicos que no requieren autenticación
    const isPublicEndpoint = url.includes('/auth/token/') ||  // Login
                             url.includes('/auth/token/refresh/') ||  // Refresh token
                             url.includes('/auth/token/verify/') ||  // Verify token
                             (url.includes('/auth/professors/') && config.method === 'post');  // Registro de profesor
    
    // Si estamos en una ruta de tablet o haciendo petición a endpoint de tablet o endpoint público, 
    // asegurarnos de que no se envíe el token (y limpiarlo si está presente en headers)
    if (isTabletRoute || isTabletConnectionEndpoint || isTabletGameSessionEndpoint || isTabletAPIEndpoint || isTabletSessionStageEndpoint || isPublicEndpoint) {
      delete config.headers.Authorization;
    } else {
      // Solo agregar token en rutas que no son de tablet
      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor para manejar errores de autenticación y corregir encoding
api.interceptors.response.use(
  (response) => {
    // Corregir encoding de todos los textos en la respuesta
    if (response.data) {
      response.data = fixEncodingRecursive(response.data);
    }
    return response;
  },
  (error) => {
    // Corregir encoding también en mensajes de error
    if (error.response?.data) {
      error.response.data = fixEncodingRecursive(error.response.data);
    }
    
    // No mostrar errores 403 en consola cuando se verifica el perfil de administrador
    // (es esperado que profesores reciban 403 al intentar acceder al endpoint de admin)
    if (error.response?.status === 403 && error.config?.url?.includes('/auth/administrators/me/')) {
      // Silenciar este error específico, es esperado cuando un profesor verifica si es admin
      return Promise.reject(error);
    }
    
    if (error.response?.status === 401) {
      const currentPath = window.location.pathname;
      // No redirigir automáticamente durante el proceso de login
      // Solo manejar 401 en rutas de profesor que NO sean login, no en tablets
      if (currentPath.startsWith('/profesor/') && !currentPath.includes('/login')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        // Solo redirigir si no estamos en el proceso de login
        if (!currentPath.includes('/registro')) {
          window.location.href = '/profesor/login';
        }
      }
      // En rutas de tablet, no hacer nada (las tablets no requieren autenticación)
      // El error se manejará en el componente
    }
    return Promise.reject(error);
  }
);

// Helper para unwrap results de paginación
export const unwrapResults = <T>(data: any): T => {
  if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
    return data.results as T;
  }
  return data as T;
};

export default api;

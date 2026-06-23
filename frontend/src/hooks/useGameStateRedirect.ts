import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsAPI } from '@/services';
import { toast } from 'sonner';

/**
 * Hook para redirigir automáticamente al estado actual del juego
 * Se ejecuta cuando el usuario navega hacia atrás o accede a una URL directamente
 */
export function useGameStateRedirect(enabled: boolean = true) {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);
  const isChecking = useRef(false);

  useEffect(() => {
    if (!enabled || !sessionId || hasRedirected.current || isChecking.current) {
      return;
    }

    const checkAndRedirect = async () => {
      isChecking.current = true;
      
      try {
        const gameData = await sessionsAPI.getById(Number(sessionId));
        
        // Si el juego está finalizado o cancelado, no redirigir
        // EXCEPCIÓN: Si estamos en reflexión o resultados, permitir permanecer aunque esté finalizada
        const currentPath = window.location.pathname;
        const isReflectionPage = currentPath.includes('/reflexion/');
        const isResultsPage = currentPath.includes('/resultados/');
        
        // Si estamos en reflexión o resultados y la sesión está finalizada, no redirigir
        if ((isReflectionPage || isResultsPage) && (gameData.status === 'completed' || gameData.status === 'cancelled')) {
          isChecking.current = false;
          return;
        }
        
        // Si el juego está finalizado o cancelado y NO estamos en reflexión o resultados, no redirigir
        if ((gameData.status === 'finished' || gameData.status === 'completed' || gameData.status === 'cancelled') && !isReflectionPage && !isResultsPage) {
          isChecking.current = false;
          return;
        }

        // Si está en lobby, redirigir al lobby
        if (gameData.status === 'lobby') {
          hasRedirected.current = true;
          window.location.href = `/profesor/lobby/${sessionId}`;
          return;
        }

        const currentActivityName = gameData.current_activity_name?.toLowerCase() || '';
        const currentActivityId = gameData.current_activity;
        const currentStageNumber = gameData.current_stage_number;

        // Determinar la URL correcta según el estado del juego
        let correctUrl = '';

        // Si no hay etapa ni actividad, estamos en el video institucional
        if (!currentStageNumber && !currentActivityName) {
          correctUrl = `/profesor/etapa1/video-institucional/${sessionId}/`;
        }
        // Si no hay actividad actual pero hay etapa, ir a resultados
        else if (!currentActivityName || !currentActivityId) {
          if (currentStageNumber) {
            // Si estamos en la página de resultados, NO redirigir a reflexión automáticamente
            // El profesor debe presionar "Ir a Reflexión" manualmente desde resultados
            if (currentStageNumber === 4 && !isResultsPage) {
              // Solo verificar reflexión si NO estamos en la página de resultados
              try {
                const stagesData = await sessionsAPI.getSessionStages(Number(sessionId));
                const stagesArray = Array.isArray(stagesData) ? stagesData : [stagesData];
                const stage4 = stagesArray.find((s: any) => s.stage_number === 4);
                if (stage4?.presentation_timestamps?._reflection === true) {
                  correctUrl = `/profesor/reflexion/${sessionId}`;
                } else {
                  correctUrl = `/profesor/resultados/${sessionId}/?stage_id=${currentStageNumber}`;
                }
              } catch (error) {
                correctUrl = `/profesor/resultados/${sessionId}/?stage_id=${currentStageNumber}`;
              }
            } else {
              // Para otras etapas o si estamos en resultados, ir a resultados
              correctUrl = `/profesor/resultados/${sessionId}/?stage_id=${currentStageNumber}`;
            }
          } else {
            correctUrl = `/profesor/panel`;
          }
        }
        // Si hay actividad, determinar la URL correcta
        else {
          const normalizedActivityName = currentActivityName.toLowerCase().trim();

          if (currentStageNumber === 1) {
            if (normalizedActivityName.includes('video') || normalizedActivityName.includes('institucional')) {
              correctUrl = `/profesor/etapa1/video-institucional/${sessionId}/`;
            } else if (normalizedActivityName.includes('instructivo') || normalizedActivityName.includes('instrucciones')) {
              correctUrl = `/profesor/etapa1/instructivo/${sessionId}/`;
            } else if (normalizedActivityName.includes('personaliz')) {
              correctUrl = `/profesor/etapa1/personalizacion/${sessionId}/`;
            } else if (normalizedActivityName.includes('presentacion') || normalizedActivityName.includes('presentación')) {
              correctUrl = `/profesor/etapa1/presentacion/${sessionId}/`;
            } else if (!normalizedActivityName) {
              correctUrl = `/profesor/resultados/${sessionId}/?stage_id=1`;
            }
          } else if (currentStageNumber === 2) {
            if (normalizedActivityName.includes('tema') || normalizedActivityName.includes('seleccionar')) {
              correctUrl = `/profesor/etapa2/seleccionar-tema/${sessionId}/`;
            } else if (normalizedActivityName.includes('bubble') || normalizedActivityName.includes('mapa mental') || normalizedActivityName.includes('bubblemap')) {
              correctUrl = `/profesor/etapa2/bubble-map/${sessionId}/`;
            } else if (normalizedActivityName.includes('mapa de empatia') || normalizedActivityName.includes('empatía')) {
              correctUrl = `/profesor/etapa2/mapa-empatia/${sessionId}/`;
            } else if (!normalizedActivityName) {
              correctUrl = `/profesor/resultados/${sessionId}/?stage_id=2`;
            }
          } else if (currentStageNumber === 3) {
            if (normalizedActivityName.includes('prototipo')) {
              correctUrl = `/profesor/etapa3/prototipo/${sessionId}/`;
            } else if (!normalizedActivityName) {
              correctUrl = `/profesor/resultados/${sessionId}/?stage_id=3`;
            }
          } else if (currentStageNumber === 4) {
            if (normalizedActivityName.includes('formulario') || normalizedActivityName.includes('pitch')) {
              // Verificar si es formulario o presentación
              if (normalizedActivityName.includes('presentacion') || normalizedActivityName.includes('presentación')) {
                correctUrl = `/profesor/etapa4/presentacion-pitch/${sessionId}/`;
              } else {
                correctUrl = `/profesor/etapa4/formulario-pitch/${sessionId}/`;
              }
            } else if (normalizedActivityName.includes('presentacion') || normalizedActivityName.includes('presentación')) {
              correctUrl = `/profesor/etapa4/presentacion-pitch/${sessionId}/`;
            } else if (!normalizedActivityName) {
              // Si estamos en la página de resultados, NO redirigir a reflexión automáticamente
              // El profesor debe presionar "Ir a Reflexión" manualmente desde resultados
              if (!isResultsPage) {
                // Solo verificar reflexión si NO estamos en la página de resultados
                try {
                  const stagesData = await sessionsAPI.getSessionStages(Number(sessionId));
                  const stagesArray = Array.isArray(stagesData) ? stagesData : [stagesData];
                  const stage4 = stagesArray.find((s: any) => s.stage_number === 4);
                  if (stage4?.presentation_timestamps?._reflection === true) {
                    correctUrl = `/profesor/reflexion/${sessionId}`;
                  } else {
                    correctUrl = `/profesor/resultados/${sessionId}/?stage_id=4`;
                  }
                } catch (error) {
                  correctUrl = `/profesor/resultados/${sessionId}/?stage_id=4`;
                }
              } else {
                // Si estamos en resultados, quedarnos en resultados
                correctUrl = `/profesor/resultados/${sessionId}/?stage_id=4`;
              }
            }
          }
        }

        // Protección anti-retroceso: si ya estamos en una actividad de Etapa 1 más avanzada,
        // no redirigir hacia atrás (evita el loop Personalizacion → Instructivo → Personalizacion)
        if (correctUrl) {
          const upstreamEtapa1Pages = ['/video-institucional/', '/instructivo/'];
          const downstreamEtapa1Pages = ['/etapa1/personalizacion', '/etapa1/presentacion'];
          const isOnDownstreamPage = downstreamEtapa1Pages.some(p => currentPath.includes(p));
          const isTargetingUpstreamPage = upstreamEtapa1Pages.some(p => correctUrl.includes(p));
          if (isOnDownstreamPage && isTargetingUpstreamPage) {
            // Estamos en una página más avanzada pero el backend reporta una etapa anterior.
            // Puede ser estado transitorio (DB aún no propagó startStage1).
            // Re-verificar después de 2 s con datos frescos antes de permitir retroceso.
            console.warn('[useGameStateRedirect] Posible estado desactualizado:', currentPath, '→', correctUrl, '— re-verificando en 2 s');
            isChecking.current = false;
            setTimeout(async () => {
              if (hasRedirected.current) return; // ya redirigido por otro path
              try {
                const recheckData = await sessionsAPI.getById(Number(sessionId));
                const recheckActivity = recheckData.current_activity_name?.toLowerCase() || '';
                const recheckStage = recheckData.current_stage_number;
                // Solo permitir el retroceso si la re-verificación CONFIRMA el estado upstream
                const stillUpstream =
                  recheckActivity.includes('instructivo') ||
                  recheckActivity.includes('video') ||
                  (!recheckStage && !recheckActivity.includes('personaliz'));
                if (stillUpstream) {
                  console.warn('[useGameStateRedirect] Estado confirmado como upstream tras re-verificación — redirigiendo:', correctUrl);
                  hasRedirected.current = true;
                  window.location.href = correctUrl;
                } else {
                  console.log('[useGameStateRedirect] Estado normalizado en re-verificación — permaneciendo en', currentPath);
                }
              } catch {
                // Si falla la re-verificación, no redirigir
              }
            }, 2000);
            return;
          }
        }

        // Si se determinó una URL correcta y es diferente a la actual, redirigir
        // PERO: Si estamos en la página de resultados, NO redirigir a reflexión automáticamente
        // El profesor debe presionar "Ir a Reflexión" manualmente desde resultados
        if (correctUrl && !currentPath.includes(correctUrl.split('?')[0])) {
          // Si estamos en resultados y la URL correcta es reflexión, NO redirigir
          // El profesor debe presionar "Ir a Reflexión" manualmente
          if (isResultsPage && correctUrl.includes('/reflexion/')) {
            // No redirigir, quedarse en resultados
            isChecking.current = false;
            return;
          }
          hasRedirected.current = true;
          window.location.href = correctUrl;
        }
      } catch (error: any) {
        console.error('Error verificando estado del juego:', error);
        // No mostrar error al usuario, solo log
      } finally {
        isChecking.current = false;
      }
    };

    // Pequeño delay para evitar redirecciones innecesarias durante la carga inicial
    const timeoutId = setTimeout(() => {
      checkAndRedirect();
    }, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [sessionId, enabled, navigate]);
}


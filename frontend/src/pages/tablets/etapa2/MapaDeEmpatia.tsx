import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Loader2, Award, Clock, Lightbulb, X, Plus, Edit2, Trash2, UserCircle, Send, Eye, Ear, Heart, MessageCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  sessionsAPI, 
  challengesAPI, 
  teamBubbleMapsAPI, 
  tokenTransactionsAPI, 
  tabletConnectionsAPI,
  teamActivityProgressAPI
} from '@/services';
import { advanceActivityOnTimerExpiration } from '@/utils/timerAutoAdvance';
import { toast } from 'sonner';

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total: number;
}

interface Challenge {
  id: number;
  title: string;
  persona_name?: string;
  persona_age?: number;
  persona_story?: string;
  persona_image_url?: string;
}

interface EmpathyItem {
  id: number;
  text: string;
}

interface EmpathyQuadrant {
  id: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  items: EmpathyItem[];
}

interface EmpathyMapData {
  central: {
    personName: string;
    profileImage?: string;
  };
  quadrants: {
    ver: EmpathyItem[];
    oir: EmpathyItem[];
    pensar: EmpathyItem[];
    decir: EmpathyItem[];
  };
}

interface GameSession {
  id: number;
  status: string;
  current_activity?: number;
  current_activity_name?: string;
  current_stage_number?: number;
}

// Valores por defecto
const DEFAULT_MAX_ITEMS_PER_QUADRANT = 10;
const DEFAULT_MAX_ITEM_LENGTH = 100;

interface EmpathyMapConfig {
  max_items_per_quadrant: number;
  max_item_length: number;
}

// Configuración de cuadrantes
const QUADRANTS_CONFIG: Omit<EmpathyQuadrant, 'items'>[] = [
  {
    id: 'ver',
    title: 'Ver',
    icon: <Eye className="w-6 h-6" />,
    color: '#667eea'
  },
  {
    id: 'oir',
    title: 'Oír',
    icon: <Ear className="w-6 h-6" />,
    color: '#f093fb'
  },
  {
    id: 'pensar',
    title: 'Pensar/Sentir',
    icon: <Heart className="w-6 h-6" />,
    color: '#43e97b'
  },
  {
    id: 'decir',
    title: 'Decir/Hacer',
    icon: <MessageCircle className="w-6 h-6" />,
    color: '#4facfe'
  }
];

export function TabletMapaDeEmpatia() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<number | null>(null);
  const [currentSessionStageId, setCurrentSessionStageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  // Configuración del mapa de empatía
  const [empathyMapConfig, setEmpathyMapConfig] = useState<EmpathyMapConfig>({
    max_items_per_quadrant: DEFAULT_MAX_ITEMS_PER_QUADRANT,
    max_item_length: DEFAULT_MAX_ITEM_LENGTH,
  });
  
  // Estado del mapa de empatía
  const [personName, setPersonName] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [quadrants, setQuadrants] = useState<EmpathyQuadrant[]>(() => 
    QUADRANTS_CONFIG.map(q => ({ ...q, items: [] }))
  );
  
  // Estados de edición
  const [editingItem, setEditingItem] = useState<{ quadrantId: string; itemId: number } | null>(null);
  const [editItemText, setEditItemText] = useState('');
  const [addingItemTo, setAddingItemTo] = useState<string | null>(null);
  
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartTimeRef = useRef<number | null>(null);
  const timerDurationRef = useRef<number | null>(null);
  const timeExpiredRef = useRef<boolean>(false);
  const activityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasUnsavedChangesRef = useRef<boolean>(false);

  // Función auxiliar para obtener el color del equipo
  const getTeamColorHex = (color: string): string => {
    const colorMap: Record<string, string> = {
      'rojo': '#ef4444',
      'azul': '#3b82f6',
      'verde': '#10b981',
      'amarillo': '#eab308',
      'naranja': '#f97316',
      'morado': '#a855f7',
      'rosa': '#ec4899',
      'cyan': '#06b6d4',
    };
    return colorMap[color.toLowerCase()] || '#6b7280';
  };

  // Cargar desafío seleccionado
  const loadSelectedChallenge = async (teamId: number, sessionStageId: number): Promise<Challenge | null> => {
    try {
      const progressList = await teamActivityProgressAPI.list({
        team: teamId,
        session_stage: sessionStageId
      });
      const progressArray = Array.isArray(progressList) ? progressList : [progressList];
      
      const progressWithChallenge = progressArray.find((p: any) => p.selected_challenge);
      
      if (progressWithChallenge && progressWithChallenge.selected_challenge) {
        let challenge = typeof progressWithChallenge.selected_challenge === 'object'
          ? progressWithChallenge.selected_challenge
          : { id: progressWithChallenge.selected_challenge };
        
        if (!challenge.persona_name) {
          challenge = await challengesAPI.getChallengeById(challenge.id);
        }
        
        const fullChallenge = challenge as Challenge;
        setSelectedChallenge(fullChallenge);
        return fullChallenge;
      }
      return null;
    } catch (error) {
      return null;
    }
  };

  // Cargar mapa de empatía desde el backend
  const loadEmpathyMap = async (teamId: number, sessionStageId: number) => {
    try {
      const challenge = await loadSelectedChallenge(teamId, sessionStageId);

      if (!challenge || !challenge.persona_name) {
        toast.error('No se encontró el desafío seleccionado');
        return;
      }

      // Establecer datos centrales
      if (challenge.persona_name !== personName) {
        setPersonName(challenge.persona_name);
      }
      const newProfileImage = challenge.persona_image_url || '';
      if (newProfileImage !== profileImage) {
        setProfileImage(newProfileImage);
      }

      // Cargar mapa de empatía existente (usando teamBubbleMapsAPI como base)
      const mapList = await teamBubbleMapsAPI.list({
        team: teamId,
        session_stage: sessionStageId
      });
      const mapArray = Array.isArray(mapList) ? mapList : [mapList];
      const empathyMap = mapArray[0];

      if (empathyMap && empathyMap.map_data) {
        const data = empathyMap.map_data as EmpathyMapData;
        
        // Verificar si ya fue finalizado
        try {
          const transactions = await tokenTransactionsAPI.list({
            team: teamId,
            session_stage: sessionStageId
          });
          const transactionsList = Array.isArray(transactions) ? transactions : [transactions];
          const hasEmpathyMapTokens = transactionsList.some((t: any) => 
            t.source_type === 'activity' && t.source_id === empathyMap.id
          );
          setIsSubmitted(hasEmpathyMapTokens);
        } catch (error) {
          // Ignorar error
        }
        
        if (data.central) {
          const newPersonName = data.central.personName || challenge.persona_name;
          if (newPersonName !== personName) {
            setPersonName(newPersonName);
          }
          const imageUrl = data.central.profileImage || challenge.persona_image_url || '';
          if (imageUrl !== profileImage) {
            setProfileImage(imageUrl);
          }
        }
        
        if (data.quadrants) {
          const updatedQuadrants = QUADRANTS_CONFIG.map(qConfig => ({
            ...qConfig,
            items: (data.quadrants[qConfig.id as keyof typeof data.quadrants] || []).map((item, idx) => ({
              id: item.id || idx + 1,
              text: item.text
            }))
          }));
          setQuadrants(updatedQuadrants);
          hasUnsavedChangesRef.current = false;
        } else {
          // Inicializar cuadrantes vacíos
          setQuadrants(QUADRANTS_CONFIG.map(q => ({ ...q, items: [] })));
        }
      } else {
        // No hay mapa guardado, inicializar vacío
        setQuadrants(QUADRANTS_CONFIG.map(q => ({ ...q, items: [] })));
      }
      
    } catch (error) {
      // Inicializar vacío en caso de error
      setQuadrants(QUADRANTS_CONFIG.map(q => ({ ...q, items: [] })));
    }
  };

  // Validar mapa de empatía
  const validateEmpathyMap = (): { valid: boolean; error?: string } => {
    // Verificar que cada cuadrante tenga al menos 2 items
    const quadrantsWithLessThan2Items = quadrants.filter(q => q.items.length < 2);
    if (quadrantsWithLessThan2Items.length > 0) {
      const quadrantNames = quadrantsWithLessThan2Items.map(q => q.title).join(', ');
      return { 
        valid: false, 
        error: `Cada cuadrante debe tener al menos 2 items. Faltan items en: ${quadrantNames}` 
      };
    }
    
    return { valid: true };
  };

  const handleSaveEmpathyMap = async () => {
    if (!team || !currentSessionStageId) {
      toast.error('Faltan datos necesarios');
      return;
    }

    if (isSubmitted) {
      toast.error('El mapa de empatía ya ha sido finalizado y no puede modificarse');
      return;
    }

    const validation = validateEmpathyMap();
    if (!validation.valid) {
      toast.error(validation.error || 'No se cumplen los requisitos mínimos');
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmSubmitEmpathyMap = async () => {
    if (!team || !currentSessionStageId) {
      toast.error('Faltan datos necesarios');
      return;
    }

    setShowConfirmDialog(false);
    setSaving(true);
    try {
      await saveEmpathyMap();
      
      // Finalizar (usando teamBubbleMapsAPI como base)
      const finalizeResponse = await teamBubbleMapsAPI.finalize(team.id, currentSessionStageId);
      
      setIsSubmitted(true);
      
      if (finalizeResponse.team_tokens_total !== undefined) {
        setTeam({ ...team, tokens_total: finalizeResponse.team_tokens_total });
      }
      
      const totalItems = quadrants.reduce((sum, q) => sum + q.items.length, 0);
      toast.success(`✓ Mapa de Empatía finalizado exitosamente. Tokens otorgados: ${totalItems}`);
    } catch (error: any) {
      toast.error('Error al guardar mapa de empatía: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  // Guardar mapa de empatía al backend
  const saveEmpathyMap = useCallback(async () => {
    if (!team || !currentSessionStageId) {
      return;
    }
    
    try {
      const mapData: EmpathyMapData = {
        central: {
          personName,
          profileImage: profileImage || undefined
        },
        quadrants: {
          ver: quadrants.find(q => q.id === 'ver')?.items || [],
          oir: quadrants.find(q => q.id === 'oir')?.items || [],
          pensar: quadrants.find(q => q.id === 'pensar')?.items || [],
          decir: quadrants.find(q => q.id === 'decir')?.items || []
        }
      };

      const existingList = await teamBubbleMapsAPI.list({
        team: team.id,
        session_stage: currentSessionStageId
      });
      const existingArray = Array.isArray(existingList) ? existingList : [existingList];
      const existing = existingArray[0];

      if (existing) {
        await teamBubbleMapsAPI.update(existing.id, { map_data: mapData });
      } else {
        await teamBubbleMapsAPI.create({
          team: team.id,
          session_stage: currentSessionStageId,
          map_data: mapData,
        });
      }
      
      hasUnsavedChangesRef.current = false;
    } catch (error: any) {
      toast.error('Error al guardar mapa de empatía: ' + (error.response?.data?.error || error.message));
    }
  }, [team, currentSessionStageId, quadrants, personName, profileImage]);

  // Guardado automático
  const autoSave = useCallback(() => {
    hasUnsavedChangesRef.current = true;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (team && currentSessionStageId) {
        saveEmpathyMap();
      }
    }, 500);
  }, [team, currentSessionStageId, saveEmpathyMap]);

  // Handlers para items
  const handleEditItem = (quadrantId: string, itemId: number) => {
    if (isSubmitted) {
      toast.error('El mapa de empatía ya ha sido finalizado y no puede modificarse');
      return;
    }
    const quadrant = quadrants.find(q => q.id === quadrantId);
    const item = quadrant?.items.find(i => i.id === itemId);
    if (item) {
      setEditingItem({ quadrantId, itemId });
      setEditItemText(item.text);
    }
  };

  const handleSaveItem = () => {
    if (editingItem && editItemText.trim()) {
      setQuadrants(quadrants.map(q => {
        if (q.id === editingItem.quadrantId) {
          return {
            ...q,
            items: q.items.map(i => 
              i.id === editingItem.itemId ? { ...i, text: editItemText.trim() } : i
            )
          };
        }
        return q;
      }));
      setEditingItem(null);
      setEditItemText('');
      autoSave();
    }
  };

  const handleAddItem = (quadrantId: string) => {
    if (isSubmitted) {
      toast.error('El mapa de empatía ya ha sido finalizado y no puede modificarse');
      return;
    }
    const quadrant = quadrants.find(q => q.id === quadrantId);
    if (quadrant && quadrant.items.length >= empathyMapConfig.max_items_per_quadrant) {
      toast.error(`Has alcanzado el límite máximo de ${empathyMapConfig.max_items_per_quadrant} items en este cuadrante`);
      return;
    }
    setAddingItemTo(quadrantId);
    setEditItemText('');
  };

  const handleSaveNewItem = () => {
    const quadrantId = addingItemTo;
    if (quadrantId && editItemText.trim()) {
      setQuadrants(quadrants.map(q => {
        if (q.id === quadrantId) {
          const newItemId = q.items.length > 0 ? Math.max(...q.items.map(i => i.id)) + 1 : 1;
          return {
            ...q,
            items: [...q.items, { id: newItemId, text: editItemText.trim() }]
          };
        }
        return q;
      }));
      setAddingItemTo(null);
      setEditItemText('');
      autoSave();
    }
  };

  const handleDeleteItem = (quadrantId: string, itemId: number) => {
    if (isSubmitted) {
      toast.error('El mapa de empatía ya ha sido finalizado y no puede modificarse');
      return;
    }
    setQuadrants(quadrants.map(q => {
      if (q.id === quadrantId) {
        return {
          ...q,
          items: q.items.filter(i => i.id !== itemId)
        };
      }
      return q;
    }));
    autoSave();
  };

  // Funciones de timer
  const syncTimer = async (gameSessionId: number) => {
    try {
      const timerData = await sessionsAPI.getActivityTimer(gameSessionId);

      if (timerData.error || !timerData.timer_duration) {
        setTimerRemaining('--:--');
        return;
      }

      const timerDuration = timerData.timer_duration;
      const startTime = timerData.started_at
        ? new Date(timerData.started_at).getTime()
        : new Date(timerData.current_time).getTime();

      timerStartTimeRef.current = startTime;
      timerDurationRef.current = timerDuration;

      const now = Date.now();
      const elapsed = Math.floor((now - startTime) / 1000);
      const remaining = Math.max(0, timerDuration - elapsed);
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    } catch (error) {
      setTimerRemaining('--:--');
    }
  };

  const startTimer = async (activityId: number, gameSessionId: number) => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (timerSyncIntervalRef.current) {
      clearInterval(timerSyncIntervalRef.current);
      timerSyncIntervalRef.current = null;
    }

    await syncTimer(gameSessionId);

    timerIntervalRef.current = setInterval(() => {
      if (timerStartTimeRef.current !== null && timerDurationRef.current !== null) {
        const now = Date.now();
        const elapsed = Math.floor((now - timerStartTimeRef.current) / 1000);
        const remaining = Math.max(0, timerDurationRef.current - elapsed);
        
        if (remaining === 0 && !timeExpiredRef.current) {
          timeExpiredRef.current = true;
          toast.warning('¡El tiempo ha terminado!');
          void advanceActivityOnTimerExpiration(gameSessionId);
        }
        
        const minutes = Math.floor(remaining / 60);
        const seconds = remaining % 60;
        setTimerRemaining(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }
    }, 1000);

    timerSyncIntervalRef.current = setInterval(() => {
      syncTimer(gameSessionId);
    }, 30000);
  };

  // Cargar estado inicial
  useEffect(() => {
    const connectionIdParam = searchParams.get('connection_id');
    if (connectionIdParam) {
      setConnectionId(connectionIdParam);
    }
  }, [searchParams]);

  useEffect(() => {
    const loadInitialData = async () => {
      if (!connectionId) {
        setLoading(false);
        return;
      }

      try {
        const connection = await tabletConnectionsAPI.getConnection(connectionId);
        if (!connection || !connection.team || !connection.game_session) {
          toast.error('Conexión no válida');
          navigate('/tablet/join');
          return;
        }

        const teamData = connection.team as Team;
        const gameSession = connection.game_session as GameSession;

        setTeam(teamData);
        setGameSessionId(gameSession.id);

        const gameSessionData = await sessionsAPI.getSession(gameSession.id);
        if (gameSessionData.current_activity && gameSessionData.current_session_stage) {
          setCurrentActivityId(gameSessionData.current_activity);
          setCurrentSessionStageId(gameSessionData.current_session_stage);

          await loadEmpathyMap(teamData.id, gameSessionData.current_session_stage);
          await startTimer(gameSessionData.current_activity, gameSession.id);

          // Verificar actividad periódicamente
          activityCheckIntervalRef.current = setInterval(async () => {
            const updatedSession = await sessionsAPI.getSession(gameSession.id);
            if (updatedSession.current_session_stage !== gameSessionData.current_session_stage) {
              navigate(`/tablet/loading?redirect=/tablet/etapa2/mapa-empatia&connection_id=${connectionId}`);
            }
          }, 5000);
        }
      } catch (error: any) {
        toast.error('Error al cargar datos: ' + (error.response?.data?.error || error.message));
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (timerSyncIntervalRef.current) {
        clearInterval(timerSyncIntervalRef.current);
      }
      if (activityCheckIntervalRef.current) {
        clearInterval(activityCheckIntervalRef.current);
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [connectionId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <Loader2 className="w-12 h-12 text-white animate-spin" />
      </div>
    );
  }

  if (!team) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <div className="text-white text-center">
          <p>No se encontró el equipo</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      {/* Fondo animado */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#093c92] via-blue-600 to-[#f757ac]">
        <motion.div
          animate={{
            backgroundPosition: ['0% 0%', '100% 100%'],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      <div className="relative z-10 p-3 sm:p-4 flex flex-col items-center justify-center flex-1">
        {/* Header */}
        <div className="w-full max-w-6xl mb-3 sm:mb-4">
          <div className="bg-white rounded-xl shadow-xl p-3 sm:p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 sm:gap-4">
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg"
                style={{ backgroundColor: getTeamColorHex(team.color) }}
              >
                {team.color.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">{team.name}</h3>
                <p className="text-xs sm:text-sm text-gray-600">Equipo {team.color}</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-gray-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold text-sm sm:text-base flex items-center gap-2 flex-shrink-0 shadow-md">
              <Award className="w-4 h-4 sm:w-5 sm:h-5" /> {team.tokens_total || 0} Tokens
            </div>
          </div>
        </div>

        {/* Timer */}
        <div className="w-full max-w-6xl mb-3 sm:mb-4">
          <div className="bg-yellow-50 border-2 border-yellow-300 text-yellow-800 p-2 sm:p-3 rounded-xl text-center">
            <p className="font-semibold text-sm sm:text-base flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" /> Tiempo restante: {timerRemaining}
            </p>
          </div>
        </div>

        {/* Mapa de Empatía */}
        <div className="bg-white rounded-2xl shadow-2xl border-2 border-pink-300 w-full max-w-6xl mx-auto flex flex-col">
          <div className="flex items-center gap-3 p-4 border-b flex-shrink-0">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-[#093c92] flex items-center justify-center">
              <Lightbulb className="w-5 h-5 md:w-6 md:h-6 text-white" />
            </div>
            <h1 className="text-[#093c92] font-bold text-lg sm:text-xl">Mapa de Empatía</h1>
          </div>

          {/* Contenido principal */}
          <div className="p-8">
            {/* Persona en el centro */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.6 }}
              className="flex flex-col items-center mb-8"
            >
              <div 
                className="w-32 h-32 rounded-full shadow-2xl overflow-hidden border-4 border-white relative"
                style={{ background: 'linear-gradient(135deg, #f757ac 0%, #d946a0 100%)' }}
              >
                {profileImage ? (
                  <img
                    src={profileImage.startsWith('http') ? profileImage : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${profileImage.startsWith('/') ? '' : '/'}${profileImage}`}
                    alt={personName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-full h-full flex items-center justify-center bg-white ${profileImage ? 'hidden' : ''}`}>
                  <UserCircle className="w-16 h-16 text-gray-400" />
                </div>
              </div>
              <div className="mt-4 px-5 py-2 rounded-full shadow-xl" style={{ background: '#f757ac' }}>
                <span className="text-white font-semibold text-lg">{personName}</span>
              </div>
            </motion.div>

            {/* Cuadrantes en grid 2x2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {quadrants.map((quadrant, quadrantIndex) => (
                <motion.div
                  key={quadrant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: quadrantIndex * 0.1 }}
                  className="bg-white rounded-xl shadow-lg border-2 p-4 flex flex-col"
                  style={{ borderColor: quadrant.color }}
                >
                  {/* Header del cuadrante */}
                  <div className="flex items-center gap-3 mb-4 pb-3 border-b" style={{ borderColor: quadrant.color }}>
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                      style={{ backgroundColor: quadrant.color }}
                    >
                      {quadrant.icon}
                    </div>
                    <h2 className="text-lg font-bold" style={{ color: quadrant.color }}>
                      {quadrant.title}
                    </h2>
                  </div>

                  {/* Items del cuadrante */}
                  <div className="flex-1 space-y-2 mb-4 max-h-[400px] overflow-y-auto">
                    {quadrant.items.map((item, itemIndex) => (
                      <div key={item.id} className="flex items-start gap-2">
                        <span className="text-gray-500 text-xs flex-shrink-0 pt-2">{itemIndex + 1}.</span>
                        {editingItem?.quadrantId === quadrant.id && editingItem?.itemId === item.id ? (
                          <div className="flex-1 flex gap-1">
                            <input
                              type="text"
                              value={editItemText}
                              onChange={(e) => setEditItemText(e.target.value.slice(0, empathyMapConfig.max_item_length))}
                              maxLength={empathyMapConfig.max_item_length}
                              className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                              style={{ 
                                borderColor: quadrant.color
                              }}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveItem();
                                if (e.key === 'Escape') setEditingItem(null);
                              }}
                            />
                            <Button 
                              size="sm" 
                              onClick={handleSaveItem} 
                              className="h-8 w-8 p-0 text-white"
                              style={{ backgroundColor: quadrant.color }}
                            >
                              <X className="w-3 h-3 rotate-45" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setEditingItem(null)} 
                              className="h-8 w-8 p-0"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div 
                              className="flex-1 px-3 py-2 rounded-lg text-sm cursor-pointer hover:bg-opacity-10 transition-colors"
                              style={{ 
                                backgroundColor: `${quadrant.color}15`,
                                border: `1px solid ${quadrant.color}40`
                              }}
                              onClick={() => !isSubmitted && handleEditItem(quadrant.id, item.id)}
                            >
                              {item.text}
                            </div>
                            {!isSubmitted && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeleteItem(quadrant.id, item.id)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 flex-shrink-0"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Botón agregar item */}
                  {!isSubmitted && (
                    <div className="pt-2 border-t" style={{ borderColor: quadrant.color }}>
                      {addingItemTo === quadrant.id ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={editItemText}
                            onChange={(e) => setEditItemText(e.target.value.slice(0, empathyMapConfig.max_item_length))}
                            maxLength={empathyMapConfig.max_item_length}
                            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2"
                            style={{ 
                              borderColor: quadrant.color
                            }}
                            placeholder={`Agregar a ${quadrant.title.toLowerCase()}`}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveNewItem();
                              if (e.key === 'Escape') setAddingItemTo(null);
                            }}
                          />
                          <Button 
                            size="sm" 
                            onClick={handleSaveNewItem} 
                            className="h-8 w-8 p-0 text-white"
                            style={{ backgroundColor: quadrant.color }}
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setAddingItemTo(null)} 
                            className="h-8 w-8 p-0"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddItem(quadrant.id)}
                          className="w-full text-sm"
                          style={{ 
                            borderColor: quadrant.color,
                            color: quadrant.color
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Agregar item
                        </Button>
                      )}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="p-4 border-t flex-shrink-0">
            <div className="flex flex-wrap gap-3 justify-end items-center">
              <Button
                onClick={handleSaveEmpathyMap}
                disabled={saving || isSubmitted}
                className={`${isSubmitted ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600'} text-white`}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finalizando...
                  </>
                ) : isSubmitted ? (
                  <>
                    <Award className="w-4 h-4 mr-2" />
                    Finalizado
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Finalizar
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Diálogo de confirmación */}
      {showConfirmDialog && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-md w-full"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-yellow-100">
                <Lightbulb className="w-6 h-6 text-yellow-600" />
              </div>
              <h2 className="text-[#093c92] font-bold text-lg">
                Finalizar Mapa de Empatía
              </h2>
            </div>
            
            <p className="text-gray-700 mb-6">
              ¿Estás seguro que quieres <strong>finalizar</strong> el Mapa de Empatía? 
              <br /><br />
              <span className="text-sm text-gray-600">
                Los items ya están guardados automáticamente. Al finalizar, se otorgarán los tokens y <strong>no podrás hacer más cambios</strong>.
              </span>
            </p>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setShowConfirmDialog(false)}
                variant="outline"
                className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </Button>
              <Button
                onClick={confirmSubmitEmpathyMap}
                disabled={saving}
                className="flex-1 bg-green-500 text-white hover:bg-green-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Finalizando...
                  </>
                ) : (
                  'Finalizar'
                )}
              </Button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}
    </div>
  );
}


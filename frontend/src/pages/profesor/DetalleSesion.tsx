import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  FileImage,
  FileText,
  Network,
  Trophy,
  Users,
  TrendingUp,
  BarChart3,
  Award,
  Target,
  CheckCircle2,
  X,
  Eye,
  Maximize2,
  UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { 
  sessionsAPI, 
  teamsAPI, 
  reflectionEvaluationsAPI, 
  teamActivityProgressAPI, 
  teamBubbleMapsAPI, 
  tokenTransactionsAPI 
} from '@/services';
import { toast } from 'sonner';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  RadialBarChart,
  RadialBar,
} from 'recharts';

interface GameSession {
  id: number;
  room_code: string;
  status: string;
  course_name?: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
}

interface Team {
  id: number;
  name: string;
  color: string;
  tokens_total: number;
  students?: Student[];
}

interface Student {
  id: number;
  full_name: string;
  email: string;
}

interface ReflectionEvaluation {
  satisfaction: string;
  entrepreneurship_interest: string;
  value_areas: string[];
}

interface TeamActivityProgress {
  id: number;
  team_name: string;
  activity_name: string;
  stage_name: string;
  prototype_image_url?: string;
  pitch_intro_problem?: string;
  pitch_solution?: string;
  pitch_value?: string;
  pitch_impact?: string;
  pitch_closing?: string;
}

interface TeamBubbleMap {
  id: number;
  team_name: string;
  stage_name: string;
  map_data: any;
}

interface TokenTransaction {
  id: number;
  team_name: string;
  amount: number;
  source_type: string;
  session_stage?: number;
  stage_name?: string | null;
  stage_number?: number | null;
  activity_name?: string;
}

// Colores vibrantes para gráficos
const GRADIENT_COLORS = [
  '#667eea',
  '#f093fb',
  '#4facfe',
  '#43e97b',
  '#fa709a',
  '#30cfd0',
  '#ffd89b',
  '#a8edea',
];

const SATISFACTION_COLORS = {
  mucho: '#43e97b',
  si: '#4facfe',
  masomenos: '#ffd89b',
  nomucho: '#fa709a',
  no: '#f5576c',
};

const ENTREPRENEURSHIP_COLORS = {
  ya_tenia: '#667eea',
  me_encantaria: '#43e97b',
  posible_opcion: '#4facfe',
  no_interesa: '#f5576c',
};

export function DetalleSesion() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [reflectionEvaluations, setReflectionEvaluations] = useState<ReflectionEvaluation[]>([]);
  const [teamFiles, setTeamFiles] = useState<{
    prototypes: TeamActivityProgress[];
    pitches: TeamActivityProgress[];
    bubbleMaps: TeamBubbleMap[];
  }>({ prototypes: [], pitches: [], bubbleMaps: [] });
  const [tokenData, setTokenData] = useState<{
    byTeam: { team: string; tokens: number; color: string }[];
    byStage: { stage: string; tokens: number }[];
    byStageAndTeam: Array<{ stage: string; [teamName: string]: number | string }>;
  }>({ byTeam: [], byStage: [], byStageAndTeam: [] });
  const [totalStudents, setTotalStudents] = useState(0);
  const [reflectionResponseRate, setReflectionResponseRate] = useState(0);
  const [selectedPrototype, setSelectedPrototype] = useState<TeamActivityProgress | null>(null);
  const [selectedBubbleMap, setSelectedBubbleMap] = useState<TeamBubbleMap | null>(null);
  const [selectedPitch, setSelectedPitch] = useState<TeamActivityProgress | null>(null);
  
  // Tamaño fijo para el bubble map (sin zoom)
  const BUBBLE_MAP_SIZE = { width: 1000, height: 1000 };

  useEffect(() => {
    if (sessionId) {
      loadSessionData();
    }
  }, [sessionId]);

  // Función helper para obtener URL de imagen
  const getImageUrl = (imageSrc: string): string => {
    if (!imageSrc) return '';
    if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
      return imageSrc;
    }
    const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
    const baseUrl = apiBaseUrl.replace('/api', '');
    return `${baseUrl}${imageSrc.startsWith('/') ? '' : '/'}${imageSrc}`;
  };
        
  // Función para renderizar el Bubble Map en formato de lista (igual que tablets)
  const renderBubbleMap = (mapData: any) => {
    const isNewStructure = mapData && 'questions' in mapData;
    
    if (isNewStructure) {
      const data = mapData as any;
      const questions = data.questions || [];
      const personName = data.central?.personName || 'Persona';
      const profileImageRaw = data.central?.profileImage || '';
      const profileImage = getImageUrl(profileImageRaw);
      
      return (
        <div className="h-full flex flex-col overflow-hidden">
          {/* Header con persona */}
          <div className="flex-shrink-0 flex flex-col items-center py-3 px-2">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-xl overflow-hidden border-3 border-white relative" style={{ background: 'linear-gradient(135deg, #f757ac 0%, #d946a0 100%)' }}>
              {profileImage ? (
                <img
                  src={profileImage}
                  alt={personName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <div className={`w-full h-full flex items-center justify-center bg-white ${profileImage ? 'hidden' : ''}`}>
                <UserCircle className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
              </div>
            </div>
            <div className="mt-2 px-3 py-1 rounded-full shadow-md text-center" style={{ background: '#f757ac' }}>
              <span className="text-white font-semibold text-sm sm:text-base">{personName}</span>
            </div>
          </div>
          
          {/* Lista scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-3">
            {questions.map((question: any) => (
              <div key={question.id} className="bg-white/80 backdrop-blur-md p-5 rounded-3xl shadow-lg border border-white/50 relative">
                {/* Question Header */}
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0 shadow-sm"></span>
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Pregunta</span>
                  </div>
                  <h3 className="font-bold text-lg text-gray-800 leading-tight">{question.question}</h3>
                </div>

                {/* Content Area */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-inner">
                  {/* Scrollable Answers List */}
                  <ul className="max-h-48 overflow-y-auto p-3 space-y-2 min-h-[60px]">
                    {question.answers.length === 0 && (
                      <li className="text-sm text-gray-400 italic text-center py-2">Sin respuestas</li>
                    )}
                    {question.answers.map((answer: any, idx: number) => (
                      <li key={answer.id || idx} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <span className="text-purple-600 font-bold text-lg leading-none mt-0.5">•</span>
                        <span className="text-sm text-gray-700 flex-1 font-medium leading-snug">{answer.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      // Estructura antigua (compatibilidad)
      return (
        <div className="text-center py-8 text-gray-500">
          <p>Formato de bubble map no compatible</p>
        </div>
      );
    }
  };

  const loadSessionData = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      // Cargar sesión
      const sessionData = await sessionsAPI.getById(sessionId);
      setGameSession(sessionData);

      // Cargar equipos con estudiantes
      const teamsList = await teamsAPI.list({ game_session: sessionId });
      const teamsArray = Array.isArray(teamsList) ? teamsList : [teamsList];
      setTeams(teamsArray);

      // Calcular total de estudiantes
      const total = teamsArray.reduce((sum: number, team: Team) => {
        return sum + (team.students?.length || 0);
      }, 0);
      setTotalStudents(total);

      // Cargar evaluaciones de reflexión
      try {
        const evaluationsData = await reflectionEvaluationsAPI.byRoom(sessionData.room_code);
        
        // El endpoint devuelve: { count, total_evaluations, total_students, results }
        let evaluationsArray: ReflectionEvaluation[] = [];
        let responseCount = 0;
        
        if (evaluationsData && typeof evaluationsData === 'object') {
          if ('results' in evaluationsData) {
            // Estructura correcta con results
            evaluationsArray = Array.isArray(evaluationsData.results) 
              ? evaluationsData.results 
              : [];
            responseCount = evaluationsData.count || 0;
          } else if (Array.isArray(evaluationsData)) {
            // Fallback: si es un array directamente
            evaluationsArray = evaluationsData;
            responseCount = evaluationsData.length;
          }
        }
        
        setReflectionEvaluations(evaluationsArray);

        // Calcular % de respuestas usando el count del backend (más confiable)
        const responseRate = total > 0 ? (responseCount / total) * 100 : 0;
        setReflectionResponseRate(responseRate);
      } catch (error) {
        console.error('Error loading evaluations:', error);
        setReflectionEvaluations([]);
        setReflectionResponseRate(0);
      }

      // Cargar archivos de equipos
      await loadTeamFiles(sessionId);

      // Cargar tokens
      await loadTokenData(sessionId, teamsList);
    } catch (error: any) {
      console.error('Error loading session data:', error);
      toast.error('Error al cargar los datos de la sesión');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamFiles = async (sessionId: string) => {
    try {
      // Cargar progresos de actividades (prototipos y pitches)
      // Filtrar por equipos de esta sesión
      const teamsList = await teamsAPI.list({ game_session: sessionId });
      const teamsArray = Array.isArray(teamsList) ? teamsList : [teamsList];
      
      // Obtener progresos de todos los equipos
      const progressPromises = teamsArray.map((team: Team) =>
        teamActivityProgressAPI.list({ team: team.id })
      );
      const progressResponses = await Promise.all(progressPromises);
      const progressList: TeamActivityProgress[] = [];
      progressResponses.forEach((response) => {
        const data = Array.isArray(response) ? response : [response];
        progressList.push(...data);
      });

      const prototypes = progressList.filter(
        (p: TeamActivityProgress) => p.prototype_image_url && p.status === 'completed'
      );
      const pitches = progressList.filter(
        (p: TeamActivityProgress) =>
          (p.pitch_intro_problem || p.pitch_solution || p.pitch_value || p.pitch_impact || p.pitch_closing) && p.status === 'completed'
      );

      // Cargar bubble maps por equipo
      try {
        const bubbleMapsPromises = teamsArray.map((team: Team) =>
          teamBubbleMapsAPI.list({ team: team.id })
        );
        const bubbleMapsResponses = await Promise.all(bubbleMapsPromises);
        const bubbleMapsList: TeamBubbleMap[] = [];
        bubbleMapsResponses.forEach((response) => {
          const data = Array.isArray(response) ? response : [response];
          bubbleMapsList.push(...data);
        });

        setTeamFiles({
          prototypes,
          pitches,
          bubbleMaps: bubbleMapsList,
        });
      } catch (error) {
        console.error('Error loading bubble maps:', error);
        setTeamFiles({ prototypes, pitches, bubbleMaps: [] });
      }
    } catch (error) {
      console.error('Error loading team files:', error);
    }
  };

  const loadTokenData = async (sessionId: string, teamsList: Team[]) => {
    try {
      // Cargar transacciones de tokens
      const tokensList = await tokenTransactionsAPI.list({ game_session: sessionId });
      const tokensArray = Array.isArray(tokensList) ? tokensList : [tokensList];
      
      console.log('[DetalleSesion] Total transacciones de tokens:', tokensArray.length);
      console.log('[DetalleSesion] Transacciones con stage_number:', tokensArray.filter((t: TokenTransaction) => t.stage_number).length);
      console.log('[DetalleSesion] Transacciones sin stage_number:', tokensArray.filter((t: TokenTransaction) => !t.stage_number).length);
      
      // Log detallado de transacciones sin stage_number
      const tokensWithoutStage = tokensArray.filter((t: TokenTransaction) => !t.stage_number);
      if (tokensWithoutStage.length > 0) {
        console.log('[DetalleSesion] Detalles de tokens sin stage_number:', tokensWithoutStage.map((t: TokenTransaction) => ({
          id: t.id,
          team: t.team_name,
          amount: t.amount,
          source_type: t.source_type,
          stage_name: t.stage_name,
          stage_number: t.stage_number,
          reason: t.reason
        })));
      }
      
      // Log específico para tokens de "Parte 1 completada" y "caos" (actividad de Presentación)
      const presentacionTokens = tokensArray.filter((t: TokenTransaction) => 
        t.reason && (
          t.reason.includes('Parte 1 completada') || 
          t.reason.includes('caos') ||
          t.reason.includes('Preguntas del caos')
        )
      );
      if (presentacionTokens.length > 0) {
        console.log('[DetalleSesion] 🔴 Tokens de Presentación (no se conocen):', presentacionTokens.map((t: TokenTransaction) => ({
          id: t.id,
          team: t.team_name,
          amount: t.amount,
          stage_number: t.stage_number,
          stage_name: t.stage_name,
          reason: t.reason
        })));
      }
      
      // Log de TODAS las transacciones del Equipo Azul (sin filtrar por etapa)
      const equipoAzulAll = tokensArray.filter((t: TokenTransaction) => 
        t.team_name === 'Equipo Azul' || t.team_name.includes('Azul')
      );
      const equipoAzulDetails = equipoAzulAll.map((t: TokenTransaction) => ({
        id: t.id,
        amount: t.amount,
        stage_number: t.stage_number,
        stage_name: t.stage_name,
        reason: t.reason,
        source_type: t.source_type
      }));
      console.log('[DetalleSesion] 🔵🔵 TODAS las transacciones del Equipo Azul (todas las etapas):', equipoAzulDetails);
      console.log('[DetalleSesion] 🔵🔵 Resumen Equipo Azul:', {
        total_transacciones: equipoAzulAll.length,
        total_tokens: equipoAzulAll.reduce((sum, t) => sum + t.amount, 0),
        por_etapa: equipoAzulAll.reduce((acc, t) => {
          const stage = t.stage_number || 'sin_etapa';
          acc[stage] = (acc[stage] || 0) + t.amount;
          return acc;
        }, {} as Record<number | string, number>)
      });

      // Crear mapa de colores de equipos
      const teamColorMap = new Map<string, string>();
      teamsList.forEach((team) => {
        teamColorMap.set(team.name, team.color);
      });

      // Agrupar por equipo
      const byTeamMap = new Map<string, number>();
      tokensArray.forEach((t: TokenTransaction) => {
        const current = byTeamMap.get(t.team_name) || 0;
        byTeamMap.set(t.team_name, current + t.amount);
      });
      const byTeam = Array.from(byTeamMap.entries())
        .map(([team, tokens]) => ({
          team,
          tokens,
          color: teamColorMap.get(team) || '#667eea',
        }))
        .sort((a, b) => b.tokens - a.tokens);

      // Agrupar por número de etapa (Etapa 1, Etapa 2, Etapa 3, Etapa 4)
      const byStageMap = new Map<number, number>();
      
      // Primero, intentar obtener las etapas desde session_stage para inicializar todas
      let allStageNumbers = [1, 2, 3, 4]; // Por defecto, todas las etapas
      try {
        const stagesData = await sessionsAPI.getSessionStages(Number(sessionId));
        const stagesList = Array.isArray(stagesData) ? stagesData : [stagesData];
        
        if (stagesList.length > 0) {
          // Usar las etapas que realmente existen en la sesión
          allStageNumbers = stagesList
            .map((stage: any) => stage.stage_number)
            .filter((num: number) => num !== null && num !== undefined)
            .sort((a: number, b: number) => a - b);
        }
        
        // Inicializar todas las etapas con 0 tokens
        allStageNumbers.forEach((stageNumber: number) => {
          byStageMap.set(stageNumber, 0);
        });
      } catch (error) {
        console.error('Error loading stages for token grouping:', error);
        // Si hay error, inicializar con etapas por defecto
        allStageNumbers.forEach((stageNumber: number) => {
          byStageMap.set(stageNumber, 0);
        });
      }
      
      // Agregar los tokens reales por etapa
      const tokensByStageDetail: Record<number, Array<{ team: string; amount: number; reason?: string }>> = {};
      tokensArray.forEach((t: TokenTransaction) => {
        if (t.stage_number) {
          const current = byStageMap.get(t.stage_number) || 0;
          byStageMap.set(t.stage_number, current + t.amount);
          
          // Guardar detalles para logging
          if (!tokensByStageDetail[t.stage_number]) {
            tokensByStageDetail[t.stage_number] = [];
          }
          tokensByStageDetail[t.stage_number].push({
            team: t.team_name,
            amount: t.amount,
            reason: t.reason || t.source_type
          });
        }
      });
      
      // Log resumen de tokens por etapa
      console.log('[DetalleSesion] Tokens por etapa:', Array.from(byStageMap.entries()).map(([stage, tokens]) => ({
        etapa: `Etapa ${stage}`,
        tokens
      })));
      
      // Log detallado de tokens por etapa (especialmente Etapa 1)
      Object.keys(tokensByStageDetail).forEach((stageKey) => {
        const stageNum = Number(stageKey);
        const tokens = tokensByStageDetail[stageNum];
        const total = tokens.reduce((sum, t) => sum + t.amount, 0);
        
        // Agrupar por equipo para ver el desglose
        const byTeam = tokens.reduce((acc, t) => {
          acc[t.team] = (acc[t.team] || 0) + t.amount;
          return acc;
        }, {} as Record<string, number>);
        
        // Agrupar por tipo de transacción para ver el desglose
        const byReason = tokens.reduce((acc, t) => {
          const reason = t.reason || 'sin_razon';
          if (!acc[reason]) {
            acc[reason] = { count: 0, total: 0, teams: {} as Record<string, number> };
          }
          acc[reason].count += 1;
          acc[reason].total += t.amount;
          acc[reason].teams[t.team] = (acc[reason].teams[t.team] || 0) + t.amount;
          return acc;
        }, {} as Record<string, { count: number; total: number; teams: Record<string, number> }>);
        
        console.log(`[DetalleSesion] Etapa ${stageNum} - Total: ${total} tokens`, {
          transacciones: tokens.length,
          porEquipo: byTeam,
          porTipo: byReason,
          detalle: tokens.map(t => ({ team: t.team, amount: t.amount, reason: t.reason }))
        });
        
        // Log especial para Etapa 1 y Equipo Azul
        if (stageNum === 1) {
          const equipoAzulTokens = tokens.filter(t => t.team === 'Equipo Azul' || t.team.includes('Azul'));
          const totalAzul = equipoAzulTokens.reduce((sum, t) => sum + t.amount, 0);
          console.log(`[DetalleSesion] 🔵 Etapa 1 - Equipo Azul: ${totalAzul} tokens`, {
            transacciones: equipoAzulTokens.length,
            detalle: equipoAzulTokens.map(t => ({
              amount: t.amount,
              reason: t.reason,
              team: t.team
            }))
          });
          
          // Log detallado de TODAS las transacciones del Equipo Azul en Etapa 1
          const equipoAzulAllTransactions = tokensArray.filter((t: TokenTransaction) => 
            t.stage_number === 1 && (t.team_name === 'Equipo Azul' || t.team_name.includes('Azul'))
          );
          const equipoAzulEtapa1Details = equipoAzulAllTransactions.map((t: TokenTransaction) => ({
            id: t.id,
            amount: t.amount,
            reason: t.reason,
            source_type: t.source_type,
            stage_number: t.stage_number,
            stage_name: t.stage_name,
            team_name: t.team_name
          }));
          console.log(`[DetalleSesion] 🔵🔵 TODAS las transacciones del Equipo Azul en Etapa 1:`, equipoAzulEtapa1Details);
          console.log(`[DetalleSesion] 🔵🔵 Resumen Equipo Azul Etapa 1:`, {
            total_transacciones: equipoAzulAllTransactions.length,
            total_tokens: equipoAzulAllTransactions.reduce((sum, t) => sum + t.amount, 0),
            tokens_por_tipo: equipoAzulAllTransactions.reduce((acc, t) => {
              const tipo = t.reason || t.source_type || 'desconocido';
              acc[tipo] = (acc[tipo] || 0) + t.amount;
              return acc;
            }, {} as Record<string, number>)
          });
        }
      });
      
      // Convertir a array con formato "Etapa X" y ordenar por número de etapa
      const byStage = Array.from(byStageMap.entries())
        .map(([stageNumber, tokens]) => ({ 
          stage: `Etapa ${stageNumber}`, 
          tokens,
          stageNumber // Mantener el número para ordenar
        }))
        .sort((a, b) => a.stageNumber - b.stageNumber) // Ordenar por número de etapa
        .map(({ stage, tokens }) => ({ stage, tokens })); // Remover stageNumber del resultado final

      // Agrupar por etapa Y por equipo para gráfico de barras múltiples
      const byStageAndTeamMap = new Map<number, Map<string, number>>();
      
      // Inicializar todas las etapas con todos los equipos en 0
      const stageNumbersForGrouping = Array.from(byStageMap.keys()).sort();
      teamsList.forEach((team: Team) => {
        stageNumbersForGrouping.forEach((stageNumber) => {
          if (!byStageAndTeamMap.has(stageNumber)) {
            byStageAndTeamMap.set(stageNumber, new Map<string, number>());
          }
          const teamMap = byStageAndTeamMap.get(stageNumber)!;
          teamMap.set(team.name, 0);
        });
      });
      
      // Agregar los tokens reales por equipo y etapa
      tokensArray.forEach((t: TokenTransaction) => {
        if (t.stage_number) {
          const teamName = t.team_name;
          if (!byStageAndTeamMap.has(t.stage_number)) {
            byStageAndTeamMap.set(t.stage_number, new Map<string, number>());
          }
          const teamMap = byStageAndTeamMap.get(t.stage_number)!;
          const current = teamMap.get(teamName) || 0;
          teamMap.set(teamName, current + t.amount);
        } else {
          // Log para debuggear tokens sin stage_number en agrupación por equipo
          console.warn(`[DetalleSesion] Token sin stage_number (por equipo):`, {
            id: t.id,
            team: t.team_name,
            amount: t.amount,
            source_type: t.source_type,
            stage_name: t.stage_name
          });
        }
      });
      
      // Convertir a formato para gráfico de barras múltiples
      const byStageAndTeam = Array.from(byStageAndTeamMap.entries())
        .sort((a, b) => a[0] - b[0]) // Ordenar por número de etapa
        .map(([stageNumber, teamTokensMap]) => {
          const dataPoint: { stage: string; [teamName: string]: number | string } = {
            stage: `Etapa ${stageNumber}`
          };
          
          // Agregar tokens de cada equipo
          teamTokensMap.forEach((tokens, teamName) => {
            dataPoint[teamName] = tokens;
          });
          
          return dataPoint;
        });

      setTokenData({ byTeam, byStage, byStageAndTeam });
    } catch (error) {
      console.error('Error loading token data:', error);
    }
  };

  // Preparar datos para gráficos
  const satisfactionData = [
    {
      name: 'Sí, mucho',
      value: reflectionEvaluations.filter((e) => e.satisfaction === 'mucho').length,
      color: SATISFACTION_COLORS.mucho,
    },
    {
      name: 'Sí',
      value: reflectionEvaluations.filter((e) => e.satisfaction === 'si').length,
      color: SATISFACTION_COLORS.si,
    },
    {
      name: 'Más o menos',
      value: reflectionEvaluations.filter((e) => e.satisfaction === 'masomenos').length,
      color: SATISFACTION_COLORS.masomenos,
    },
    {
      name: 'No mucho',
      value: reflectionEvaluations.filter((e) => e.satisfaction === 'nomucho').length,
      color: SATISFACTION_COLORS.nomucho,
    },
    {
      name: 'No',
      value: reflectionEvaluations.filter((e) => e.satisfaction === 'no').length,
      color: SATISFACTION_COLORS.no,
    },
  ].filter((item) => item.value > 0);

  const entrepreneurshipData = [
    {
      name: 'Ya tenía ganas',
      value: reflectionEvaluations.filter((e) => e.entrepreneurship_interest === 'ya_tenia').length,
      color: ENTREPRENEURSHIP_COLORS.ya_tenia,
    },
    {
      name: 'Me encantaría',
      value: reflectionEvaluations.filter((e) => e.entrepreneurship_interest === 'me_encantaria').length,
      color: ENTREPRENEURSHIP_COLORS.me_encantaria,
    },
    {
      name: 'Posible opción',
      value: reflectionEvaluations.filter((e) => e.entrepreneurship_interest === 'posible_opcion').length,
      color: ENTREPRENEURSHIP_COLORS.posible_opcion,
    },
    {
      name: 'No interesa',
      value: reflectionEvaluations.filter((e) => e.entrepreneurship_interest === 'no_interesa').length,
      color: ENTREPRENEURSHIP_COLORS.no_interesa,
    },
  ].filter((item) => item.value > 0);

  const valueAreasMap = new Map<string, number>();
  reflectionEvaluations.forEach((e) => {
    e.value_areas?.forEach((area) => {
      const current = valueAreasMap.get(area) || 0;
      valueAreasMap.set(area, current + 1);
    });
  });
  const valueAreasData = Array.from(valueAreasMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const totalResponses = reflectionEvaluations.length;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#F5F0E8' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#0F172A' }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: '#F5F0E8', fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Botón de regreso limpio */}
        <button
          onClick={() => navigate('/profesor/historial')}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver al Historial
        </button>

        {/* Header con métricas */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-sm border border-white/80 p-6 mb-6"
        >
          <h1
            className="text-2xl sm:text-3xl font-black mb-1"
            style={{ fontFamily: 'Unbounded, sans-serif', color: '#0F172A' }}
          >
            Sesión: {gameSession?.room_code}
          </h1>
          <p className="text-sm text-slate-500 mb-6">{gameSession?.course_name}</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Estudiantes</p>
                  <p className="text-3xl font-black text-slate-800">{totalStudents}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Respuestas</p>
                  <p className="text-3xl font-black text-slate-800">
                    {Math.round(reflectionResponseRate * totalStudents / 100) || reflectionEvaluations.length}
                    <span className="text-sm font-normal text-slate-500 ml-1">
                      ({reflectionResponseRate.toFixed(1)}%)
                    </span>
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Equipos</p>
                  <p className="text-3xl font-black text-slate-800">{teams.length}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <Trophy className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Tokens Totales</p>
                  <p className="text-3xl font-black text-slate-800">
                    {tokenData.byTeam.reduce((sum, t) => sum + t.tokens, 0)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center">
                  <Award className="w-6 h-6 text-emerald-600" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Gráficos de Evaluación */}
        {reflectionEvaluations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl shadow-sm border border-white/80 p-6 mb-6"
          >
            <h2 className="text-lg font-black mb-6 flex items-center gap-2" style={{ fontFamily: 'Unbounded, sans-serif', color: '#0F172A' }}>
              <TrendingUp className="w-5 h-5" />
              Evaluaciones de Reflexión
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Satisfacción - Donut Chart */}
              {satisfactionData.length > 0 && (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-4 text-center">
                    Satisfacción con la Actividad
                  </h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={satisfactionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        animationBegin={0}
                        animationDuration={800}
                      >
                        {satisfactionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        }}
                      />
                      {/* Texto central */}
                      <text
                        x="50%"
                        y="45%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ fontSize: '32px', fontWeight: 'bold', fill: '#093c92' }}
                      >
                        {totalResponses}
                      </text>
                      <text
                        x="50%"
                        y="55%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ fontSize: '14px', fill: '#666' }}
                      >
                        Respuestas
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    {satisfactionData.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {item.name}: {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Interés en Emprender - Donut Chart */}
              {entrepreneurshipData.length > 0 && (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-4 text-center">
                    Interés en Emprender
                  </h3>
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart>
                      <Pie
                        data={entrepreneurshipData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                        startAngle={90}
                        endAngle={-270}
                        animationBegin={100}
                        animationDuration={800}
                      >
                        {entrepreneurshipData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        }}
                      />
                      <text
                        x="50%"
                        y="45%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ fontSize: '32px', fontWeight: 'bold', fill: '#093c92' }}
                      >
                        {totalResponses}
                      </text>
                      <text
                        x="50%"
                        y="55%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        style={{ fontSize: '14px', fill: '#666' }}
                      >
                        Respuestas
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 flex flex-wrap justify-center gap-3">
                    {entrepreneurshipData.map((item, index) => (
                      <div key={index} className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-full shadow-sm">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {item.name}: {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Áreas de Valor - Bar Chart */}
            {valueAreasData.length > 0 && (
              <div className="mt-6 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h3 className="text-base font-bold text-slate-800 mb-4">
                  Áreas de Valor Más Seleccionadas
                </h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={valueAreasData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis type="number" stroke="#666" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={150} stroke="#666" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar
                      dataKey="value"
                      radius={[0, 8, 8, 0]}
                      animationBegin={200}
                      animationDuration={800}
                    >
                      {valueAreasData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={GRADIENT_COLORS[index % GRADIENT_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </motion.div>
        )}

        {/* Tokens y Rendimiento */}
        {tokenData.byTeam.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-3xl shadow-sm border border-white/80 p-6 mb-6"
          >
            <h2 className="text-lg font-black mb-6 flex items-center gap-2" style={{ fontFamily: 'Unbounded, sans-serif', color: '#0F172A' }}>
              <Trophy className="w-5 h-5" />
              Tokens y Rendimiento
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Tokens por Equipo */}
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h3 className="text-base font-bold text-slate-800 mb-4">Tokens por Equipo</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={tokenData.byTeam} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis type="number" stroke="#666" fontSize={12} />
                    <YAxis dataKey="team" type="category" width={120} stroke="#666" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #e0e0e0',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      }}
                    />
                    <Bar dataKey="tokens" radius={[0, 8, 8, 0]} animationBegin={300} animationDuration={800}>
                      {tokenData.byTeam.map((entry, index) => {
                        // Mapear colores de equipos a hex
                        const colorMap: Record<string, string> = {
                          Verde: '#28a745',
                          Azul: '#007bff',
                          Rojo: '#dc3545',
                          Amarillo: '#ffc107',
                          Naranja: '#fd7e14',
                          Morado: '#6f42c1',
                          Rosa: '#e83e8c',
                          Cian: '#17a2b8',
                          Gris: '#6c757d',
                          Marrón: '#795548',
                        };
                        return (
                          <Cell
                            key={`cell-${index}`}
                            fill={colorMap[entry.color] || GRADIENT_COLORS[index % GRADIENT_COLORS.length]}
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Tokens por Etapa - Gráfico de Barras Múltiples */}
              {tokenData.byStageAndTeam.length > 0 && (
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                  <h3 className="text-base font-bold text-slate-800 mb-4">Tokens por Etapa</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={tokenData.byStageAndTeam}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="stage" stroke="#666" fontSize={12} />
                      <YAxis stroke="#666" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px' }}
                        iconType="rect"
                      />
                      {teams.map((team, index) => {
                        // Mapear colores de equipos a hex
                        const colorMap: Record<string, string> = {
                          Verde: '#28a745',
                          Azul: '#007bff',
                          Rojo: '#dc3545',
                          Amarillo: '#ffc107',
                          Naranja: '#fd7e14',
                          Morado: '#6f42c1',
                          Rosa: '#e83e8c',
                          Cian: '#17a2b8',
                          Gris: '#6c757d',
                          Marrón: '#795548',
                        };
                        return (
                          <Bar
                            key={team.name}
                            dataKey={team.name}
                            fill={colorMap[team.color] || GRADIENT_COLORS[index % GRADIENT_COLORS.length]}
                            radius={[4, 4, 0, 0]}
                            animationBegin={index * 100}
                            animationDuration={800}
                          />
                        );
                      })}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Archivos por Equipo */}
        {(teamFiles.prototypes.length > 0 ||
          teamFiles.pitches.length > 0 ||
          teamFiles.bubbleMaps.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-3xl shadow-sm border border-white/80 p-6"
          >
            <h2 className="text-lg font-black mb-6 flex items-center gap-2" style={{ fontFamily: 'Unbounded, sans-serif', color: '#0F172A' }}>
              <FileText className="w-5 h-5" />
              Archivos Subidos por Equipo
            </h2>

            <div className="space-y-6">
              {teams.map((team) => {
                const teamPrototypes = teamFiles.prototypes.filter((p) => p.team_name === team.name);
                const teamPitches = teamFiles.pitches.filter((p) => p.team_name === team.name);
                const teamBubbleMaps = teamFiles.bubbleMaps.filter((b) => b.team_name === team.name);

                if (teamPrototypes.length === 0 && teamPitches.length === 0 && teamBubbleMaps.length === 0) {
                  return null;
                }

                return (
                  <Card key={team.id} className="p-4 border-2 border-gray-200 hover:border-blue-300 transition-colors">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Equipo {team.name} ({team.color})
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Prototipos */}
                      {teamPrototypes.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <FileImage className="w-5 h-5 text-purple-600" />
                            Prototipos
                          </h4>
                          <div className="space-y-2">
                            {teamPrototypes.map((prototype) => (
                              <Button
                                key={prototype.id}
                                variant="outline"
                                size="sm"
                                className="w-full justify-start text-sm text-purple-700 hover:text-purple-900 hover:bg-purple-100"
                                onClick={() => setSelectedPrototype(prototype)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                {prototype.activity_name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Pitches */}
                      {teamPitches.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-blue-600" />
                            Guiones/Pitches
                          </h4>
                          <div className="space-y-2">
                            {teamPitches.map((pitch) => (
                              <Button
                                key={pitch.id}
                                variant="outline"
                                size="sm"
                                className="w-full justify-start text-sm text-blue-700 hover:text-blue-900 hover:bg-blue-100"
                                onClick={() => setSelectedPitch(pitch)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                {pitch.activity_name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Bubble Maps */}
                      {teamBubbleMaps.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                          <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                            <Network className="w-5 h-5 text-green-600" />
                            Bubble Maps
                          </h4>
                          <div className="space-y-2">
                            {teamBubbleMaps.map((map) => (
                              <Button
                                key={map.id}
                                variant="outline"
                                size="sm"
                                className="w-full justify-start text-sm text-green-700 hover:text-green-900 hover:bg-green-100"
                                onClick={() => setSelectedBubbleMap(map)}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                {map.stage_name}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Modal de Prototipo */}
      {selectedPrototype && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPrototype(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-4xl w-full max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedPrototype.activity_name}</h3>
                  <p className="text-sm text-gray-600">Equipo {selectedPrototype.team_name} • {selectedPrototype.stage_name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedPrototype(null)}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              {selectedPrototype.prototype_image_url ? (
                <div className="relative w-full rounded-lg overflow-hidden border-2 border-gray-200 bg-gray-50">
                  <img
                    src={(() => {
                      const imageUrl = selectedPrototype.prototype_image_url;
                      // Si la URL ya es completa (empieza con http:// o https://), usarla directamente
                      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                        return imageUrl;
                      }
                      // Si es relativa, construir la URL completa con la base del backend
                      const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
                      const backendBaseUrl = apiBaseUrl.replace('/api', '');
                      return `${backendBaseUrl}${imageUrl.startsWith('/') ? imageUrl : '/' + imageUrl}`;
                    })()}
                    alt={`Prototipo de ${selectedPrototype.team_name}`}
                    className="w-full h-auto max-h-[70vh] object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const errorDiv = target.nextElementSibling as HTMLDivElement;
                      if (errorDiv) {
                        errorDiv.style.display = 'flex';
                      }
                    }}
                  />
                  <div className="hidden items-center justify-center p-12 text-gray-500">
                    <div className="text-center">
                      <FileImage className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg font-semibold">No se pudo cargar la imagen</p>
                      <p className="text-sm mt-2 break-all">URL: {selectedPrototype.prototype_image_url}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative w-full rounded-lg border-2 border-gray-200 bg-gray-50 p-12 text-center">
                  <FileImage className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-500 font-semibold">No hay imagen disponible</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Modal de Bubble Map */}
      {selectedBubbleMap && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedBubbleMap(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Bubble Map</h3>
                  <p className="text-sm text-gray-600">Equipo {selectedBubbleMap.team_name} • {selectedBubbleMap.stage_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedBubbleMap(null)}
                    className="rounded-full"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              {/* Bubble Map Preview - formato de lista como tablets */}
              <div 
                className="relative bg-gradient-to-br from-gray-50 to-white rounded-2xl p-6 sm:p-8 border-4 mb-4 shadow-lg flex-1 flex flex-col min-h-0"
                style={{ 
                  borderColor: '#28a745',
                  overflow: 'hidden'
                }}
              >
                {renderBubbleMap(selectedBubbleMap.map_data)}
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Modal de Pitch/Guion */}
      {selectedPitch && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPitch(null)}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
          >
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-4xl w-full max-h-[95vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedPitch.activity_name}</h3>
                  <p className="text-sm text-gray-600">Equipo {selectedPitch.team_name} • {selectedPitch.stage_name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedPitch(null)}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="space-y-6">
                {selectedPitch.pitch_intro_problem && (
                  <div className="bg-blue-50 rounded-lg p-5 border-l-4 border-blue-500">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Introducción del Problema
                    </h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedPitch.pitch_intro_problem}</p>
                  </div>
                )}
                
                {selectedPitch.pitch_solution && (
                  <div className="bg-green-50 rounded-lg p-5 border-l-4 border-green-500">
                    <h4 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Solución
                    </h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedPitch.pitch_solution}</p>
                  </div>
                )}
                
                {selectedPitch.pitch_value && (
                  <div className="bg-purple-50 rounded-lg p-5 border-l-4 border-purple-500">
                    <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Valor
                    </h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedPitch.pitch_value}</p>
                  </div>
                )}
                
                {selectedPitch.pitch_impact && (
                  <div className="bg-orange-50 rounded-lg p-5 border-l-4 border-orange-500">
                    <h4 className="font-semibold text-orange-900 mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Impacto
                    </h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedPitch.pitch_impact}</p>
                  </div>
                )}
                
                {selectedPitch.pitch_closing && (
                  <div className="bg-pink-50 rounded-lg p-5 border-l-4 border-pink-500">
                    <h4 className="font-semibold text-pink-900 mb-2 flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Cierre
                    </h4>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedPitch.pitch_closing}</p>
                  </div>
                )}
                
                {!selectedPitch.pitch_intro_problem && 
                 !selectedPitch.pitch_solution && 
                 !selectedPitch.pitch_value && 
                 !selectedPitch.pitch_impact && 
                 !selectedPitch.pitch_closing && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay contenido disponible para este guion</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}


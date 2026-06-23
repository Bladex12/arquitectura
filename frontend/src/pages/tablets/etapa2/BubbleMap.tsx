import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Loader2, Award, Clock, Lightbulb, X, Plus, Edit2, Trash2, UserCircle, Send, Target, Bot, Coins
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UBotBubbleMapModal } from '@/components/UBotBubbleMapModal';
import {
  sessionsAPI,
  challengesAPI,
  teamBubbleMapsAPI,
  tokenTransactionsAPI,
  tabletConnectionsAPI,
  teamActivityProgressAPI
} from '@/services';
import { getResultsRedirectUrl } from '@/utils/tabletResultsRedirect';
import { advanceActivityOnTimerExpiration } from '@/utils/timerAutoAdvance';
import { toast } from 'sonner';

// Interfaces basadas en mapa2 pero adaptadas
interface BubbleNode {
  id: string;
  question: string;
  answers: string[];
  placeholder: string;
  isCustom?: boolean;
}

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

interface BubbleMapData {
  central: {
    personName: string;
    profileImage?: string;
  };
  questions: BubbleNode[];
}

interface GameSession {
  id: number;
  status: string;
  current_activity?: number;
  current_activity_name?: string;
  current_stage_number?: number;
}

// Preguntas por defecto
const DEFAULT_QUESTIONS: Omit<BubbleNode, 'id'>[] = [
  { question: '¿Qué le gusta?', answers: [], placeholder: 'Triste, feliz, ansioso...' },
  { question: '¿Qué no le gusta?', answers: [], placeholder: 'Apoyo, espacio, escucha...' },
  { question: '¿Qué obstáculos está enfrentando?', answers: [], placeholder: 'Trabajo, familia, futuro...' },
  { question: '¿Qué le dicen los demás?', answers: [], placeholder: 'Nombres de personas clave...' },
  { question: '¿Cuáles son sus hobbies?', answers: [], placeholder: 'Bailar, Leer...' },
];

const MAX_NODES = 8; // 5 initial + 3 custom
const DEFAULT_MAX_QUESTION_LENGTH = 60;
const DEFAULT_MAX_ANSWER_LENGTH = 100;

// Componente Bubble (basado en mapa2)
const Bubble: React.FC<{
  node: BubbleNode;
  onAddAnswer: (id: string, text: string) => void;
  onRemoveAnswer: (id: string, index: number) => void;
  onQuestionChange?: (id: string, value: string) => void;
  onDelete?: (id: string) => void;
  x: number;
  y: number;
  isCenter?: boolean;
  personName?: string;
  profileImage?: string;
}> = ({ 
  node, 
  onAddAnswer,
  onRemoveAnswer,
  onQuestionChange, 
  onDelete, 
  x, 
  y, 
  isCenter = false,
  personName,
  profileImage
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const listRef = useRef<HTMLUListElement>(null);

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${x}px`,
    top: `${y}px`,
    transform: 'translate(-50%, -50%)',
    zIndex: isCenter ? 20 : (isHovered ? 50 : 10),
  };

  const handleAdd = () => {
    if (inputValue.trim()) {
      onAddAnswer(node.id, inputValue.trim());
      setInputValue('');
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  if (isCenter) {
    const [imageError, setImageError] = useState(false);
    
    // Construir URL de la imagen igual que en SeleccionarTemaDesafio y MobileListView
    const getImageUrl = (imageSrc: string | undefined): string => {
      if (!imageSrc) {
        return '';
      }
      // Si ya es una URL completa (http/https), usarla directamente
      if (imageSrc.startsWith('http://') || imageSrc.startsWith('https://')) {
        return imageSrc;
      }
      // Si es una ruta relativa, construir la URL completa
      const apiBaseUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000';
      return `${apiBaseUrl}${imageSrc.startsWith('/') ? '' : '/'}${imageSrc}`;
    };
    
    // Resetear error cuando cambia la imagen
    useEffect(() => {
      setImageError(false);
    }, [profileImage]);
    
    const imageUrl = profileImage ? getImageUrl(profileImage) : null;
    const showImage = imageUrl && !imageError && imageUrl.length > 0;
    const showInitial = !showImage;
    
    return (
      <div 
        style={style}
        className="w-24 h-24 lg:w-32 lg:h-32 rounded-full bg-gradient-to-br from-[#093c92] to-[#f757ac] flex items-center justify-center shadow-xl text-white font-bold text-xl lg:text-2xl border-4 border-white/30 overflow-hidden relative"
      >
        {showImage && imageUrl ? (
          <img
            key={imageUrl} // Forzar re-render cuando cambie la URL
            src={imageUrl}
            alt={personName || 'Persona'}
            className="w-full h-full object-cover"
            onError={() => {
              setImageError(true);
            }}
          />
        ) : null}
        {showInitial && (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#093c92] to-[#f757ac]">
            {personName ? personName.charAt(0).toUpperCase() : 'YO'}
          </div>
        )}
        {personName && (
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full shadow-md text-center whitespace-nowrap" style={{ background: '#f757ac' }}>
            <span className="text-white font-semibold text-xs lg:text-sm">{personName}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      style={style} 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex flex-col items-center w-48 md:w-52 lg:w-60 transition-all duration-300"
    >
      {/* Question Bubble */}
      <div className="bg-white/95 backdrop-blur-md text-[#093c92] p-3 rounded-2xl shadow-lg border border-[#093c92]/20 text-center mb-1.5 relative group hover:scale-105 transition-transform duration-300 w-full z-20">
        
        {node.isCustom && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-100 text-red-500 border border-red-200 rounded-full flex items-center justify-center text-xs hover:bg-red-500 hover:text-white shadow-sm opacity-0 group-hover:opacity-100 transition-all"
            title="Eliminar pregunta"
          >
            ✕
          </button>
        )}

        {node.isCustom && onQuestionChange ? (
          <input
            type="text"
            value={node.question}
            onChange={(e) => onQuestionChange(node.id, e.target.value)}
            placeholder="Tu pregunta..."
            className="w-full bg-transparent text-center font-bold text-sm lg:text-base leading-tight border-b-2 border-[#093c92]/20 focus:border-[#093c92] outline-none pb-1 text-gray-800 placeholder-[#093c92]/40"
          />
        ) : (
          <p className="font-bold text-sm lg:text-base leading-tight select-none text-gray-800">{node.question}</p>
        )}

        {/* Decorative pointer */}
        <div className="absolute -bottom-1.5 left-1/2 transform -translate-x-1/2 rotate-45 w-3 h-3 bg-white border-b border-r border-[#093c92]/20"></div>
      </div>

      {/* Answers Container */}
      <div className="w-full bg-white rounded-xl border border-gray-200 shadow-md overflow-hidden flex flex-col z-10 relative">
        
        {/* Explicit Input Area */}
        <div className="p-2 bg-gray-50 border-b border-gray-200">
          <div className="flex gap-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.slice(0, DEFAULT_MAX_ANSWER_LENGTH))}
              onKeyDown={handleKeyDown}
              placeholder={node.answers.length === 0 ? "Escribe una respuesta..." : "Agregar otra..."}
              maxLength={DEFAULT_MAX_ANSWER_LENGTH}
              className="flex-1 min-w-0 text-xs lg:text-sm px-2 py-1.5 rounded border border-gray-300 focus:border-[#093c92] focus:ring-1 focus:ring-[#093c92] outline-none bg-white transition-shadow"
            />
            <button 
              onClick={handleAdd}
              disabled={!inputValue.trim()}
              className="bg-[#093c92] text-white w-7 rounded flex items-center justify-center hover:bg-[#072d6f] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-lg leading-none pb-0.5 font-medium"
            >
              +
            </button>
          </div>
        </div>

        {/* Scrollable List - Altura fija para mostrar aproximadamente 2 respuestas */}
        <div className="bg-white h-16 flex flex-col overflow-hidden">
          <ul 
            ref={listRef}
            className="overflow-y-auto custom-scrollbar p-1.5 space-y-1 flex-1"
          >
            {node.answers.length === 0 && (
              <li className="text-xs text-gray-400 text-center py-2 italic select-none">
                {node.placeholder}
              </li>
            )}
            
            {node.answers.map((ans, idx) => (
              <li key={idx} className="flex items-start gap-1.5 p-1 rounded hover:bg-gray-50 group/item">
                <span className="text-purple-600 font-bold text-xs mt-1">•</span>
                <span className="text-xs text-gray-700 break-words flex-1 leading-snug">{ans}</span>
                <button 
                  onClick={() => onRemoveAnswer(node.id, idx)}
                  className="opacity-0 group-hover/item:opacity-100 text-gray-400 hover:text-red-500 text-[10px] px-1 transition-opacity"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

// Componente MobileListView (basado en mapa2)
const MobileListView: React.FC<{
  nodes: BubbleNode[];
  onAddAnswer: (id: string, text: string) => void;
  onRemoveAnswer: (id: string, index: number) => void;
  onQuestionChange: (id: string, value: string) => void;
  onDelete: (id: string) => void;
  onAddNode: () => void;
  canAddMore: boolean;
  personName: string;
  profileImage: string;
}> = ({ 
  nodes, 
  onAddAnswer,
  onRemoveAnswer,
  onQuestionChange,
  onDelete,
  onAddNode,
  canAddMore,
  personName,
  profileImage
}) => {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header con persona */}
      <div className="flex-shrink-0 flex flex-col items-center py-3 px-2">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full shadow-xl overflow-hidden border-3 border-white relative" style={{ background: 'linear-gradient(135deg, #f757ac 0%, #d946a0 100%)' }}>
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
            <UserCircle className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400" />
          </div>
        </div>
        <div className="mt-2 px-3 py-1 rounded-full shadow-md text-center" style={{ background: '#f757ac' }}>
          <span className="text-white font-semibold text-sm sm:text-base">{personName}</span>
        </div>
      </div>
      
      {/* Lista scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 space-y-3">
        {nodes.map((node) => (
          <MobileListItem 
            key={node.id}
            node={node}
            onQuestionChange={onQuestionChange}
            onDelete={onDelete}
            onAddAnswer={onAddAnswer}
            onRemoveAnswer={onRemoveAnswer}
          />
        ))}

        {canAddMore && (
          <button
            onClick={onAddNode}
            className="w-full py-3 rounded-xl border-2 border-dashed border-[#093c92]/30 text-[#093c92] font-semibold hover:bg-[#093c92]/5 hover:border-[#093c92] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <Plus className="w-5 h-5" />
            Agregar Pregunta
          </button>
        )}
      </div>
    </div>
  );
};

// MobileListItem (basado en mapa2)
const MobileListItem: React.FC<{
  node: BubbleNode;
  onQuestionChange: (id: string, val: string) => void;
  onDelete: (id: string) => void;
  onAddAnswer: (id: string, val: string) => void;
  onRemoveAnswer: (id: string, idx: number) => void;
}> = ({ node, onQuestionChange, onDelete, onAddAnswer, onRemoveAnswer }) => {
  const [inputVal, setInputVal] = useState('');
  const listRef = useRef<HTMLUListElement>(null);

  const handleAdd = () => {
    if (inputVal.trim()) {
      onAddAnswer(node.id, inputVal.trim());
      setInputVal('');
      setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  return (
    <div className="bg-white/80 backdrop-blur-md p-5 rounded-3xl shadow-lg border border-white/50 relative">
      
      {node.isCustom && (
        <button
          onClick={() => onDelete(node.id)}
          className="absolute top-3 right-3 w-8 h-8 bg-red-50 text-red-400 border border-red-100 rounded-full flex items-center justify-center text-lg hover:bg-red-500 hover:text-white transition-all z-10"
          title="Eliminar"
        >
          ✕
        </button>
      )}

      {/* Question Header */}
      <div className="mb-4 pr-10">
        <div className="flex items-center gap-3 mb-1">
          <span className="w-3 h-3 rounded-full bg-purple-600 shrink-0 shadow-sm"></span>
          <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">Pregunta</span>
        </div>
        {node.isCustom ? (
          <input
            type="text"
            value={node.question}
            onChange={(e) => onQuestionChange(node.id, e.target.value)}
            placeholder="Escribe tu pregunta aquí..."
            maxLength={DEFAULT_MAX_QUESTION_LENGTH}
            className="font-bold text-lg text-gray-800 bg-transparent border-b-2 border-gray-200 focus:border-[#093c92] outline-none w-full pb-1 transition-colors"
          />
        ) : (
          <h3 className="font-bold text-lg text-gray-800 leading-tight">{node.question}</h3>
        )}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-inner">
        
        {/* Scrollable Answers List */}
        <ul ref={listRef} className="max-h-48 overflow-y-auto p-3 space-y-2 min-h-[60px]">
          {node.answers.length === 0 && (
            <li className="text-sm text-gray-400 italic text-center py-2">{node.placeholder}</li>
          )}
          {node.answers.map((ans, idx) => (
            <li key={idx} className="flex items-start gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
              <span className="text-purple-600 font-bold text-lg leading-none mt-0.5">•</span>
              <span className="text-sm text-gray-700 flex-1 font-medium leading-snug">{ans}</span>
              <button 
                onClick={() => onRemoveAnswer(node.id, idx)}
                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>

        {/* Input Area */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 flex gap-2 items-center">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value.slice(0, DEFAULT_MAX_ANSWER_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="Escribe una respuesta..."
            maxLength={DEFAULT_MAX_ANSWER_LENGTH}
            className="flex-1 p-3 text-sm rounded-xl border border-gray-200 bg-white focus:border-[#093c92] focus:ring-2 focus:ring-[#093c92]/20 outline-none shadow-sm transition-all"
          />
          <button 
            onClick={handleAdd}
            disabled={!inputVal.trim()}
            className="w-11 h-11 bg-[#093c92] text-white rounded-xl font-medium text-xl flex items-center justify-center shadow-md hover:bg-[#072d6f] disabled:opacity-50 disabled:shadow-none transition-all active:scale-95"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente BubbleMap principal (basado en mapa2)
const BubbleMapComponent: React.FC<{
  nodes: BubbleNode[];
  onAddAnswer: (id: string, text: string) => void;
  onRemoveAnswer: (id: string, index: number) => void;
  onQuestionChange: (id: string, value: string) => void;
  onDelete: (id: string) => void;
  personName: string;
  profileImage: string;
}> = ({
  nodes,
  onAddAnswer,
  onRemoveAnswer,
  onQuestionChange,
  onDelete,
  personName,
  profileImage
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 800 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: 800
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  const centerX = dimensions.width / 2;
  const centerY = dimensions.height / 2;
  
  // Radius calculation: considerar el tamaño de los nodos para evitar superposiciones
  // Los nodos tienen w-48 md:w-52 lg:w-60 = 192px, 208px, 240px respectivamente
  // Necesitamos calcular el radio mínimo para que los nodos no se superpongan
  const nodeWidth = dimensions.width > 1024 ? 240 : (dimensions.width > 768 ? 208 : 192);
  const nodeHeight = 250; // altura aproximada de un nodo con respuestas expandidas
  
  // Calcular el radio mínimo necesario basado en el número de nodos y su tamaño
  // Fórmula: necesitamos que la circunferencia pueda acomodar todos los nodos
  const circumference = nodes.length * (nodeWidth + 20); // 20px de margen entre nodos
  const minRadiusFromCircumference = circumference / (2 * Math.PI);
  
  // También considerar el espacio vertical disponible
  const minRadiusFromHeight = (dimensions.height / 2) - (nodeHeight / 2) - 60;
  
  // Usar el máximo de ambos para asegurar que no se superpongan
  const minRadius = Math.max(minRadiusFromCircumference, minRadiusFromHeight, 180);
  
  // Radio final: usar el mínimo entre el radio calculado y el espacio disponible
  const availableRadius = Math.min(dimensions.width, dimensions.height) / 2 - 80;
  const radius = Math.min(minRadius, availableRadius);

  return (
    <div ref={containerRef} className="relative w-full h-[800px] bg-white/30 backdrop-blur-sm rounded-3xl shadow-inner border border-white/50 overflow-hidden">
      
      {/* SVG Connections Layer */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
        {nodes.map((node, index) => {
          // Calcular ángulo: empezar desde arriba (-90 grados) y distribuir uniformemente
          // -90 grados = arriba, luego distribuir en sentido horario
          const angle = (-90 + (index * (360 / nodes.length))) * (Math.PI / 180);
          
          // Posición del nodo en el círculo
          const nodeX = centerX + radius * Math.cos(angle);
          const nodeY = centerY + radius * Math.sin(angle);
          
          // Radio del círculo central: w-24 = 96px, h-24 = 96px -> radio = 48px
          // En lg: w-32 = 128px, h-32 = 128px -> radio = 64px
          // Usamos el promedio para que funcione en ambos tamaños
          const centerRadius = dimensions.width > 1024 ? 64 : 48;
          
          // Punto de inicio de la línea en el borde del círculo central
          const startX = centerX + centerRadius * Math.cos(angle);
          const startY = centerY + centerRadius * Math.sin(angle);
          
          // Calcular punto de control para la curva Bezier (igual que mapa2)
          const cpX = (startX + nodeX) / 2;
          const cpY = (startY + nodeY) / 2;

          return (
            <path
              key={`link-${node.id}`}
              d={`M ${startX} ${startY} Q ${cpX} ${cpY} ${nodeX} ${nodeY}`}
              stroke="rgba(139, 92, 246, 0.3)"
              strokeWidth="2"
              fill="none"
              strokeDasharray="5,5"
              className="animate-[dash_20s_linear_infinite]"
            />
          );
        })}
      </svg>
      
      {/* Center Node - Persona (igual que mapa2 pero con nombre de persona) */}
      <Bubble 
        node={nodes[0] || { id: 'center', question: '', answers: [], placeholder: '' }} // Dummy node passed for types, visual is handled inside by isCenter
        onAddAnswer={() => {}}
        onRemoveAnswer={() => {}}
        x={centerX} 
        y={centerY} 
        isCenter={true}
        personName={personName}
        profileImage={profileImage}
      />

      {/* Question Nodes */}
      {nodes.map((node, index) => {
        // Calcular ángulo: empezar desde arriba (-90 grados) y distribuir uniformemente
        // -90 grados = arriba, luego distribuir en sentido horario
        const angle = (-90 + (index * (360 / nodes.length))) * (Math.PI / 180);
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        
        return (
          <Bubble
            key={node.id}
            node={node}
            onAddAnswer={onAddAnswer}
            onRemoveAnswer={onRemoveAnswer}
            onQuestionChange={onQuestionChange}
            onDelete={onDelete}
            x={x}
            y={y}
          />
        );
      })}
    </div>
  );
};

// Componente principal
export function TabletBubbleMap() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [gameSessionId, setGameSessionId] = useState<number | null>(null);
  const [currentActivityId, setCurrentActivityId] = useState<number | null>(null);
  const [currentActivityName, setCurrentActivityName] = useState<string | null>(null);
  const [currentSessionStageId, setCurrentSessionStageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<string>('--:--');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<{ id: number; name: string; icon?: string; description?: string } | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showTopicChallengeModal, setShowTopicChallengeModal] = useState(false);
  const [showUBotModal, setShowUBotModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Estado del bubble map (basado en mapa2)
  const [personName, setPersonName] = useState<string>('');
  const [profileImage, setProfileImage] = useState<string>('');
  const [nodes, setNodes] = useState<BubbleNode[]>([]);
  
  // Mantener referencias actualizadas para el guardado
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  
  useEffect(() => {
    personNameRef.current = personName;
  }, [personName]);
  
  useEffect(() => {
    profileImageRef.current = profileImage;
  }, [profileImage]);
  
  
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerSyncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerStartTimeRef = useRef<number | null>(null);
  const timerDurationRef = useRef<number | null>(null);
  const timeExpiredRef = useRef<boolean>(false);
  const activityCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasUnsavedChangesRef = useRef<boolean>(false);
  const nodesRef = useRef<BubbleNode[]>([]);
  const personNameRef = useRef<string>('');
  const profileImageRef = useRef<string>('');
  const noActivityCountRef = useRef<number>(0);

  // Detección móvil (basado en mapa2)
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      // Breakpoint at 768px (Standard Tablets start here)
      setIsMobile(width < 768);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Cargar desafío y tema seleccionados (igual que en SeleccionarTemaDesafio)
  const loadSelectedChallenge = async (teamId: number, sessionStageId: number): Promise<Challenge | null> => {
    try {
      const progressList = await teamActivityProgressAPI.list({
        team: teamId,
        session_stage: sessionStageId
      });
      const progressArray = Array.isArray(progressList) ? progressList : [progressList];
      
      // Buscar el progreso que tiene selected_challenge (puede estar en cualquier elemento del array)
      let progressWithChallenge = progressArray.find((p: any) => p?.selected_challenge);
      let progressWithTopic = progressArray.find((p: any) => p?.selected_topic);
      
      // Si no encontramos uno con challenge, usar el primero
      const progress = progressWithChallenge || progressWithTopic || progressArray[0];
      
      if (progress) {
        // Cargar tema si existe (igual que en SeleccionarTemaDesafio)
        if (progress.selected_topic) {
          const topic = typeof progress.selected_topic === 'object' 
            ? progress.selected_topic 
            : { id: progress.selected_topic };
          setSelectedTopic(topic as any);
        }
        
        // Cargar desafío si existe (igual que en SeleccionarTemaDesafio)
        if (progress.selected_challenge) {
          let challenge = typeof progress.selected_challenge === 'object' 
            ? progress.selected_challenge 
            : { id: progress.selected_challenge };
          
          // Si solo viene el ID, cargar desde la API
          if (!challenge.persona_name || !challenge.persona_image_url) {
            challenge = await challengesAPI.getChallengeById(challenge.id);
          }
        
          const fullChallenge = challenge as Challenge;
          setSelectedChallenge(fullChallenge);
          return fullChallenge;
        }
      }
      return null;
    } catch (error) {
      console.error('Error en loadSelectedChallenge:', error);
      return null;
    }
  };

  // Convertir Question[] a BubbleNode[]
  const questionsToNodes = (questions: Array<{ id: number; question: string; answers: Array<{ id: number; text: string }>; isOptional: boolean }>): BubbleNode[] => {
    return questions.map(q => ({
      id: q.id.toString(),
      question: q.question,
      answers: q.answers.map(a => a.text),
      placeholder: 'Escribe una respuesta...',
      isCustom: q.isOptional
    }));
  };

  // Convertir BubbleNode[] a Question[]
  const nodesToQuestions = (nodes: BubbleNode[]): Array<{ id: number; question: string; answers: Array<{ id: number; text: string }>; isOptional: boolean }> => {
    return nodes.map((node, idx) => ({
      id: parseInt(node.id) || idx + 1,
      question: node.question,
      answers: node.answers.map((text, ansIdx) => ({ id: ansIdx + 1, text })),
      isOptional: node.isCustom || false
    }));
  };

  // Cargar bubble map desde el backend
  const loadBubbleMap = async (teamId: number, sessionStageId: number) => {
    try {
      // Cargar tema y desafío primero (esto actualiza selectedTopic y selectedChallenge)
      let challenge: Challenge | null = null;
      try {
        challenge = await loadSelectedChallenge(teamId, sessionStageId);
      } catch (error) {
        challenge = null;
      }

      // Inicializar persona (usar desafío si existe, sino valores por defecto)
      // Pero si hay datos guardados, esos tienen prioridad
      if (challenge && challenge.persona_name) {
        // Establecer valores iniciales del desafío (se sobrescribirán si hay datos guardados)
        setPersonName(challenge.persona_name);
        if (challenge.persona_image_url) {
          setProfileImage(challenge.persona_image_url);
        } else {
          setProfileImage('');
        }
      } else {
        // Si no hay desafío, usar valores por defecto pero continuar
        if (!personName) {
          setPersonName('Persona');
        }
        if (!profileImage) {
          setProfileImage('');
        }
      }

      // Cargar bubble map existente
      try {
      const mapList = await teamBubbleMapsAPI.list({
        team: teamId,
        session_stage: sessionStageId
      });
      const mapArray = Array.isArray(mapList) ? mapList : [mapList];
      const bubbleMap = mapArray[0];

      if (bubbleMap && bubbleMap.map_data) {
        const data = bubbleMap.map_data as BubbleMapData;
          
          // Verificar si ya fue finalizado
        try {
          const transactions = await tokenTransactionsAPI.list({
            team: teamId,
            session_stage: sessionStageId
          });
          const transactionsList = Array.isArray(transactions) ? transactions : [transactions];
          const hasBubbleMapTokens = transactionsList.some((t: any) => 
            t.source_type === 'activity' && t.source_id === bubbleMap.id
          );
          setIsSubmitted(hasBubbleMapTokens);
        } catch (error) {
            // Ignorar error
        }
        
          // Cargar datos centrales (persona) - estos tienen prioridad sobre el challenge
          if (data.central) {
            if (data.central.personName) {
              setPersonName(data.central.personName);
            }
            if (data.central.profileImage) {
              setProfileImage(data.central.profileImage);
            } else if (challenge && challenge.persona_image_url) {
              // Si no hay imagen en datos guardados, usar del challenge
              setProfileImage(challenge.persona_image_url);
            }
          } else {
            // Si no hay datos centrales guardados, usar del challenge
            if (challenge && challenge.persona_name) {
              setPersonName(challenge.persona_name);
              if (challenge.persona_image_url) {
                setProfileImage(challenge.persona_image_url);
              }
            }
          }
          
          // Cargar preguntas y respuestas
          if (data.questions && data.questions.length > 0) {
            // Convertir de formato antiguo a BubbleNode
            const convertedNodes = questionsToNodes(data.questions as any);
            setNodes(convertedNodes);
            hasUnsavedChangesRef.current = false;
            return; // Salir si se cargaron datos exitosamente
          }
        }
      } catch (error) {
        console.error('loadBubbleMap: Error cargando bubble map guardado:', error);
        // Continuar para inicializar con valores por defecto
      }
      
      // Si llegamos aquí, no hay bubble map guardado o no se pudo cargar
      // Inicializar con preguntas por defecto
      const initialNodes: BubbleNode[] = DEFAULT_QUESTIONS.map((q, idx) => ({
          ...q,
        id: (idx + 1).toString()
      }));
      setNodes(initialNodes);
      
    } catch (error) {
      console.error('Error en loadBubbleMap:', error);
      // Inicializar con preguntas por defecto en caso de error
      const initialNodes: BubbleNode[] = DEFAULT_QUESTIONS.map((q, idx) => ({
        ...q,
        id: (idx + 1).toString()
      }));
      setNodes(initialNodes);
      setPersonName('Persona');
      setProfileImage('');
    }
  };

  // Validar bubble map
  const validateBubbleMap = (): { valid: boolean; error?: string } => {
    const mandatoryNodes = nodes.filter(n => !n.isCustom);
    
    if (mandatoryNodes.length < 5) {
      return { valid: false, error: 'Debes tener al menos 5 preguntas obligatorias' };
    }
    
    const nodesWithLessThan2Answers = mandatoryNodes.filter(n => n.answers.length < 2);
    if (nodesWithLessThan2Answers.length > 0) {
      const questionTexts = nodesWithLessThan2Answers.map(n => n.question).join(', ');
      return { 
        valid: false, 
        error: `Cada pregunta obligatoria debe tener al menos 2 respuestas. Faltan respuestas en: ${questionTexts}` 
      };
    }
    
    return { valid: true };
  };

  const handleSaveBubbleMap = async () => {
    if (!team || !currentSessionStageId) {
      toast.error('Faltan datos necesarios');
      return;
    }

    if (isSubmitted) {
      toast.error('El bubble map ya ha sido finalizado y no puede modificarse');
      return;
    }

    const validation = validateBubbleMap();
    if (!validation.valid) {
      toast.error(validation.error || 'No se cumplen los requisitos mínimos');
      return;
    }

    setShowConfirmDialog(true);
  };

  const confirmSubmitBubbleMap = async () => {
    if (!team || !currentSessionStageId) {
      toast.error('Faltan datos necesarios');
      return;
    }

    setShowConfirmDialog(false);
    setSaving(true);
    try {
      await saveBubbleMap();
      
      const finalizeResponse = await teamBubbleMapsAPI.finalize(team.id, currentSessionStageId);
      
      setIsSubmitted(true);
      
      if (finalizeResponse.team_tokens_total !== undefined) {
        setTeam({ ...team, tokens_total: finalizeResponse.team_tokens_total });
      }
      
      const totalBubbles = nodes.length + nodes.reduce((sum, n) => sum + n.answers.length, 0);
      toast.success(`✓ Bubble Map finalizado exitosamente. Tokens otorgados: ${totalBubbles}`);
    } catch (error: any) {
      toast.error('Error al guardar bubble map: ' + (error.response?.data?.error || error.message));
    } finally {
      setSaving(false);
    }
  };

  // Guardar bubble map al backend
  const saveBubbleMap = useCallback(async () => {
    if (!team || !currentSessionStageId) {
      return;
    }
    
    try {
      // Usar los valores más recientes de los refs para asegurar que guardamos el estado actual
      const currentNodes = nodesRef.current;
      const currentPersonName = personNameRef.current;
      const currentProfileImage = profileImageRef.current;
      
      // Convertir de BubbleNode[] a formato antiguo para guardar
      const questions = nodesToQuestions(currentNodes);
      
      const mapData: BubbleMapData = {
        central: {
          personName: currentPersonName,
          profileImage: currentProfileImage || undefined
        },
        questions: questions as any
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
      console.error('saveBubbleMap: Error al guardar', error);
      toast.error('Error al guardar bubble map: ' + (error.response?.data?.error || error.message));
    }
  }, [team, currentSessionStageId]);

  // Guardado automático
  const autoSave = useCallback(() => {
    hasUnsavedChangesRef.current = true;
    
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (team && currentSessionStageId) {
        try {
          // Obtener el estado más reciente de nodes usando una función
          // Esto asegura que usamos el estado actualizado, no el del closure
          await saveBubbleMap();
        } catch (error) {
          console.error('autoSave: Error al guardar', error);
        }
      }
    }, 1000); // 1 segundo para evitar demasiadas llamadas
  }, [team, currentSessionStageId, saveBubbleMap]);

  // Handlers basados en mapa2
  const handleAddAnswer = (id: string, text: string) => {
    if (isSubmitted) {
      toast.error('El bubble map ya ha sido finalizado y no puede modificarse');
      return;
    }
    setNodes(prev => prev.map(node => 
      node.id === id ? { ...node, answers: [...node.answers, text] } : node
    ));
    autoSave();
  };

  const handleRemoveAnswer = (id: string, index: number) => {
    if (isSubmitted) {
      toast.error('El bubble map ya ha sido finalizado y no puede modificarse');
      return;
    }
    setNodes(prev => prev.map(node => 
      node.id === id ? { 
        ...node, 
        answers: node.answers.filter((_, i) => i !== index) 
      } : node
    ));
    autoSave();
  };

  const handleQuestionChange = (id: string, value: string) => {
    if (isSubmitted) {
      toast.error('El bubble map ya ha sido finalizado y no puede modificarse');
      return;
    }
    setNodes(prev => prev.map(node => node.id === id ? { ...node, question: value } : node));
    autoSave();
  };

  const handleAddNode = () => {
    if (isSubmitted) {
      toast.error('El bubble map ya ha sido finalizado y no puede modificarse');
      return;
    }
    if (nodes.length >= MAX_NODES) {
      toast.error(`Has alcanzado el límite máximo de ${MAX_NODES} preguntas`);
      return;
    }
    
    const newNode: BubbleNode = {
      id: Date.now().toString(),
      question: '',
      answers: [],
      placeholder: 'Ej: Bailar, Leer...',
      isCustom: true
    };
    
    setNodes([...nodes, newNode]);
      autoSave();
  };

  const handleDelete = (id: string) => {
    if (isSubmitted) {
      toast.error('El bubble map ya ha sido finalizado y no puede modificarse');
      return;
    }
    const node = nodes.find(n => n.id === id);
    if (node?.isCustom) {
      setNodes(prev => prev.filter(node => node.id !== id));
    autoSave();
    }
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
            toast.error('⏱️ ¡Tiempo agotado!', { duration: 5000 });
            void advanceActivityOnTimerExpiration(gameSessionId);
            
            if (team && currentSessionStageId) {
              saveBubbleMap().then(() => {
                teamBubbleMapsAPI.finalize(team.id, currentSessionStageId).then((response) => {
                  if (response.team_tokens_total !== undefined) {
                    setTeam({ ...team, tokens_total: response.team_tokens_total });
                  }
                const totalBubbles = nodes.length + nodes.reduce((sum, n) => sum + n.answers.length, 0);
                  toast.success(`Tokens otorgados por tiempo agotado: ${totalBubbles}`, { duration: 5000 });
                }).catch((error) => {
                // Ignorar error
                });
              }).catch((error) => {
              // Ignorar error
              });
            }
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

  // Función auxiliar para obtener el color del equipo
  const getTeamColorHex = (color: string): string => {
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
    return colorMap[color] || '#667eea';
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
        const statusData = await tabletConnectionsAPI.getStatus(connectionId);
        if (!statusData || !statusData.team || !statusData.game_session) {
          toast.error('Conexión no válida');
          navigate('/tablet/join');
          return;
        }

        const teamData = statusData.team as Team;
        const gameSession = statusData.game_session as GameSession;

        setTeam(teamData);
        setGameSessionId(gameSession.id);

        // Usar lobby en lugar de getById para evitar problemas de autenticación
        const lobbyData = await sessionsAPI.getLobby(gameSession.id);
        const gameSessionData = lobbyData.game_session;
        
        // Guardar valores iniciales para comparación
        const initialActivityId = gameSessionData.current_activity;
        const initialActivityName = gameSessionData.current_activity_name;
        const initialSessionStageId = gameSessionData.current_session_stage;
        
        // Verificar si la actividad actual es Bubble Map
        const currentActivityNameLower = (initialActivityName || '').toLowerCase().trim();
        
        if (currentActivityNameLower && !currentActivityNameLower.includes('bubble') && !currentActivityNameLower.includes('mapa')) {
          // Si no es Bubble Map, redirigir a la actividad correspondiente
          if (currentActivityNameLower.includes('resultado') || currentActivityNameLower.includes('resultados')) {
            navigate(`/tablet/etapa2/resultados/?connection_id=${connectionId}`, { replace: true });
            return;
          } else if (currentActivityNameLower.includes('tema') || currentActivityNameLower.includes('seleccionar') || currentActivityNameLower.includes('desafio') || currentActivityNameLower.includes('desafío')) {
            navigate(`/tablet/etapa2/seleccionar-tema/?connection_id=${connectionId}`, { replace: true });
            return;
          }
        }
        
        // Cargar bubble map siempre, incluso si no hay actividad/session_stage
        let sessionStageIdToUse = initialSessionStageId;
        
        // Si no hay initialSessionStageId, intentar obtener el session_stage de la etapa 2
        if (!sessionStageIdToUse) {
          try {
            const stages = await sessionsAPI.getSessionStages(gameSession.id);
            const stagesList = Array.isArray(stages) ? stages : [stages];
            const stage2 = stagesList.find((s: any) => s.stage_number === 2);
            if (stage2) {
              sessionStageIdToUse = stage2.id;
            }
          } catch (error) {
            // Ignorar error
          }
        }
        
        if (sessionStageIdToUse) {
          setCurrentSessionStageId(sessionStageIdToUse);
          try {
            await loadBubbleMap(teamData.id, sessionStageIdToUse);
          } catch (error) {
            // Inicializar con valores por defecto en caso de error
            const initialNodes: BubbleNode[] = DEFAULT_QUESTIONS.map((q, idx) => ({
              ...q,
              id: (idx + 1).toString()
            }));
            setNodes(initialNodes);
            setPersonName('Persona');
            setProfileImage('');
          }
        } else {
          // Si no hay session_stage, inicializar con valores por defecto
          const initialNodes: BubbleNode[] = DEFAULT_QUESTIONS.map((q, idx) => ({
            ...q,
            id: (idx + 1).toString()
          }));
          setNodes(initialNodes);
          setPersonName('Persona');
          setProfileImage('');
        }
        
        // Guardar valores iniciales
        setCurrentActivityId(initialActivityId);
        setCurrentActivityName(initialActivityName);
        
        // Iniciar timer si hay actividad
        if (initialActivityId) {
          await startTimer(initialActivityId, gameSession.id);
        }

        // Mostrar modal de U-Bot si no se ha visto
        if (gameSession.id) {
          const ubotKey = `ubot_bubblemap_${gameSession.id}`;
          const hasSeenUBot = localStorage.getItem(ubotKey);
          if (!hasSeenUBot) {
            setTimeout(() => {
              setShowUBotModal(true);
              localStorage.setItem(ubotKey, 'true');
            }, 500);
          }
        }

        // Verificar actividad y etapa periódicamente
        activityCheckIntervalRef.current = setInterval(async () => {
          try {
            // Usar lobby en lugar de getById para evitar problemas de autenticación
            const updatedLobbyData = await sessionsAPI.getLobby(gameSession.id);
            const updatedSession = updatedLobbyData.game_session;

            const resultsUrl = getResultsRedirectUrl(updatedSession, String(connectionId));
            if (resultsUrl) { window.location.href = resultsUrl; return; }

            // Verificar si cambió la actividad o el nombre de la actividad
            const activityChanged = updatedSession.current_activity !== initialActivityId || 
                                   (updatedSession.current_activity_name || '') !== (initialActivityName || '');
            const stageChanged = updatedSession.current_session_stage !== initialSessionStageId;
            
            // Verificar a qué actividad redirigir (siempre verificar, no solo si cambió)
            const newActivityName = (updatedSession.current_activity_name || '').toLowerCase().trim();
            const newStageNumber = updatedSession.current_stage_number;
            
            // PRIORIDAD 1: Si el nombre de la actividad contiene "resultado" o "resultados", redirigir inmediatamente
            if (newActivityName.includes('resultado') || newActivityName.includes('resultados')) {
              if (activityCheckIntervalRef.current) {
                clearInterval(activityCheckIntervalRef.current);
                activityCheckIntervalRef.current = null;
              }
              // Usar navigate para redirección más confiable, con fallback a window.location
              try {
                navigate(`/tablet/etapa2/resultados/?connection_id=${connectionId}`, { replace: true });
              } catch (error) {
                window.location.href = `/tablet/etapa2/resultados/?connection_id=${connectionId}`;
              }
              return;
            }
            
            // PRIORIDAD 2: Si no hay actividad actual (null) y estamos en etapa 2, probablemente terminó y vamos a resultados
            // Verificar también el estado de la sesión para confirmar
            const sessionStatus = updatedSession.status;
            
            if (!updatedSession.current_activity && !updatedSession.current_activity_name && newStageNumber === 2) {
              // Incrementar contador de verificaciones sin actividad
              noActivityCountRef.current += 1;
              
              // Si el estado de la sesión indica que está completada o finalizada, redirigir inmediatamente
              // O si inicialmente había una actividad (estábamos en bubble map) y ahora no hay, redirigir
              // O si hemos verificado varias veces sin actividad (más de 2 veces = 6+ segundos), redirigir
              if (sessionStatus === 'completed' || sessionStatus === 'finished' || 
                  initialActivityId !== null || initialActivityName !== null ||
                  noActivityCountRef.current >= 3) {
                if (activityCheckIntervalRef.current) {
                  clearInterval(activityCheckIntervalRef.current);
                  activityCheckIntervalRef.current = null;
                }
                try {
                  navigate(`/tablet/etapa2/resultados/?connection_id=${connectionId}`, { replace: true });
                } catch (error) {
                  window.location.href = `/tablet/etapa2/resultados/?connection_id=${connectionId}`;
                }
                return;
              }
            } else {
              // Si hay actividad, resetear el contador
              noActivityCountRef.current = 0;
            }
            
            if (activityChanged || stageChanged) {
              // Limpiar intervalos
              if (activityCheckIntervalRef.current) {
                clearInterval(activityCheckIntervalRef.current);
                activityCheckIntervalRef.current = null;
              }
              
              // Si la etapa cambió o se completó, redirigir a resultados o siguiente etapa
              if (stageChanged || (!updatedSession.current_activity && !updatedSession.current_activity_name)) {
                if (newStageNumber === 2 && (!updatedSession.current_activity || newActivityName.includes('resultado'))) {
                  navigate(`/tablet/etapa2/resultados/?connection_id=${connectionId}`, { replace: true });
                  return;
                } else if (newStageNumber === 3) {
                  navigate(`/tablet/etapa3/prototipo/?connection_id=${connectionId}`, { replace: true });
                  return;
                } else {
                  navigate(`/tablet/loading?redirect=/tablet/etapa2/seleccionar-tema&connection_id=${connectionId}`, { replace: true });
                  return;
                }
              }
              
              // Si cambió la actividad pero sigue siendo etapa 2
              if (newActivityName.includes('tema') || newActivityName.includes('seleccionar') || newActivityName.includes('desafio') || newActivityName.includes('desafío')) {
                navigate(`/tablet/etapa2/seleccionar-tema/?connection_id=${connectionId}`, { replace: true });
                return;
              } else if (newActivityName.includes('resultado') || newActivityName.includes('resultados')) {
                navigate(`/tablet/etapa2/resultados/?connection_id=${connectionId}`, { replace: true });
                return;
              } else if (!newActivityName.includes('bubble') && !newActivityName.includes('mapa')) {
                // Si la actividad cambió y no es bubble map ni ninguna de las anteriores, redirigir a resultados por defecto
                navigate(`/tablet/etapa2/resultados/?connection_id=${connectionId}`, { replace: true });
                return;
              }
            }
          } catch (error) {
            console.error('Error verificando actividad:', error);
          }
        }, 3000); // Verificar cada 3 segundos
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

  const canAddMore = nodes.length < MAX_NODES;

  return (
    <div className="relative min-h-screen overflow-hidden flex flex-col">
      {/* Fondo animado igual que otras actividades */}
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

      <div className="relative z-10 p-3 sm:p-4">
        <div className="max-w-6xl mx-auto relative z-20">
        {/* Header Mejorado - Igual que otras actividades */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl p-4 sm:p-6 mb-4 sm:mb-6 flex items-center justify-between flex-wrap gap-4"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <motion.div
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.95 }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg"
              style={{ backgroundColor: getTeamColorHex(team.color) }}
            >
              {team.color.charAt(0).toUpperCase()}
            </motion.div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">{team.name}</h3>
              <p className="text-xs sm:text-sm text-gray-600">Equipo {team.color}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
              {team && (
                <motion.button
                  onClick={() => setShowUBotModal(true)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-gradient-to-r from-pink-500 to-pink-600 text-white px-5 py-2.5 rounded-full font-semibold text-sm sm:text-base flex items-center gap-2 shadow-lg"
                >
                  <Bot className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>U-Bot</span>
                </motion.button>
              )}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-gradient-to-r from-[#093c92] to-blue-700 text-white px-5 py-2.5 rounded-full font-semibold text-sm sm:text-base flex items-center gap-2 shadow-lg"
            >
              <Coins className="w-4 h-4 sm:w-5 sm:h-5" /> {team.tokens_total || 0} Tokens
            </motion.div>
          </div>
        </motion.div>

        {/* Contenedor Principal Mejorado - Igual que otras actividades */}
              <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-white rounded-xl shadow-xl p-4 sm:p-6 pr-24 sm:pr-32"
        >
          {/* Temporizador en esquina superior derecha */}
          {timerRemaining !== '--:--' && (
            <div className="absolute top-0 right-0 bg-yellow-50 border-2 border-yellow-300 rounded-lg px-3 py-2 shadow-sm z-10">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-700" />
                <span className="text-yellow-800 font-semibold text-sm sm:text-base">
                  <span className="font-bold">{timerRemaining}</span>
                </span>
              </div>
            </div>
          )}

          {/* Título y Descripción */}
          <div className="mb-4 sm:mb-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#093c92] to-[#f757ac] rounded-lg flex items-center justify-center shadow-md">
                <Lightbulb className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#093c92]">
                Bubble Map
              </h1>
                              <button
                onClick={() => setShowTopicChallengeModal(true)}
                className="ml-auto bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors shadow-sm"
                title="Ver tema y desafío"
              >
                <Award className="w-4 h-4" />
                <span className="hidden sm:inline">Ver Tema y Desafío</span>
                <span className="sm:hidden">Ver</span>
                              </button>
              {!isSubmitted && canAddMore && (
                              <button
                  onClick={handleAddNode}
                  className="bg-[#093c92] text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-[#072d6f] transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Agregar Pregunta</span>
                              </button>
                          )}
                            </div>
                          </div>

          {/* Contenido del Bubble Map - Igual que mapa2 */}
          {isMobile ? (
            <MobileListView 
              nodes={nodes} 
              onAddAnswer={handleAddAnswer}
              onRemoveAnswer={handleRemoveAnswer}
              onQuestionChange={handleQuestionChange}
              onDelete={handleDelete}
              onAddNode={handleAddNode}
              canAddMore={canAddMore}
              personName={personName}
              profileImage={profileImage}
            />
          ) : (
            <div className="relative">
              <BubbleMapComponent
                nodes={nodes}
                onAddAnswer={handleAddAnswer}
                onRemoveAnswer={handleRemoveAnswer}
                onQuestionChange={handleQuestionChange}
                onDelete={handleDelete}
                personName={personName}
                profileImage={profileImage}
              />
              </div>
          )}

            </motion.div>
      </div>
          </div>

        {/* Modal de Tema y Desafío */}
        {showTopicChallengeModal && createPortal(
          <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999] p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-[#093c92] to-[#f757ac]">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <h2 className="text-[#093c92] font-bold text-xl">
                    Tema y Desafío Seleccionado
              </h2>
                </div>
                <button
                  onClick={() => setShowTopicChallengeModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-100"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Tema */}
                {selectedTopic && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-md">
                        <Lightbulb className="w-5 h-5 text-white" />
          </div>
                      <h3 className="text-blue-900 font-bold text-lg">Tema</h3>
      </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <h4 className="text-gray-800 font-semibold text-base mb-2">{selectedTopic.name}</h4>
                      {selectedTopic.description && (
                        <p className="text-gray-600 text-sm">{selectedTopic.description}</p>
                      )}
                      {selectedTopic.icon && (
                        <div className="mt-3 text-4xl">{selectedTopic.icon}</div>
                      )}
                  </div>
                  </div>
                )}
                
                {/* Desafío */}
                {selectedChallenge && (
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border-2 border-purple-200">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center shadow-md">
                        <Target className="w-5 h-5 text-white" />
                    </div>
                      <h3 className="text-purple-900 font-bold text-lg">Desafío</h3>
              </div>
                    <div className="bg-white rounded-lg p-4 shadow-sm">
                      <h4 className="text-gray-800 font-semibold text-base mb-3">{selectedChallenge.title}</h4>
                      {selectedChallenge.persona_name && (
                        <div className="mb-3">
                          <p className="text-gray-600 text-sm font-medium mb-1">Persona:</p>
                          <p className="text-gray-800 text-base font-semibold">{selectedChallenge.persona_name}</p>
                </div>
                      )}
                      {selectedChallenge.persona_age && (
                        <div className="mb-3">
                          <p className="text-gray-600 text-sm font-medium mb-1">Edad:</p>
                          <p className="text-gray-800 text-base">{selectedChallenge.persona_age} años</p>
            </div>
                      )}
                      {selectedChallenge.persona_story && (
                        <div className="mb-3">
                          <p className="text-gray-600 text-sm font-medium mb-1">Historia:</p>
                          <p className="text-gray-700 text-sm leading-relaxed">{selectedChallenge.persona_story}</p>
                        </div>
                      )}
                      {selectedChallenge.persona_image_url && (
                        <div className="mt-3">
                          <img
                            src={selectedChallenge.persona_image_url.startsWith('http') 
                              ? selectedChallenge.persona_image_url 
                              : `${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:8000'}${selectedChallenge.persona_image_url.startsWith('/') ? '' : '/'}${selectedChallenge.persona_image_url}`}
                            alt={selectedChallenge.persona_name || 'Persona'}
                            className="w-full max-w-xs mx-auto rounded-lg shadow-md object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                    </div>
                      )}
                  </div>
                    </div>
                  )}
                  
                {!selectedTopic && !selectedChallenge && (
                  <div className="text-center py-8 text-gray-500">
                    <Award className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p className="text-lg">No hay tema o desafío seleccionado</p>
                    </div>
                )}
                  </div>

              <div className="mt-6 flex justify-end">
                    <Button
                  onClick={() => setShowTopicChallengeModal(false)}
                  className="bg-[#093c92] text-white hover:bg-[#072d6f] px-6"
                >
                  Cerrar
                    </Button>
                  </div>
                </motion.div>
          </div>,
          document.body
        )}

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
                  Finalizar Bubble Map
                </h2>
              </div>
              
              <p className="text-gray-700 mb-6">
                ¿Estás seguro que quieres <strong>finalizar</strong> el Bubble Map? 
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
                  onClick={confirmSubmitBubbleMap}
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

      {/* Modal de U-Bot para Bubble Map */}
      {team && (
        <UBotBubbleMapModal
          isOpen={showUBotModal}
          onClose={() => setShowUBotModal(false)}
          onContinuar={() => setShowUBotModal(false)}
          teamColor={team.color}
        />
      )}
    </div>
  );
}

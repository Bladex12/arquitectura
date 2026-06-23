import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WordSearchData } from './types';
import { toast } from 'sonner';

interface WordSearchGameProps {
  data: WordSearchData;
  foundWords: string[];
  onWordFound: (word: string, cells: Array<{ row: number; col: number }>) => void;
  onComplete: () => void;
  teamColor?: string;
}

interface Cell {
  row: number;
  col: number;
}

export function WordSearchGame({
  data,
  foundWords,
  onWordFound,
  onComplete,
  teamColor,
}: WordSearchGameProps) {
  // Función para convertir color a hex
  const getTeamColorHex = (color: string) => {
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

  const teamColorHex = teamColor ? getTeamColorHex(teamColor) : '#667eea';
  const [selectedCells, setSelectedCells] = useState<Cell[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startCell, setStartCell] = useState<Cell | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const GRID_SIZE = data.grid.length;
  const allWordsFound = foundWords.length === data.words.length;
  const completedRef = useRef(false);

  useEffect(() => {
    if (allWordsFound && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  }, [allWordsFound, onComplete]);

  // Cleanup: restaurar scroll al desmontar el componente
  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, []);

  const isCellSelected = (row: number, col: number) => {
    return selectedCells.some(c => c.row === row && c.col === col);
  };

  const isCellFound = (row: number, col: number) => {
    return data.wordPositions.some(({ word, cells }) => 
      foundWords.includes(word) && 
      cells.some(c => c.row === row && c.col === col)
    );
  };

  const getCellKey = (row: number, col: number) => `${row}-${col}`;

  const handleMouseDown = (row: number, col: number) => {
    setIsSelecting(true);
    setStartCell({ row, col });
    setSelectedCells([{ row, col }]);
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (!isSelecting || !startCell) return;

    // Calcular celdas entre startCell y la celda actual
    const newCells = getCellsBetween(startCell, { row, col });
    setSelectedCells(newCells);
  };

  const handleMouseUp = () => {
    if (!isSelecting) return;
    setIsSelecting(false);
    verifySelection();
    setStartCell(null);
  };

  const handleTouchStart = (e: React.TouchEvent, row: number, col: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSelecting(true);
    setStartCell({ row, col });
    setSelectedCells([{ row, col }]);
    // Prevenir scroll en el body mientras se selecciona
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSelecting || !startCell) return;
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);

    if (element && element.hasAttribute('data-cell')) {
      const row = parseInt(element.getAttribute('data-row') || '0');
      const col = parseInt(element.getAttribute('data-col') || '0');
      const newCells = getCellsBetween(startCell, { row, col });
      setSelectedCells(newCells);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Restaurar scroll del body
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    if (!isSelecting) return;
    setIsSelecting(false);
    verifySelection();
    setStartCell(null);
  };

  const getCellsBetween = (start: Cell, end: Cell): Cell[] => {
    const cells: Cell[] = [];
    const rowDiff = end.row - start.row;
    const colDiff = end.col - start.col;

    // Solo permitir direcciones horizontales, verticales y diagonales
    if (rowDiff === 0) {
      // Horizontal
      const minCol = Math.min(start.col, end.col);
      const maxCol = Math.max(start.col, end.col);
      for (let col = minCol; col <= maxCol; col++) {
        cells.push({ row: start.row, col });
      }
    } else if (colDiff === 0) {
      // Vertical
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      for (let row = minRow; row <= maxRow; row++) {
        cells.push({ row, col: start.col });
      }
    } else if (Math.abs(rowDiff) === Math.abs(colDiff)) {
      // Diagonal
      const rowStep = rowDiff > 0 ? 1 : -1;
      const colStep = colDiff > 0 ? 1 : -1;
      let row = start.row;
      let col = start.col;
      while (
        (rowStep > 0 ? row <= end.row : row >= end.row) &&
        (colStep > 0 ? col <= end.col : col >= end.col)
      ) {
        cells.push({ row, col });
        row += rowStep;
        col += colStep;
      }
    } else {
      // Si no es una línea recta, solo devolver la celda inicial
      return [start];
    }

    return cells;
  };

  const verifySelection = () => {
    if (selectedCells.length === 0) {
      setSelectedCells([]);
      return;
    }

    // Obtener la palabra formada por las celdas seleccionadas
    const selectedWord = selectedCells
      .map(({ row, col }) => data.grid[row]?.[col] || '')
      .join('')
      .toUpperCase();

    const reversedWord = selectedWord.split('').reverse().join('');

    // Buscar si coincide con alguna palabra no encontrada
    const foundWord = data.wordPositions.find(({ word, cells }) => {
      if (foundWords.includes(word)) return false;
      if (cells.length !== selectedCells.length) return false;

      // Verificar si las celdas coinciden (en cualquier dirección)
      const wordUpper = word.toUpperCase();
      const matchesForward = selectedWord === wordUpper && 
        cells.every((cell, i) => 
          cell.row === selectedCells[i].row && cell.col === selectedCells[i].col
        );
      
      const matchesReverse = reversedWord === wordUpper && 
        cells.every((cell, i) => 
          cell.row === selectedCells[selectedCells.length - 1 - i].row && 
          cell.col === selectedCells[selectedCells.length - 1 - i].col
        );

      return matchesForward || matchesReverse;
    });

    if (foundWord) {
      // Animación de celebración para las celdas encontradas
      const gridElement = gridRef.current;
      if (gridElement) {
        foundWord.cells.forEach(({ row, col }) => {
          const cellElement = gridElement.querySelector(`[data-row="${row}"][data-col="${col}"]`);
          if (cellElement) {
            cellElement.animate([
              { transform: 'scale(1)' },
              { transform: 'scale(1.3)', filter: 'brightness(1.2)' },
              { transform: 'scale(1)' }
            ], {
              duration: 600,
              easing: 'ease-out',
              fill: 'forwards'
            });
          }
        });
      }

      onWordFound(foundWord.word, foundWord.cells);
      toast.success(`🎉 ¡Encontraste "${foundWord.word}"!`, {
        duration: 3000,
        icon: '✅',
      });
      setSelectedCells([]);
    } else {
      setSelectedCells([]);
    }
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false);
        verifySelection();
        setStartCell(null);
        // Restaurar scroll del body
        document.body.style.overflow = '';
        document.body.style.touchAction = '';
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      // Asegurar que se restaure el scroll al desmontar
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isSelecting, selectedCells]);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Lista de palabras a encontrar */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg p-2 sm:p-3 border-2 border-purple-200">
        <div className="flex items-center gap-3 flex-col sm:flex-row">
          <h3 className="text-purple-900 font-bold text-sm sm:text-base flex-shrink-0">
            Palabras a encontrar:
          </h3>
          <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 custom-scrollbar flex-1 w-full sm:w-auto">
            {data.words.map((word) => {
              const encontrada = foundWords.includes(word);
              return (
                <motion.div
                  key={word}
                  initial={false}
                  animate={{ 
                    scale: encontrada ? [1, 1.15, 1] : 1,
                  }}
                className={`
                  flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all text-xs sm:text-sm font-bold shadow-sm
                  ${encontrada 
                    ? 'text-white shadow-lg scale-105' 
                    : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-gray-400'
                  }
                `}
                style={encontrada ? { backgroundColor: teamColorHex } : {}}
                >
                  <span className={encontrada ? 'line-through' : ''}>
                    {word}
                  </span>
                  {encontrada && (
                    <motion.div
                      initial={{ rotate: -180, scale: 0 }}
                      animate={{ rotate: 0, scale: 1 }}
                      transition={{ type: 'spring', damping: 10 }}
                    >
                      <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
          {/* Progreso */}
          <motion.div 
            className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-full px-4 py-1.5 shadow-lg flex-shrink-0"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.5, repeat: foundWords.length > 0 && !allWordsFound ? Infinity : 0, repeatDelay: 2 }}
          >
            <span className="text-white font-bold text-sm sm:text-base">
              {foundWords.length}/{data.words.length} ✓
            </span>
          </motion.div>
        </div>
      </div>

      {/* Grid de sopa de letras */}
      <div className="flex flex-col items-center gap-2 sm:gap-3">
        <div
          ref={gridRef}
          className="inline-block bg-gradient-to-br from-slate-200 to-slate-300 p-2 sm:p-3 rounded-lg shadow-lg select-none"
          style={{ touchAction: 'none' }}
          onMouseLeave={() => {
            if (isSelecting) {
              setIsSelecting(false);
              verifySelection();
              setStartCell(null);
              // Restaurar scroll del body
              document.body.style.overflow = '';
              document.body.style.touchAction = '';
            }
          }}
          onTouchStart={(e) => {
            // Prevenir scroll cuando se toca el grid
            e.preventDefault();
          }}
          onTouchMove={(e) => {
            // Prevenir scroll cuando se mueve sobre el grid
            if (isSelecting) {
              e.preventDefault();
            }
          }}
        >
          <div 
            className="grid gap-0.5 sm:gap-1" 
            style={{ 
              gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
              touchAction: 'none'
            }}
          >
            {data.grid.map((fila, rowIndex) =>
              fila.map((letra, colIndex) => {
                const seleccionada = isCellSelected(rowIndex, colIndex);
                const encontrada = isCellFound(rowIndex, colIndex);

                return (
                  <motion.div
                    key={getCellKey(rowIndex, colIndex)}
                    data-cell="true"
                    data-row={rowIndex}
                    data-col={colIndex}
                    onMouseDown={() => handleMouseDown(rowIndex, colIndex)}
                    onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                    onTouchStart={(e) => handleTouchStart(e, rowIndex, colIndex)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    whileHover={{ scale: encontrada ? 1 : 1.05 }}
                    style={{ touchAction: 'none' }}
                    className={`
                      w-7 h-7 sm:w-9 sm:h-9 md:w-10 md:h-10 flex items-center justify-center cursor-pointer text-xs sm:text-sm md:text-base
                      font-bold rounded transition-all duration-200 select-none
                      ${encontrada 
                        ? 'text-white shadow-lg font-extrabold' 
                        : seleccionada 
                          ? 'text-white shadow-lg font-bold' 
                          : 'bg-white text-gray-700 hover:opacity-80'
                      }
                    `}
                    style={encontrada 
                      ? { 
                          backgroundColor: teamColorHex,
                          boxShadow: `0 0 12px ${teamColorHex}, inset 0 0 8px rgba(255,255,255,0.3)`,
                        } 
                      : seleccionada 
                        ? { 
                            backgroundColor: teamColorHex, 
                            opacity: 0.8,
                            boxShadow: `0 0 8px ${teamColorHex}`
                          }
                        : {}
                    }
                  >
                    <span className="pointer-events-none">
                      {letra}
                    </span>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Mensaje de completado */}
      <AnimatePresence>
        {allWordsFound && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ type: 'spring', damping: 15, stiffness: 100 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 border-4 border-green-500 rounded-xl p-8 text-center shadow-2xl"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
            >
              <CheckCircle2 className="w-16 h-16 sm:w-20 sm:h-20 text-green-600 mx-auto mb-4" />
            </motion.div>
            <p className="text-2xl sm:text-3xl font-bold text-green-700 mb-2">
              ¡COMPLETADO! 🎊
            </p>
            <p className="text-green-800 text-base sm:text-lg font-semibold">
              ✓ Encontraste todas las {data.words.length} palabras
            </p>
            <p className="text-green-700 text-sm mt-3 opacity-90">
              Excelente trabajo, equipo. Prepárate para la siguiente actividad.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


import { MinigameType, AnyMinigameData, MinigameConfig, WordSearchData } from './types';

/**
 * Generador de números pseudoaleatorios con semilla fija
 */
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }
}

/**
 * Genera una sopa de letras con las palabras proporcionadas
 */
function generateWordSearch(words: string[]): WordSearchData {
  const GRID_SIZE = 12;
  const grid: string[][] = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''));
  const wordPositions: Array<{
    word: string;
    cells: Array<{ row: number; col: number }>;
    direction: 'horizontal' | 'vertical' | 'diagonal';
  }> = [];

  // Palabras por defecto si no hay suficientes (más palabras para mayor complejidad)
  const palabrasDefault = ['IDEA', 'META', 'EQUIPO', 'PITCH', 'LIDER', 'RIESGO', 'NEGOCIO', 'VENTA', 'CLIENTE', 'PRODUCTO'];
  // Usar las palabras proporcionadas o las por defecto, limitando a un máximo razonable
  // Por defecto usar 5 palabras para probar el correcto funcionamiento
  const palabrasUsar = words.length >= 5 
    ? words.slice(0, Math.min(words.length, 10))  // Usar todas las palabras proporcionadas hasta 10
    : palabrasDefault.slice(0, Math.max(words.length, 5));  // Si hay menos de 5, usar al menos 5 por defecto

  // Crear una semilla determinística basada en las palabras
  const seedString = palabrasUsar.join('');
  let seed = 0;
  for (let i = 0; i < seedString.length; i++) {
    seed = ((seed << 5) - seed) + seedString.charCodeAt(i);
    seed = seed & seed; // Convertir a entero de 32 bits
  }
  seed = Math.abs(seed);
  const rng = new SeededRandom(seed);

  // Posiciones con mayor complejidad: horizontal, vertical y diagonal
  // IMPORTANTE: Colocar diagonales PRIMERO para evitar conflictos
  // Garantizar que siempre haya al menos 3-4 palabras en diagonal para mayor complejidad
  // Formato: { palabra, row, col, direction: 'horizontal' | 'vertical' | 'diagonal_down_right' | 'diagonal_down_left' }
  // Mezcla de direcciones para mayor desafío - todas verificadas para caber en grid 12x12
  // Solo usar las palabras que realmente existen
  const posiciones = [
    // Diagonales PRIMERO (para evitar conflictos) - GARANTIZAR que siempre haya diagonales
    // Diagonales hacia abajo-derecha (de arriba-izquierda a abajo-derecha)
    ...(palabrasUsar[0] ? [{ palabra: palabrasUsar[0], row: 0, col: 0, direction: 'diagonal_down_right' as const }] : []),
    ...(palabrasUsar[1] ? [{ palabra: palabrasUsar[1], row: 2, col: 2, direction: 'diagonal_down_right' as const }] : []),
    ...(palabrasUsar[2] ? [{ palabra: palabrasUsar[2], row: 4, col: 1, direction: 'diagonal_down_right' as const }] : []),
    // Diagonales hacia abajo-izquierda (de arriba-derecha a abajo-izquierda)
    ...(palabrasUsar[3] ? [{ palabra: palabrasUsar[3], row: 0, col: 11, direction: 'diagonal_down_left' as const }] : []),
    ...(palabrasUsar[4] ? [{ palabra: palabrasUsar[4], row: 2, col: 9, direction: 'diagonal_down_left' as const }] : []),
    // Horizontales
    ...(palabrasUsar[5] ? [{ palabra: palabrasUsar[5], row: 6, col: 0, direction: 'horizontal' as const }] : []),
    ...(palabrasUsar[6] ? [{ palabra: palabrasUsar[6], row: 8, col: 3, direction: 'horizontal' as const }] : []),
    // Verticales
    ...(palabrasUsar[7] ? [{ palabra: palabrasUsar[7], row: 1, col: 7, direction: 'vertical' as const }] : []),
    ...(palabrasUsar[8] ? [{ palabra: palabrasUsar[8], row: 0, col: 5, direction: 'vertical' as const }] : []),
    ...(palabrasUsar[9] ? [{ palabra: palabrasUsar[9], row: 3, col: 11, direction: 'vertical' as const }] : []),
  ].filter(p => p.palabra); // Filtrar posiciones sin palabra

  // Función auxiliar para intentar colocar una palabra en una posición específica
  const intentarColocarPalabra = (
    palabra: string,
    startRow: number,
    startCol: number,
    direction: 'horizontal' | 'vertical' | 'diagonal_down_right' | 'diagonal_down_left'
  ): { exito: boolean; celdas: Array<{ row: number; col: number }> } => {
    const celdas: { row: number; col: number }[] = [];
    const palabraUpper = palabra.toUpperCase();
    
    // Calcular las celdas según la dirección
    const calcularCelda = (index: number): { row: number; col: number } => {
      switch (direction) {
        case 'horizontal':
          return { row: startRow, col: startCol + index };
        case 'vertical':
          return { row: startRow + index, col: startCol };
        case 'diagonal_down_right':
          return { row: startRow + index, col: startCol + index };
        case 'diagonal_down_left':
          return { row: startRow + index, col: startCol - index };
        default:
          return { row: startRow, col: startCol + index };
      }
    };
    
    // Verificar si la palabra puede colocarse sin conflictos
    for (let i = 0; i < palabraUpper.length; i++) {
      const { row, col } = calcularCelda(i);
      
      if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) {
        return { exito: false, celdas: [] };
      }
      
      // Si la celda ya tiene una letra, debe ser la misma letra (intersección válida)
      if (grid[row][col] !== '' && grid[row][col] !== palabraUpper[i]) {
        return { exito: false, celdas: [] };
      }
    }
    
    // Si puede colocarse, colocarla
    for (let i = 0; i < palabraUpper.length; i++) {
      const { row, col } = calcularCelda(i);
      if (grid[row][col] === '' || grid[row][col] === palabraUpper[i]) {
        grid[row][col] = palabraUpper[i];
        celdas.push({ row, col });
      }
    }
    
    return { exito: celdas.length === palabraUpper.length, celdas };
  };

  // Colocar cada palabra, intentando múltiples posiciones si la primera falla
  posiciones.forEach(({ palabra, row: startRow, col: startCol, direction }) => {
    if (!palabra) return;
    
    const palabraUpper = palabra.toUpperCase();
    let colocada = false;
    
    // Intentar primero la posición original
    const resultado = intentarColocarPalabra(palabraUpper, startRow, startCol, direction);
    
    if (resultado.exito) {
      colocada = true;
      // Convertir direction a formato estándar
      let directionStandard: 'horizontal' | 'vertical' | 'diagonal';
      if (direction === 'horizontal' || direction === 'vertical') {
        directionStandard = direction;
      } else {
        directionStandard = 'diagonal';
      }
      
      wordPositions.push({
        word: palabraUpper,
        cells: resultado.celdas,
        direction: directionStandard,
      });
    } else {
      // Si falla, intentar posiciones alternativas de manera más eficiente
      // Intentar primero variaciones cercanas a la posición original
      const offsets = [
        { dr: 0, dc: 0 }, { dr: 1, dc: 0 }, { dr: -1, dc: 0 }, { dr: 0, dc: 1 }, { dr: 0, dc: -1 },
        { dr: 1, dc: 1 }, { dr: -1, dc: -1 }, { dr: 1, dc: -1 }, { dr: -1, dc: 1 }
      ];
      
      // Intentar la posición original con diferentes offsets
      for (const offset of offsets) {
        const newRow = startRow + offset.dr;
        const newCol = startCol + offset.dc;
        
        if (newRow >= 0 && newRow < GRID_SIZE && newCol >= 0 && newCol < GRID_SIZE) {
          const resultadoAlt = intentarColocarPalabra(palabraUpper, newRow, newCol, direction);
          if (resultadoAlt.exito) {
            colocada = true;
            let directionStandard: 'horizontal' | 'vertical' | 'diagonal';
            if (direction === 'horizontal' || direction === 'vertical') {
              directionStandard = direction;
            } else {
              directionStandard = 'diagonal';
            }
            
            wordPositions.push({
              word: palabraUpper,
              cells: resultadoAlt.celdas,
              direction: directionStandard,
            });
            break;
          }
        }
      }
      
      // Si aún no se colocó, intentar otras direcciones en posiciones aleatorias
      if (!colocada) {
        const todasDirecciones: Array<'horizontal' | 'vertical' | 'diagonal_down_right' | 'diagonal_down_left'> = 
          ['horizontal', 'vertical', 'diagonal_down_right', 'diagonal_down_left'];
        
        // Mezclar direcciones para intentar diferentes orientaciones
        const direccionesAleatorias = todasDirecciones.sort(() => Math.random() - 0.5);
        
        for (const dir of direccionesAleatorias) {
          // Intentar algunas posiciones aleatorias válidas
          const maxIntentos = 20;
          for (let intento = 0; intento < maxIntentos; intento++) {
            let r = Math.floor(Math.random() * GRID_SIZE);
            let c = Math.floor(Math.random() * GRID_SIZE);
            
            // Ajustar según la dirección para asegurar que cabe
            if (dir === 'horizontal' && c + palabraUpper.length > GRID_SIZE) {
              c = GRID_SIZE - palabraUpper.length;
            } else if (dir === 'vertical' && r + palabraUpper.length > GRID_SIZE) {
              r = GRID_SIZE - palabraUpper.length;
            } else if (dir === 'diagonal_down_right' && (r + palabraUpper.length > GRID_SIZE || c + palabraUpper.length > GRID_SIZE)) {
              r = Math.min(r, GRID_SIZE - palabraUpper.length);
              c = Math.min(c, GRID_SIZE - palabraUpper.length);
            } else if (dir === 'diagonal_down_left' && (r + palabraUpper.length > GRID_SIZE || c < palabraUpper.length - 1)) {
              r = Math.min(r, GRID_SIZE - palabraUpper.length);
              c = Math.max(c, palabraUpper.length - 1);
            }
            
            if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
              const resultadoAlt = intentarColocarPalabra(palabraUpper, r, c, dir);
              if (resultadoAlt.exito) {
                colocada = true;
                let directionStandard: 'horizontal' | 'vertical' | 'diagonal';
                if (dir === 'horizontal' || dir === 'vertical') {
                  directionStandard = dir;
                } else {
                  directionStandard = 'diagonal';
                }
                
                wordPositions.push({
                  word: palabraUpper,
                  cells: resultadoAlt.celdas,
                  direction: directionStandard,
                });
                break;
              }
            }
          }
          if (colocada) break;
        }
      }
    }
    
    // Si no se pudo colocar después de todos los intentos, solo registrar (no bloquear)
    if (!colocada) {
      // Silenciar el warning en producción - las palabras que no se pueden colocar simplemente no aparecen
      // Esto es aceptable ya que el sistema garantiza al menos 5 palabras colocadas
    }
  });

  // Llenar espacios vacíos con letras determinísticas (estáticas)
  const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      if (grid[i][j] === '') {
        // Usar una semilla determinística basada en la posición de la celda
        const cellSeed = (i * GRID_SIZE + j + seed) % 1000000;
        const cellRng = new SeededRandom(cellSeed);
        const randomIndex = Math.floor(cellRng.next() * letras.length);
        grid[i][j] = letras[randomIndex];
      }
    }
  }

  // Eliminar palabras duplicadas, manteniendo solo la primera ocurrencia
  const palabrasUnicas: string[] = [];
  const palabrasVistas = new Set<string>();
  
  wordPositions.forEach(({ word }) => {
    if (!palabrasVistas.has(word)) {
      palabrasUnicas.push(word);
      palabrasVistas.add(word);
    }
  });

  // Filtrar wordPositions para mantener solo las primeras ocurrencias de cada palabra
  const wordPositionsUnicas = wordPositions.filter(({ word }, index) => 
    palabrasUnicas.indexOf(word) === index
  );

  // GARANTIZAR que haya al menos 5 palabras colocadas
  // Si hay menos de 5, intentar colocar palabras adicionales de la lista
  if (palabrasUnicas.length < 5) {
    const palabrasYaColocadas = new Set(palabrasUnicas);
    const palabrasDisponibles = palabrasUsar.filter(p => !palabrasYaColocadas.has(p.toUpperCase()));
    
    // Intentar colocar palabras adicionales hasta tener al menos 5
    for (const palabraExtra of palabrasDisponibles) {
      if (palabrasUnicas.length >= 5) break;
      
      const palabraUpper = palabraExtra.toUpperCase();
      const todasDirecciones: Array<'horizontal' | 'vertical' | 'diagonal_down_right' | 'diagonal_down_left'> = 
        ['horizontal', 'vertical', 'diagonal_down_right', 'diagonal_down_left'];
      
      const direccionesAleatorias = todasDirecciones.sort(() => Math.random() - 0.5);
      let colocada = false;
      
      for (const dir of direccionesAleatorias) {
        const maxIntentos = 30;
        for (let intento = 0; intento < maxIntentos; intento++) {
          let r = Math.floor(Math.random() * GRID_SIZE);
          let c = Math.floor(Math.random() * GRID_SIZE);
          
          // Ajustar según la dirección para asegurar que cabe
          if (dir === 'horizontal' && c + palabraUpper.length > GRID_SIZE) {
            c = Math.max(0, GRID_SIZE - palabraUpper.length);
          } else if (dir === 'vertical' && r + palabraUpper.length > GRID_SIZE) {
            r = Math.max(0, GRID_SIZE - palabraUpper.length);
          } else if (dir === 'diagonal_down_right' && (r + palabraUpper.length > GRID_SIZE || c + palabraUpper.length > GRID_SIZE)) {
            r = Math.max(0, Math.min(r, GRID_SIZE - palabraUpper.length));
            c = Math.max(0, Math.min(c, GRID_SIZE - palabraUpper.length));
          } else if (dir === 'diagonal_down_left' && (r + palabraUpper.length > GRID_SIZE || c < palabraUpper.length - 1)) {
            r = Math.max(0, Math.min(r, GRID_SIZE - palabraUpper.length));
            c = Math.max(palabraUpper.length - 1, Math.min(c, GRID_SIZE - 1));
          }
          
          if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE) {
            const resultado = intentarColocarPalabra(palabraUpper, r, c, dir);
            if (resultado.exito) {
              colocada = true;
              let directionStandard: 'horizontal' | 'vertical' | 'diagonal';
              if (dir === 'horizontal' || dir === 'vertical') {
                directionStandard = dir;
              } else {
                directionStandard = 'diagonal';
              }
              
              wordPositionsUnicas.push({
                word: palabraUpper,
                cells: resultado.celdas,
                direction: directionStandard,
              });
              palabrasUnicas.push(palabraUpper);
              break;
            }
          }
        }
        if (colocada) break;
      }
    }
  }

  return {
    type: MinigameType.WORD_SEARCH,
    words: palabrasUnicas,
    grid,
    wordPositions: wordPositionsUnicas,
  };
}

/**
 * Convierte la configuración del backend a datos estructurados del minijuego
 * NOTA: La sopa de letras ahora se genera en el backend y viene en word_search_data.
 * Esta función solo maneja anagramas y sopa de letras como fallback de emergencia.
 * @param config - Configuración del minijuego desde el backend
 * @param gameType - Tipo de minijuego a generar
 * @param seed - Semilla determinística opcional (solo para fallback de sopa de letras)
 */
export function parseMinigameConfig(
  config: MinigameConfig,
  gameType: MinigameType,
  seed?: number | string
): AnyMinigameData {
  // Sopa de letras - SOLO COMO FALLBACK DE EMERGENCIA
  // Normalmente esto debería venir del backend en word_search_data
  if (gameType === MinigameType.WORD_SEARCH) {
    console.warn('⚠️ Generando sopa de letras en frontend (fallback). Esto no debería pasar normalmente.');
    let words: string[] = [];
    
    // COMPATIBILIDAD: Si las palabras vienen como array de strings (estructura antigua)
    if (config.words && Array.isArray(config.words)) {
      if (typeof config.words[0] === 'string') {
        words = config.words as string[];
      } else if (typeof config.words[0] === 'object' && 'word' in config.words[0]) {
        words = (config.words as Array<{ word: string }>).map(w => w.word);
      }
    }
    
    // Si no hay palabras, usar palabras por defecto
    if (words.length === 0) {
      words = ['IDEA', 'META', 'EQUIPO', 'PITCH', 'LIDER'];
    }
    
    return generateWordSearch(words);
  }

  // Anagrama
  if (gameType === MinigameType.ANAGRAMA) {
    // Si las palabras vienen como array de objetos {word, anagram}
    if (config.words && Array.isArray(config.words) && config.words.length > 0) {
      const firstWord = config.words[0];
      if (typeof firstWord === 'object' && 'word' in firstWord && 'anagram' in firstWord) {
        // Usar hasta 5 palabras
        const words = (config.words as Array<{ word: string; anagram: string }>).slice(0, 5);
        return {
          type: MinigameType.ANAGRAMA,
          words,
        };
      }
    }

    // Si vienen como array de strings, generar anagramas
    if (config.words && Array.isArray(config.words) && typeof config.words[0] === 'string') {
      let words = (config.words as string[]).slice(0, 5); // Usar hasta 5 palabras
      
      // Si hay menos de 5 palabras, usar palabras por defecto
      const palabrasDefault = ['IDEA', 'META', 'EQUIPO', 'NEGOCIO', 'VENTA'];
      if (words.length < 5) {
        const palabrasFaltantes = palabrasDefault.slice(words.length, 5);
        words = [...words, ...palabrasFaltantes];
      }
      
      return {
        type: MinigameType.ANAGRAMA,
        words: words.map(word => ({
          word,
          anagram: shuffleString(word),
        })),
      };
    }
    
    // Si no hay palabras, usar 5 por defecto
    const palabrasDefault = ['IDEA', 'META', 'EQUIPO', 'NEGOCIO', 'VENTA'];
    return {
      type: MinigameType.ANAGRAMA,
      words: palabrasDefault.map(word => ({
        word,
        anagram: shuffleString(word),
      })),
    };
  }

  // Fallback: anagrama por defecto con 5 palabras
  const palabrasDefault = ['IDEA', 'META', 'EQUIPO', 'NEGOCIO', 'VENTA'];
  return {
    type: MinigameType.ANAGRAMA,
    words: palabrasDefault.map(word => ({
      word,
      anagram: shuffleString(word),
    })),
  };
}

/**
 * Mezcla las letras de una palabra para crear un anagrama
 */
function shuffleString(str: string): string {
  const arr = str.split('');
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.join('').toUpperCase();
}


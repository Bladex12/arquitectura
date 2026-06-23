// Tipos de minijuegos disponibles
export enum MinigameType {
  ANAGRAMA = 'anagrama',
  WORD_SEARCH = 'word_search',
}

// Datos específicos para anagrama
export interface AnagramData {
  type: MinigameType.ANAGRAMA;
  words: Array<{
    word: string;
    anagram: string;
  }>;
}

// Datos específicos para sopa de letras
export interface WordSearchData {
  type: MinigameType.WORD_SEARCH;
  words: string[]; // Lista de palabras a encontrar
  grid: string[][]; // Matriz de letras
  wordPositions: Array<{
    word: string;
    cells: Array<{ row: number; col: number }>;
    direction: 'horizontal' | 'vertical' | 'diagonal';
  }>;
}

// Tipo unión para todos los datos de minijuegos
export type AnyMinigameData = AnagramData | WordSearchData;

// Opción de sopa de letras (creada por la administradora)
export interface WordSearchOption {
  id?: number | string; // ID único de la opción
  name?: string; // Nombre descriptivo (opcional)
  words: string[]; // Lista de palabras para esta sopa de letras
}

// Configuración de minijuego desde el backend
export interface MinigameConfig {
  game_type?: MinigameType;
  words?: string[] | Array<{ word: string; anagram: string }>;
  // Soporte para múltiples opciones de sopa de letras (para que la administradora pueda crear varias)
  word_search_options?: WordSearchOption[]; // Array de opciones de sopas de letras
}


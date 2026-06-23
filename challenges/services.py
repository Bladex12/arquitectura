"""
Servicios para generar sopas de letras y otros minijuegos
"""
import random
import string
from typing import List, Dict, Tuple, Optional


class SeededRandom:
    """Generador de números pseudoaleatorios con semilla fija"""
    def __init__(self, seed: int):
        self.seed = seed

    def next(self) -> float:
        self.seed = (self.seed * 9301 + 49297) % 233280
        return self.seed / 233280


def generate_word_search(words: List[str], seed: Optional[int] = None, max_attempts: int = 50) -> Optional[Dict]:
    """
    Genera una sopa de letras con las palabras proporcionadas.
    Valida que todas las palabras se hayan colocado correctamente.
    Si no, intenta de nuevo con una nueva semilla.
    
    Args:
        words: Lista de palabras a colocar en la sopa de letras (palabras de más de 10 caracteres serán ignoradas)
        seed: Semilla opcional para generar la misma sopa de letras determinísticamente
        max_attempts: Número máximo de intentos para generar una sopa válida
    
    Returns:
        Diccionario con 'words', 'grid' y 'wordPositions' o None si no se pudo generar
    """
    GRID_SIZE = 12
    
    # Validar que todas las palabras tengan máximo 10 caracteres
    palabras_filtradas = [w.upper() for w in words if w and len(w) <= 10]
    if not palabras_filtradas:
        palabras_filtradas = ['EQUIPO', 'MISION', 'IDEAS']
    palabras_usar = palabras_filtradas[:10]  # Máximo 10 palabras
    
    # Intentar generar la sopa de letras hasta que todas las palabras se coloquen
    for attempt in range(max_attempts):
        # Usar una semilla diferente en cada intento si no se proporciona una específica
        current_seed = seed if seed is not None else (attempt + 1) * 1000 + hash(''.join(palabras_usar)) % 1000000
        
        grid = [['' for _ in range(GRID_SIZE)] for _ in range(GRID_SIZE)]
        word_positions = []
        placed_words = set()
        
        rng = SeededRandom(current_seed)
        
        def try_place_word(palabra: str, start_row: int, start_col: int, direction: str) -> Tuple[bool, List[Dict]]:
            """Intenta colocar una palabra en la posición especificada"""
            celdas = []
            palabra_upper = palabra.upper()
            
            def calcular_celda(index: int) -> Tuple[int, int]:
                if direction == 'horizontal':
                    return (start_row, start_col + index)
                elif direction == 'vertical':
                    return (start_row + index, start_col)
                elif direction == 'diagonal_down_right':
                    return (start_row + index, start_col + index)
                elif direction == 'diagonal_down_left':
                    return (start_row + index, start_col - index)
                return (start_row, start_col + index)
            
            # Verificar si se puede colocar
            puede_colocarse = True
            for i in range(len(palabra_upper)):
                row, col = calcular_celda(i)
                if row < 0 or row >= GRID_SIZE or col < 0 or col >= GRID_SIZE:
                    puede_colocarse = False
                    break
                if grid[row][col] != '' and grid[row][col] != palabra_upper[i]:
                    puede_colocarse = False
                    break
            
            if puede_colocarse:
                # Colocar la palabra
                for i in range(len(palabra_upper)):
                    row, col = calcular_celda(i)
                    if grid[row][col] == '' or grid[row][col] == palabra_upper[i]:
                        grid[row][col] = palabra_upper[i]
                        celdas.append({'row': row, 'col': col})
                
                if len(celdas) == len(palabra_upper):
                    direction_standard = 'diagonal' if 'diagonal' in direction else direction
                    return True, celdas
            
            return False, []
        
        # Intentar colocar todas las palabras
        all_possible_directions = ['horizontal', 'vertical', 'diagonal_down_right', 'diagonal_down_left']
        
        for palabra in palabras_usar:
            placed = False
            attempts_per_word = 100  # Intentos por palabra
            
            for _ in range(attempts_per_word):
                random_row = int(rng.next() * GRID_SIZE)
                random_col = int(rng.next() * GRID_SIZE)
                random_direction = all_possible_directions[int(rng.next() * len(all_possible_directions))]
                
                exito, celdas = try_place_word(palabra, random_row, random_col, random_direction)
                if exito:
                    direction_standard = 'diagonal' if 'diagonal' in random_direction else random_direction
                    word_positions.append({
                        'word': palabra,
                        'cells': celdas,
                        'direction': direction_standard
                    })
                    placed_words.add(palabra)
                    placed = True
                    break
            
            if not placed:
                # No se pudo colocar esta palabra, intentar con nueva semilla
                break
        
        # Verificar que todas las palabras se colocaron
        if len(placed_words) == len(palabras_usar):
            # Llenar espacios vacíos con letras determinísticas
            letras = string.ascii_uppercase
            for i in range(GRID_SIZE):
                for j in range(GRID_SIZE):
                    if grid[i][j] == '':
                        cell_seed = (i * GRID_SIZE + j + current_seed) % 1000000
                        cell_rng = SeededRandom(cell_seed)
                        random_index = int(cell_rng.next() * len(letras))
                        grid[i][j] = letras[random_index]
            
            # Eliminar palabras duplicadas
            palabras_unicas = []
            palabras_vistas = set()
            word_positions_unicas = []
            
            for wp in word_positions:
                if wp['word'] not in palabras_vistas:
                    palabras_unicas.append(wp['word'])
                    word_positions_unicas.append(wp)
                    palabras_vistas.add(wp['word'])
            
            return {
                'words': palabras_unicas,
                'grid': grid,
                'wordPositions': word_positions_unicas,
            }
    
    # Si después de todos los intentos no se pudo generar, retornar None
    return None





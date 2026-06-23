import { motion } from 'framer-motion';

interface WordPosition {
  word: string;
  cells: Array<{ row: number; col: number }>;
  direction: 'horizontal' | 'vertical' | 'diagonal';
}

interface WordSearchPreviewProps {
  grid: string[][];
  wordPositions: WordPosition[];
  words: string[];
}

export function WordSearchPreview({ grid, wordPositions, words }: WordSearchPreviewProps) {
  const GRID_SIZE = grid.length;

  const isCellInWord = (row: number, col: number) => {
    return wordPositions.some(({ cells }) =>
      cells.some(c => c.row === row && c.col === col)
    );
  };

  return (
    <div className="space-y-4">
      {/* Lista de palabras */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-bold text-gray-700 mb-2">Palabras a encontrar:</h4>
        <div className="flex flex-wrap gap-2">
          {words.map((word, index) => (
            <span
              key={index}
              className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-semibold"
            >
              {word}
            </span>
          ))}
        </div>
      </div>

      {/* Grid de la sopa de letras */}
      <div className="bg-white rounded-lg p-4 border-2 border-gray-200">
        <div
          className="grid gap-1 mx-auto"
          style={{
            gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))`,
            maxWidth: '500px',
          }}
        >
          {grid.map((row, rowIndex) =>
            row.map((cell, colIndex) => {
              const isHighlighted = isCellInWord(rowIndex, colIndex);
              return (
                <motion.div
                  key={`${rowIndex}-${colIndex}`}
                  className={`
                    aspect-square flex items-center justify-center
                    text-sm sm:text-base font-bold
                    rounded border-2 transition-all
                    ${isHighlighted
                      ? 'bg-blue-200 border-blue-400 text-blue-900'
                      : 'bg-gray-50 border-gray-200 text-gray-700'
                    }
                  `}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: (rowIndex * GRID_SIZE + colIndex) * 0.01 }}
                >
                  {cell}
                </motion.div>
              );
            })
          )}
        </div>
      </div>

      {/* Información adicional */}
      <div className="text-sm text-gray-600 text-center">
        <p>Grid de {GRID_SIZE}x{GRID_SIZE} con {words.length} palabra{words.length !== 1 ? 's' : ''} oculta{words.length !== 1 ? 's' : ''}</p>
        <p className="text-xs mt-1">Las celdas resaltadas en azul muestran dónde están las palabras</p>
      </div>
    </div>
  );
}












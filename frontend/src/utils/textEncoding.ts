/**
 * Utilidad para corregir problemas de encoding UTF-8
 * Corrige caracteres mal codificados que vienen de la base de datos o APIs
 */
export function fixTextEncoding(text: string | null | undefined): string {
  if (!text) return '';
  
  // Convertir a string si no lo es
  let fixed = String(text);
  
  // Correcciones de encoding comunes (caracteres mal codificados)
  const corrections: Array<[RegExp, string]> = [
    // Caracteres comunes mal codificados
    [/EmpatÃ­a/g, 'Empatía'],
    [/EmpatÃa/g, 'Empatía'],
    [/desafÃ­o/g, 'desafío'],
    [/desafÃo/g, 'desafío'],
    
    // Vocales con tilde minúsculas
    [/Ã¡/g, 'á'],
    [/Ã©/g, 'é'],
    [/Ã­/g, 'í'],
    [/Ã³/g, 'ó'],
    [/Ãº/g, 'ú'],
    
    // Vocales con tilde mayúsculas
    [/Ã¡/g, 'Á'],
    [/Ã‰/g, 'É'],
    [/Ã/g, 'Í'],
    [/Ã"/g, 'Í'],
    [/Ã'/g, 'Í'],
    [/Ã"/g, 'Ó'],
    [/Ãš/g, 'Ú'],
    
    // Otras letras especiales
    [/Ã±/g, 'ñ'],
    [/Ã'/g, 'Ñ'],
    [/Ã¼/g, 'ü'],
    [/Ã¿/g, 'ÿ'],
    
    // Casos específicos comunes
    [/comunicaciÃ³n/g, 'comunicación'],
    [/creatividad/g, 'creatividad'],
    [/soluciÃ³n/g, 'solución'],
    [/organizaciÃ³n/g, 'organización'],
    
    // Intentar decodificar como latin1 a utf8 si es necesario
    // (solo si el texto parece estar mal codificado)
    ...(fixed.includes('Ã') ? [
      [new RegExp(String.fromCharCode(0xC3, 0xAD), 'g'), 'í'],
      [new RegExp(String.fromCharCode(0xC3, 0xA1), 'g'), 'á'],
      [new RegExp(String.fromCharCode(0xC3, 0xA9), 'g'), 'é'],
      [new RegExp(String.fromCharCode(0xC3, 0xB3), 'g'), 'ó'],
      [new RegExp(String.fromCharCode(0xC3, 0xBA), 'g'), 'ú'],
      [new RegExp(String.fromCharCode(0xC3, 0xB1), 'g'), 'ñ'],
    ] : []),
  ];
  
  // Aplicar todas las correcciones
  for (const [pattern, replacement] of corrections) {
    fixed = fixed.replace(pattern, replacement);
  }
  
  // Intentar correcciones adicionales para casos comunes
  // Reemplazar más variaciones de caracteres mal codificados
  const additionalCorrections: Array<[RegExp, string]> = [
    // Más variaciones de "ía"
    [/Ã­a/g, 'ía'],
    [/Ãa/g, 'ía'],
    
    // Más variaciones de "ión"
    [/Ã³n/g, 'ión'],
    [/Ã³n/g, 'ión'],
    
    // Variaciones de "ñ"
    [/Ã±/g, 'ñ'],
    [/Ã'/g, 'ñ'],
  ];
  
  for (const [pattern, replacement] of additionalCorrections) {
    fixed = fixed.replace(pattern, replacement);
  }
  
  return fixed;
}

/**
 * Aplica corrección de encoding a objetos y arrays recursivamente
 */
export function fixEncodingRecursive<T>(data: T): T {
  if (typeof data === 'string') {
    return fixTextEncoding(data) as T;
  }
  
  if (Array.isArray(data)) {
    return data.map(fixEncodingRecursive) as T;
  }
  
  if (data && typeof data === 'object') {
    const fixed: any = {};
    for (const [key, value] of Object.entries(data)) {
      fixed[key] = fixEncodingRecursive(value);
    }
    return fixed as T;
  }
  
  return data;
}


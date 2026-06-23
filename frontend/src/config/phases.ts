export interface Phase {
  stageNumber: number;
  name: string;
  color: string;
  colorRich: string;
  glowRgb: [number, number, number];
  surface: string;
  desc: [string, string];
}

export const PHASES: Phase[] = [
  {
    stageNumber: 1,
    name: 'Trabajo en Equipo',
    color: '#818cf8',
    colorRich: '#3730a3',
    glowRgb: [76, 29, 149],
    surface: 'linear-gradient(175deg,#4c1d95 0%,#312e81 60%,#1e1b4b 100%)',
    desc: ['Une fuerzas con tu tripulación intergaláctica.', 'Juntos llegarán más lejos que cualquier nave solitaria.'],
  },
  {
    stageNumber: 2,
    name: 'Empatía',
    color: '#f472b6',
    colorRich: '#9d174d',
    glowRgb: [131, 24, 67],
    surface: 'linear-gradient(175deg,#9d174d 0%,#7c1d4b 60%,#4c0519 100%)',
    desc: ['Sintoniza con las emociones de otros seres.', 'La comprensión es el escudo más poderoso del cosmos.'],
  },
  {
    stageNumber: 3,
    name: 'Creatividad',
    color: '#fb923c',
    colorRich: '#9a3412',
    glowRgb: [124, 45, 18],
    surface: 'linear-gradient(175deg,#92400e 0%,#78350f 60%,#451a03 100%)',
    desc: ['Transforma lo imposible en soluciones brillantes.', 'Tu imaginación es el combustible que mueve estrellas.'],
  },
  {
    stageNumber: 4,
    name: 'Comunicación',
    color: '#22d3ee',
    colorRich: '#0e4e6a',
    glowRgb: [8, 90, 130],
    surface: 'linear-gradient(175deg,#0e7490 0%,#075985 60%,#0c2340 100%)',
    desc: ['Transmite mensajes claros a través del universo.', 'Cada palabra es una señal que conecta mundos lejanos.'],
  },
];

export function getPhase(stageNumber: number): Phase {
  return PHASES.find(p => p.stageNumber === stageNumber) ?? PHASES[0];
}

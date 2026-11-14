/**
 * PATRÓN: Strategy.
 * Cada estrategia encapsula UNA regla de sugerencia según la duración del hueco (RF-HUE-02):
 *   < 30 min → descanso · 30–60 min → alimentación · > 60 min → estudio.
 * `suggestFor` es el "contexto": elige la estrategia aplicable sin if/else. Añadir una regla nueva
 * (p. ej. "> 180 min: biblioteca") es crear otra estrategia y registrarla (Open/Closed).
 *
 * Capa: DOMINIO (puro). Requisitos: RF-HUE-02, RF-HUE-04 (un hueco OCCUPIED no recibe sugerencia).
 */
export type SuggestionKind = 'REST' | 'MEAL' | 'STUDY';
export interface Suggestion { kind: SuggestionKind; title: string; detail: string }

/** @pattern Strategy | Interfaz de la estrategia | Cada regla de sugerencia por duración implementa appliesTo/suggest. */
export interface SuggestionStrategy {
  readonly kind: SuggestionKind;
  appliesTo(minutes: number): boolean;
  suggest(minutes: number): Suggestion;
}

/** @pattern Strategy | Estrategia concreta: descanso (<30 min) | RF-HUE-02: esta regla vive en un objeto propio; cambiarla no toca a las demás. */
export const restStrategy: SuggestionStrategy = {
  kind: 'REST',
  appliesTo: (m) => m < 30,
  suggest: (m) => ({ kind: 'REST', title: 'Descanso', detail: `${m} min: estira, hidrátate o despeja la mente un momento.` }),
};

/** @pattern Strategy | Estrategia concreta: alimentación (30–60 min) | RF-HUE-02: esta regla vive en un objeto propio; cambiarla no toca a las demás. */
export const mealStrategy: SuggestionStrategy = {
  kind: 'MEAL',
  appliesTo: (m) => m >= 30 && m <= 60,
  suggest: (m) => ({ kind: 'MEAL', title: 'Alimentación', detail: `${m} min: buen momento para comer algo con calma.` }),
};

/** @pattern Strategy | Estrategia concreta: estudio (>60 min) | RF-HUE-02: esta regla vive en un objeto propio; cambiarla no toca a las demás. */
export const studyStrategy: SuggestionStrategy = {
  kind: 'STUDY',
  appliesTo: (m) => m > 60,
  suggest: (m) => ({ kind: 'STUDY', title: 'Estudio', detail: `${m} min: alcanza para repasar o adelantar una tarea.` }),
};

export const DEFAULT_STRATEGIES: SuggestionStrategy[] = [restStrategy, mealStrategy, studyStrategy];

/** @pattern Strategy | Contexto | Recorre las estrategias y usa la primera que aplica, sin if/else. */
export function suggestFor(minutes: number, strategies: SuggestionStrategy[] = DEFAULT_STRATEGIES): Suggestion | null {
  return strategies.find((s) => s.appliesTo(minutes))?.suggest(minutes) ?? null;
}

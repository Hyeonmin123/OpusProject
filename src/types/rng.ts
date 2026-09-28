/** Minimal seeded random source interface handed to content (e.g. enemy AI). */
export interface RandomSource {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  chance(probability: number): boolean;
  pick<T>(items: readonly T[]): T;
}

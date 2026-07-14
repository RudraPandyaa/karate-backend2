import { MatchRound } from '@prisma/client';

export interface GeneratedMatch {
  categoryId: string;
  round: MatchRound;
  bracketSlot: number;
  nextSlot?: number;
  pool?: number;
  redAthleteId?: string;
  blueAthleteId?: string;
}

const POOL_SPLIT_THRESHOLD = 16;

const ROUND_BY_DRAW_SIZE: Record<number, MatchRound> = {
  2: MatchRound.FINAL,
  4: MatchRound.SEMI_FINAL,
  8: MatchRound.QUARTER_FINAL,
  16: MatchRound.ROUND_1,
  32: MatchRound.ROUND_2,
};

export class BracketGenerator {
  static generateSingleElimination(
    categoryAthletes: { athleteId: string; seed: number | null }[],
    categoryId: string,
  ): GeneratedMatch[] {
    const athletes = categoryAthletes.map((a) => a.athleteId);

    if (athletes.length <= POOL_SPLIT_THRESHOLD) {
      return this.buildPool(athletes, categoryId, undefined, 0).nodes;
    }

    const mid = Math.ceil(athletes.length / 2);
    const poolA = this.buildPool(athletes.slice(0, mid), categoryId, 1, 0);
    const poolB = this.buildPool(athletes.slice(mid), categoryId, 2, poolA.nextSlot);

    const finalSlot = poolB.nextSlot;
    const finalMatch: GeneratedMatch = {
      categoryId,
      round: MatchRound.FINAL,
      bracketSlot: finalSlot,
    };

    // wire each pool's final match forward into the shared final
    const poolAFinal = poolA.nodes[poolA.nodes.length - 1];
    const poolBFinal = poolB.nodes[poolB.nodes.length - 1];
    poolAFinal.nextSlot = finalSlot;
    poolBFinal.nextSlot = finalSlot;
    // pool finals aren't really "FINAL" round anymore — they're semis feeding the real final
    poolAFinal.round = MatchRound.SEMI_FINAL;
    poolBFinal.round = MatchRound.SEMI_FINAL;

    return [...poolA.nodes, ...poolB.nodes, finalMatch];
  }

  private static buildPool(
    athletes: string[],
    categoryId: string,
    pool: number | undefined,
    slotStart: number,
  ): { nodes: GeneratedMatch[]; nextSlot: number } {
    const drawSize = this.nextPow2(athletes.length);
    const seedPositions = this.seedPositions(drawSize);
    const slots: (string | undefined)[] = new Array(drawSize).fill(undefined);
    seedPositions.forEach((pos, i) => {
      slots[pos - 1] = athletes[i];
    });

    let cursor = slotStart;
    const nodes: GeneratedMatch[] = [];
    let round = ROUND_BY_DRAW_SIZE[drawSize] ?? MatchRound.ROUND_1;
    let current = slots;
    let prevRoundSlots: number[] = [];

    while (current.length >= 2) {
      const thisRoundSlots: number[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const slot = cursor++;
        thisRoundSlots.push(slot);
        nodes.push({
          categoryId,
          round,
          bracketSlot: slot,
          pool,
          redAthleteId: current[i],
          blueAthleteId: current[i + 1],
        });
      }
      if (prevRoundSlots.length) {
        prevRoundSlots.forEach((prevSlot, idx) => {
          const node = nodes.find((n) => n.bracketSlot === prevSlot)!;
          node.nextSlot = thisRoundSlots[Math.floor(idx / 2)];
        });
      }
      prevRoundSlots = thisRoundSlots;
      current = new Array(current.length / 2).fill(undefined);
      round =
        current.length === 1
          ? MatchRound.FINAL
          : ROUND_BY_DRAW_SIZE[current.length] ?? MatchRound.ROUND_2;
    }

    return { nodes, nextSlot: cursor };
  }

  private static nextPow2(n: number): number {
    let p = 2;
    while (p < n) p *= 2;
    return p;
  }

  private static seedPositions(size: number): number[] {
    let positions = [1];
    while (positions.length < size) {
      const next: number[] = [];
      const total = positions.length * 2 + 1;
      for (const p of positions) next.push(p, total - p);
      positions = next;
    }
    return positions;
  }
}
import {
  Corner,
  MatchRound,
} from '@prisma/client';

export interface GeneratedMatch {
  categoryId: string;
  round: MatchRound;
  bracketSlot: number;

  // Winner advancement
  nextSlot?: number;
  nextCorner?: Corner;

  // Loser advancement
  loserNextSlot?: number;
  loserNextCorner?: Corner;

  pool?: number;
  redAthleteId?: string;
  blueAthleteId?: string;
}

export class BracketGenerator {
  static generateSingleElimination(
    categoryAthletes: {
      athleteId: string;
      seed: number | null;
    }[],
    categoryId: string,
  ): GeneratedMatch[] {
    if (categoryAthletes.length < 2) {
      return [];
    }

    const sortedAthletes = [...categoryAthletes].sort((a, b) => {
      if (a.seed === null && b.seed === null) return 0;
      if (a.seed === null) return 1;
      if (b.seed === null) return -1;

      return a.seed - b.seed;
    });

    const athleteIds = sortedAthletes.map(
      (athlete) => athlete.athleteId,
    );

    const drawSize = this.nextPowerOfTwo(
      athleteIds.length,
    );

    const totalRounds = Math.log2(drawSize);

    const slots: (string | undefined)[] =
      new Array(drawSize).fill(undefined);

    const seedPositions = this.generateSeedPositions(
      drawSize,
    );

    athleteIds.forEach((athleteId, index) => {
      const position = seedPositions[index];

      if (position !== undefined) {
        slots[position - 1] = athleteId;
      }
    });

    const matches: GeneratedMatch[] = [];

    let currentSlots = slots;

    let previousRoundMatchSlots: number[] = [];

    let bracketSlot = 0;

    let roundIndex = 0;

    // ==========================================
    // NORMAL WINNER BRACKET
    // ==========================================

    while (currentSlots.length >= 2) {
      const currentRoundMatchSlots: number[] = [];

      const round = this.getRound(
        totalRounds,
        roundIndex,
      );

      for (
        let i = 0;
        i < currentSlots.length;
        i += 2
      ) {
        const matchSlot = bracketSlot++;

        matches.push({
          categoryId,

          round,

          bracketSlot: matchSlot,

          redAthleteId: currentSlots[i],

          blueAthleteId: currentSlots[i + 1],
        });

        currentRoundMatchSlots.push(matchSlot);
      }

      // ==========================================
      // CONNECT PREVIOUS ROUND WINNERS
      // ==========================================

      if (previousRoundMatchSlots.length > 0) {
        previousRoundMatchSlots.forEach(
          (previousSlot, index) => {
            const previousMatch =
              matches.find(
                (match) =>
                  match.bracketSlot === previousSlot,
              );

            if (!previousMatch) return;

            const nextMatchIndex =
              Math.floor(index / 2);

            const nextMatchSlot =
              currentRoundMatchSlots[nextMatchIndex];

            previousMatch.nextSlot =
              nextMatchSlot;

            previousMatch.nextCorner =
              index % 2 === 0
                ? Corner.RED
                : Corner.BLUE;
          },
        );
      }

      previousRoundMatchSlots =
        currentRoundMatchSlots;

      currentSlots =
        new Array(
          currentSlots.length / 2,
        ).fill(undefined);

      roundIndex++;
    }

    // ==========================================
    // ADD BRONZE MEDAL MATCH
    // ==========================================

    const finalMatch = matches.find(
      (match) =>
        match.round === MatchRound.FINAL,
    );

    if (!finalMatch) {
      throw new Error(
        'Final match was not generated',
      );
    }

    const semifinalMatches =
      matches.filter(
        (match) =>
          match.round === MatchRound.SEMI_FINAL,
      );

    const bronzeSlot = bracketSlot++;

    const bronzeMatch: GeneratedMatch = {
      categoryId,

      round: MatchRound.BRONZE_MEDAL,

      bracketSlot: bronzeSlot,
    };

    matches.push(bronzeMatch);

    // ==========================================
    // SEMIFINAL LOSERS -> BRONZE MATCH
    // ==========================================

    if (semifinalMatches.length === 2) {
      semifinalMatches[0].loserNextSlot =
        bronzeSlot;

      semifinalMatches[0].loserNextCorner =
        Corner.RED;

      semifinalMatches[1].loserNextSlot =
        bronzeSlot;

      semifinalMatches[1].loserNextCorner =
        Corner.BLUE;
    }

    return matches;
  }

  private static getRound(
    totalRounds: number,
    roundIndex: number,
  ): MatchRound {
    const roundsRemaining =
      totalRounds - roundIndex;

    if (roundsRemaining === 1) {
      return MatchRound.FINAL;
    }

    if (roundsRemaining === 2) {
      return MatchRound.SEMI_FINAL;
    }

    if (roundsRemaining === 3) {
      return MatchRound.QUARTER_FINAL;
    }

    const roundNumber =
      roundIndex + 1;

    switch (roundNumber) {
      case 1:
        return MatchRound.ROUND_1;

      case 2:
        return MatchRound.ROUND_2;

      case 3:
        return MatchRound.ROUND_3;

      default:
        return MatchRound.ROUND_3;
    }
  }

  private static nextPowerOfTwo(
    value: number,
  ): number {
    let power = 2;

    while (power < value) {
      power *= 2;
    }

    return power;
  }

  private static generateSeedPositions(
    size: number,
  ): number[] {
    let positions = [1];

    while (
      positions.length < size
    ) {
      const next: number[] = [];

      const total =
        positions.length * 2 + 1;

      for (
        const position of positions
      ) {
        next.push(position);

        next.push(
          total - position,
        );
      }

      positions = next;
    }

    return positions;
  }
}
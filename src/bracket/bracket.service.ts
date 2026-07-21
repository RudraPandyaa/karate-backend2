import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { GenerateBracketDto } from './dto/generate-bracket.dto';

import { BracketGenerator } from './bracket.generator/bracket.generator';

import {
  Corner,
  MatchStatus,
} from '@prisma/client';

@Injectable()
export class BracketService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // =========================================================
  // GENERATE BRACKET
  // =========================================================

  async generateBracket(
    dto: GenerateBracketDto,
  ) {
    const { categoryId } = dto;

    const category =
      await this.prisma.category.findUnique({
        where: {
          id: categoryId,
        },

        include: {
          athletes: {
            include: {
              athlete: true,
            },

            orderBy: {
              seed: 'asc',
            },
          },
        },
      });

    if (!category) {
      throw new NotFoundException(
        'Category not found',
      );
    }

    if (category.athletes.length < 2) {
      throw new BadRequestException(
        'At least 2 athletes are required to generate a bracket',
      );
    }

    const existingMatches =
      await this.prisma.match.count({
        where: {
          categoryId,
        },
      });

    if (existingMatches > 0) {
      throw new BadRequestException(
        'Bracket already exists for this category',
      );
    }

    const generatedMatches =
      BracketGenerator.generateSingleElimination(
        category.athletes.map((item) => ({
          athleteId: item.athleteId,
          seed: item.seed,
        })),

        categoryId,
      );

    // NOTE: STEP 3 below does one sequential tx.match.update() per
    // connected match. On NeonDB's connection latency, a 32+ athlete
    // bracket can exceed Prisma's default 5s interactive-transaction
    // timeout, closing the transaction mid-loop (P2028: "Transaction
    // not found"). maxWait/timeout extended below to fix this. If you
    // see this error again on a much larger bracket (64+), the real
    // fix is batching STEP 3 into a single raw SQL UPDATE instead of
    // N sequential round-trips — ask me to build that if it recurs.
    const createdMatches = await this.prisma.$transaction(async (tx) => {
      // =========================================================
      // STEP 1: CREATE ALL MATCHES AT ONCE
      // =========================================================
      await tx.match.createMany({
        data: generatedMatches.map((gm) => ({
          categoryId: gm.categoryId,
          round: gm.round,
          bracketSlot: gm.bracketSlot,
          pool: gm.pool ?? null,

          redAthleteId: gm.redAthleteId ?? null,
          blueAthleteId: gm.blueAthleteId ?? null,

          status: MatchStatus.SCHEDULED,

          timerSeconds: 180,
          timeRemaining: 180,

          nextCorner: gm.nextCorner ?? null,
        })),
      });

      // =========================================================
      // STEP 2: FETCH CREATED MATCHES
      // =========================================================

      const matches = await tx.match.findMany({
        where: {
          categoryId,
        },
        orderBy: {
          bracketSlot: 'asc',
        },
      });

      const slotToId = new Map<number, string>();

      for (const match of matches) {
        if (match.bracketSlot === null) {
          continue;
        }

        slotToId.set(match.bracketSlot, match.id);
      }

      // =========================================================
      // STEP 3: CONNECT NEXT MATCHES
      // =========================================================

      for (const gm of generatedMatches) {
        const matchId = slotToId.get(gm.bracketSlot);

        if (!matchId) {
          continue;
        }

        const updateData: {
          nextMatchId?: string;
          nextCorner?: Corner;
          loserNextMatchId?: string;
          loserNextCorner?: Corner;
        } = {};

        if (gm.nextSlot !== undefined) {
          const nextMatchId = slotToId.get(gm.nextSlot);
          if (nextMatchId) {
            updateData.nextMatchId = nextMatchId;
            updateData.nextCorner = gm.nextCorner;
          }
        }

        if (gm.loserNextSlot !== undefined) {
          const loserNextMatchId = slotToId.get(gm.loserNextSlot);
          if (loserNextMatchId) {
            updateData.loserNextMatchId = loserNextMatchId;
            updateData.loserNextCorner = gm.loserNextCorner;
          }
        }

        if (Object.keys(updateData).length === 0) {
          continue;
        }

        await tx.match.update({
          where: {
            id: matchId,
          },
          data: updateData,
        });
      }

      return matches;
    }, {
      maxWait: 15000, // default 2000ms — time allowed to acquire a DB connection for the transaction
      timeout: 30000, // default 5000ms — time allowed for the whole callback to complete
    });

    // =========================================================
    // STEP 3: PROCESS BYES
    // =========================================================

    await this.cascadeByes(
      categoryId,
    );

    return {
      message:
        `Successfully generated ${createdMatches.length} matches for ${category.name}`,

      totalPlayers:
        category.athletes.length,

      totalMatches:
        createdMatches.length,

      matches:
        await this.getCategoryBracket(
          categoryId,
        ),
    };
  }

  // =========================================================
  // GET BRACKET
  // =========================================================

  async getCategoryBracket(
    categoryId: string,
  ) {
    const category =
      await this.prisma.category.findUnique({
        where: {
          id: categoryId,
        },
      });

    if (!category) {
      throw new NotFoundException(
        'Category not found',
      );
    }

    const matches =
      await this.prisma.match.findMany({
        where: {
          categoryId,
        },

        include: {
          redAthlete: true,
          blueAthlete: true,
          tatami: true,
        },

        orderBy: {
          bracketSlot: 'asc',
        },
      });

    return {
      category,
      matches,
    };
  }

  // =========================================================
  // CASCADE BYES
  // =========================================================

  private async cascadeByes(
    categoryId: string,
  ) {
    let changed = true;

    while (changed) {
      changed = false;

      const matches =
        await this.prisma.match.findMany({
          where: {
            categoryId,

            status:
              MatchStatus.SCHEDULED,
          },

          orderBy: {
            bracketSlot: 'asc',
          },
        });

      for (const match of matches) {
        const hasRed =
          !!match.redAthleteId;

        const hasBlue =
          !!match.blueAthleteId;

        // No athlete = empty match
        if (!hasRed && !hasBlue) {
          continue;
        }

        // Both athletes = real match
        if (hasRed && hasBlue) {
          continue;
        }

        // One athlete = BYE
        const winnerId =
          match.redAthleteId ??
          match.blueAthleteId;

        if (!winnerId) {
          continue;
        }

        await this.prisma.$transaction(
          async (tx) => {
            await tx.match.update({
              where: {
                id: match.id,
              },

              data: {
                status:
                  MatchStatus.COMPLETED,

                winnerId,

                completedAt:
                  new Date(),
              },
            });

            if (
              !match.nextMatchId
            ) {
              return;
            }

            if (
              !match.nextCorner
            ) {
              throw new BadRequestException(
                `Match ${match.id} has no next corner`,
              );
            }

            await tx.match.update({
              where: {
                id: match.nextMatchId,
              },

              data:
                match.nextCorner ===
                Corner.RED
                  ? {
                      redAthleteId:
                        winnerId,
                    }
                  : {
                      blueAthleteId:
                        winnerId,
                    },
            });
          },
        );

        changed = true;
      }
    }
  }

  // =========================================================
  // ASSIGN MATCHES TO TATAMI
  // =========================================================

  async assignMatchesToTatami(
    tatamiId: string,
    matchIds: string[],
  ) {
    const tatami =
      await this.prisma.tatami.findUnique({
        where: {
          id: tatamiId,
        },
      });

    if (!tatami) {
      throw new NotFoundException(
        'Tatami not found',
      );
    }

    await this.prisma.$transaction(
      matchIds.map((matchId) =>
        this.prisma.match.update({
          where: {
            id: matchId,
          },

          data: {
            tatamiId,
          },
        }),
      ),
    );

    return {
      message:
        `Successfully assigned ${matchIds.length} matches to tatami ${tatamiId}`,
    };
  }

  // =========================================================
  // GET TATAMI SCHEDULE
  // =========================================================

  async getTatamiSchedule(
    tatamiId: string,
  ) {
    return this.prisma.match.findMany({
      where: {
        tatamiId,
      },

      include: {
        redAthlete: true,
        blueAthlete: true,
        category: true,
      },

      orderBy: {
        bracketSlot: 'asc',
      },
    });
  }
}
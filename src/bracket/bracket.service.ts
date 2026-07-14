import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { BracketGenerator } from './bracket.generator/bracket.generator';
import { MatchStatus } from '@prisma/client';

@Injectable()
export class BracketService {
  constructor(private prisma: PrismaService) {}

  async generateBracket(dto: GenerateBracketDto) {
    const { categoryId } = dto;

    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        athletes: {
          include: { athlete: true },
          orderBy: { seed: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.athletes.length < 2) {
      throw new BadRequestException('At least 2 athletes required to generate bracket');
    }

    const existingMatches = await this.prisma.match.count({
      where: { categoryId },
    });

    if (existingMatches > 0) {
      throw new BadRequestException(
        'Bracket already generated for this category. Delete existing matches first.',
      );
    }

    const athletes = category.athletes;
    const generatedMatches = BracketGenerator.generateSingleElimination(athletes, categoryId);

    const createdMatches = await this.prisma.$transaction(async (tx) => {
      const slotToId = new Map<number, string>();
      const matches: any[] = [];

      for (const gm of generatedMatches) {
        const match = await tx.match.create({
          data: {
            categoryId: gm.categoryId,
            round: gm.round as any,
            bracketSlot: gm.bracketSlot,
            pool: gm.pool,
            redAthleteId: gm.redAthleteId,
            blueAthleteId: gm.blueAthleteId,
            status: MatchStatus.SCHEDULED,
            timerSeconds: 180,
            timeRemaining: 180,
          },
          include: { redAthlete: true, blueAthlete: true },
        });
        slotToId.set(gm.bracketSlot, match.id);
        matches.push(match);
      }

      // wire nextMatchId using the generator's own nextSlot pointers
      for (const gm of generatedMatches) {
        if (gm.nextSlot === undefined) continue;
        const matchId = slotToId.get(gm.bracketSlot)!;
        const nextMatchId = slotToId.get(gm.nextSlot)!;
        await tx.match.update({ where: { id: matchId }, data: { nextMatchId } });
      }

      return matches;
    });

    await this.cascadeByes(categoryId);

    return {
      message: `Successfully generated ${createdMatches.length} matches for ${category.name}`,
      totalPlayers: athletes.length,
      matches: createdMatches,
    };
  }

  async getCategoryBracket(categoryId: string) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const matches = await this.prisma.match.findMany({
      where: { categoryId },
      include: { redAthlete: true, blueAthlete: true, tatami: true },
      orderBy: { bracketSlot: 'asc' },
    });

    return { category, matches };
  }

  private async cascadeByes(categoryId: string) {
    let changed = true;
    while (changed) {
      changed = false;
      const matches = await this.prisma.match.findMany({
        where: { categoryId, status: MatchStatus.SCHEDULED },
      });
      for (const m of matches) {
        const hasRed = !!m.redAthleteId;
        const hasBlue = !!m.blueAthleteId;
        if (hasRed !== hasBlue) {
          const winnerId = hasRed ? m.redAthleteId : m.blueAthleteId;
          await this.prisma.match.update({
            where: { id: m.id },
            data: { status: MatchStatus.COMPLETED, winnerId },
          });
          if (m.nextMatchId) {
            const next = await this.prisma.match.findUnique({ where: { id: m.nextMatchId } });
            if (next) {
              const field = !next.redAthleteId ? 'redAthleteId' : 'blueAthleteId';
              await this.prisma.match.update({
                where: { id: next.id },
                data: { [field]: winnerId },
              });
            }
          }
          changed = true;
        }
      }
    }
  }

  async assignMatchesToTatami(tatamiId: string, matchIds: string[]) {
    const tatami = await this.prisma.tatami.findUnique({ where: { id: tatamiId } });
    if (!tatami) throw new NotFoundException('Tatami not found');

    await this.prisma.$transaction(
      matchIds.map((matchId) =>
        this.prisma.match.update({
          where: { id: matchId },
          data: { tatamiId },
        }),
      ),
    );

    return {
      message: `Successfully assigned ${matchIds.length} matches to tatami ${tatamiId}`,
    };
  }

  async getTatamiSchedule(tatamiId: string) {
    return this.prisma.match.findMany({
      where: { tatamiId },
      include: {
        redAthlete: true,
        blueAthlete: true,
        category: true,
      },
      orderBy: { bracketSlot: 'asc' },
    });
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchRound, MatchStatus } from '@prisma/client';   // ← Add this

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateMatchDto) {
    return this.prisma.match.create({
      data: {
        categoryId: dto.categoryId,
        round: dto.round as MatchRound,           // ← Fixed
        bracketSlot: dto.bracketSlot,
        redAthleteId: dto.redAthleteId,
        blueAthleteId: dto.blueAthleteId,
        tatamiId: dto.tatamiId,
        status: (dto.status as MatchStatus) || MatchStatus.SCHEDULED,
        timerSeconds: dto.timerSeconds || 180,
        timeRemaining: dto.timerSeconds || 180,
      },
      include: {
        category: true,
        redAthlete: true,
        blueAthlete: true,
        tatami: true,
      },
    });
  }

  findAll() {
    return this.prisma.match.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        redAthlete: true,
        blueAthlete: true,
        tatami: true,
      },
    });
  }

  async findOne(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: {
        category: true,
        redAthlete: true,
        blueAthlete: true,
        tatami: true,
        scoreEvents: true,
        penaltyEvents: true,
      },
    });

    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  async update(id: string, dto: UpdateMatchDto) {
    await this.findOne(id);

    const updatedMatch = await this.prisma.match.update({
      where: { id },
      data: {
        round: dto.round as MatchRound,
        status: dto.status as MatchStatus,
        redScore: dto.redScore,
        blueScore: dto.blueScore,
        winnerId: dto.winnerId,
        timeRemaining: dto.timeRemaining,
        timerSeconds: dto.timerSeconds,
        tatamiId: dto.tatamiId,
      },
      include: {
        category: true,
        redAthlete: true,
        blueAthlete: true,
      },
    });

    if (
      dto.status === MatchStatus.COMPLETED &&
      dto.winnerId
    ) {
      await this.advanceWinner(id, dto.winnerId);
    }

    return updatedMatch;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.match.delete({ where: { id } });
  }

  private async advanceWinner(matchId: string, winnerId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match?.nextMatchId) return;

    const nextMatch = await this.prisma.match.findUnique({
      where: { id: match.nextMatchId },
    });

    if (!nextMatch) return;

    const data: any = {};

    if (!nextMatch.redAthleteId) {
      data.redAthleteId = winnerId;
    } else if (!nextMatch.blueAthleteId) {
      data.blueAthleteId = winnerId;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.match.update({
        where: { id: nextMatch.id },
        data,
      });
    }
  }
}
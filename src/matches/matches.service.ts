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

    return this.prisma.match.update({
      where: { id },
      data: {
        round: dto.round as MatchRound,           // ← Fixed
        status: dto.status as MatchStatus,
        redScore: dto.redScore,
        blueScore: dto.blueScore,
        winnerId: dto.winnerId,
        timeRemaining: dto.timeRemaining,
        timerSeconds: dto.timerSeconds,
        tatamiId: dto.tatamiId,
        // Add any other fields you want to allow updating
      },
      include: {
        category: true,
        redAthlete: true,
        blueAthlete: true,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.match.delete({ where: { id } });
  }
}
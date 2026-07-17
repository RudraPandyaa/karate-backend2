import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchRound, MatchStatus, Role } from '@prisma/client';

@Injectable()
export class MatchesService {
  constructor(private prisma: PrismaService) {}

  private async assertHasRole(userId: string | undefined | null, role: Role) {
    if (!userId) return;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException(`No user found with id ${userId}`);
    if (user.role !== role) {
      throw new BadRequestException(
        `User ${user.name} does not hold the ${role} role (currently ${user.role})`,
      );
    }
  }

  async create(dto: CreateMatchDto) {
    await Promise.all([
      this.assertHasRole(dto.refereeId, Role.REFEREE),
      this.assertHasRole(dto.scorekeeperId, Role.SCOREKEEPER),
    ]);

    return this.prisma.match.create({
      data: {
        categoryId: dto.categoryId,
        round: dto.round as MatchRound,
        bracketSlot: dto.bracketSlot,
        redAthleteId: dto.redAthleteId,
        blueAthleteId: dto.blueAthleteId,
        tatamiId: dto.tatamiId,
        refereeId: dto.refereeId,
        scorekeeperId: dto.scorekeeperId,
        status: (dto.status as MatchStatus) || MatchStatus.SCHEDULED,
        timerSeconds: dto.timerSeconds || 180,
        timeRemaining: dto.timerSeconds || 180,
      },
      include: {
        category: true,
        redAthlete: true,
        blueAthlete: true,
        tatami: true,
        referee: { select: { id: true, name: true, email: true } },
        scorekeeper: { select: { id: true, name: true, email: true } },
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
        referee: { select: { id: true, name: true, email: true } },
        scorekeeper: { select: { id: true, name: true, email: true } },
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
        referee: { select: { id: true, name: true, email: true } },
        scorekeeper: { select: { id: true, name: true, email: true } },
      },
    });

    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  async update(id: string, dto: UpdateMatchDto, requesterRole: Role) {
    await this.findOne(id);

    const isAssigningOfficials = dto.refereeId !== undefined || dto.scorekeeperId !== undefined;
    if (
      isAssigningOfficials &&
      requesterRole !== Role.ADMIN &&
      requesterRole !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Only ADMIN can assign referee or scorekeeper');
    }

    await Promise.all([
      this.assertHasRole(dto.refereeId, Role.REFEREE),
      this.assertHasRole(dto.scorekeeperId, Role.SCOREKEEPER),
    ]);

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
        refereeId: dto.refereeId,
        scorekeeperId: dto.scorekeeperId,
      },
      include: {
        category: true,
        redAthlete: true,
        blueAthlete: true,
        referee: { select: { id: true, name: true, email: true } },
        scorekeeper: { select: { id: true, name: true, email: true } },
      },
    });

    if (dto.status === MatchStatus.COMPLETED && dto.winnerId) {
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
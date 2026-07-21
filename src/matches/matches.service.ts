import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchRound, MatchStatus, Role } from '@prisma/client';
import { ScoringService } from '../scoring/scoring.service';

@Injectable()
export class MatchesService {
  constructor(
    private prisma: PrismaService,
    private scoringService: ScoringService,
  ) {}

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
    const existingMatch = await this.findOne(id);

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

    const isCompleting = dto.status === MatchStatus.COMPLETED && !!dto.winnerId;

    if (isCompleting) {
      if (existingMatch.status === MatchStatus.COMPLETED) {
        throw new BadRequestException('Match is already completed');
      }

      if (
        dto.winnerId !== existingMatch.redAthleteId &&
        dto.winnerId !== existingMatch.blueAthleteId
      ) {
        throw new BadRequestException(
          'winnerId must be one of the two athletes in this match',
        );
      }
    }

    // Wrapped in a transaction so "update match fields" + "advance winner"
    // either both happen or neither does — no more half-completed matches
    // if advanceWinner throws (e.g. missing nextCorner).
    return this.prisma.$transaction(async (tx) => {
      // Non-completion field updates (tatami, officials, in-progress score
      // edits, timer, etc.) go through directly.
      const updatedMatch = await tx.match.update({
        where: { id },
        data: {
          round: dto.round as MatchRound,
          status: isCompleting ? undefined : (dto.status as MatchStatus),
          redScore: dto.redScore,
          blueScore: dto.blueScore,
          winnerId: isCompleting ? undefined : dto.winnerId,
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

      if (isCompleting) {
        // TODO: this endpoint currently has no way to record WHY the
        // match was completed (HANSOKU / KIKEN / HANTEI / manual override).
        // UpdateMatchDto needs a `resultType` field wired through here —
        // send me update-match.dto.ts and I'll finish this.
        return this.scoringService.completeMatch(
          tx,
          id,
          dto.winnerId!,
          (dto as any).resultType ?? 'HANTEI',
        );
      }

      return updatedMatch;
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.match.delete({ where: { id } });
  }

  // advanceWinner removed from here on purpose — it was a broken duplicate
  // of ScoringService.advanceWinner() that ignored nextCorner entirely.
  // ScoringService.advanceWinner() / completeMatch() is now the single
  // source of truth, used by both this service and ScoringService.recordExchange().
}
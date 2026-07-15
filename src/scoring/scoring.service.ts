import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScoreDto } from './dto/create-score.dto';
import { ScoreHelper } from './helpers/score.helper';
import { Corner } from './enums/corner.enum';
import {
  Prisma,
  SenshuHolder,
  MatchStatus,
  MatchResultType,
  ScoreType,
} from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  async recordExchange(matchId: string, dto: CreateScoreDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { scoreEvents: true },
    });

    if (!match) throw new NotFoundException('Match not found');

    if (match.status !== MatchStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot score a match with status ${match.status}`);
    }
    if (!match.redAthleteId || !match.blueAthleteId) {
      throw new BadRequestException('Match is missing an athlete in one corner');
    }

    const exchangeId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      let redDelta = 0;
      let blueDelta = 0;

      const rows = dto.entries.map((entry) => {
        const points = ScoreHelper.getPoints(entry.type);
        const athleteId = entry.corner === Corner.RED
          ? match.redAthleteId!
          : match.blueAthleteId!;

        if (entry.corner === Corner.RED) redDelta += points;
        else blueDelta += points;

        return {
          matchId,
          athleteId,
          corner: entry.corner,
          type: entry.type,
          points,
          exchangeId,
          wasUndone: false,
        };
      });

      // Create score events
      await tx.scoreEvent.createMany({ data: rows });
      const createdEvents = await tx.scoreEvent.findMany({
        where: { exchangeId },
        orderBy: { timestamp: 'asc' },
      });

      const newRedScore = match.redScore + redDelta;
      const newBlueScore = match.blueScore + blueDelta;

      // ====================== SENSHU LOGIC ======================
      let senshu = match.senshu;
      let senshuScoreEventId = match.senshuScoreEventId;

      const isFirstScoreOfMatch = match.scoreEvents.length === 0 && dto.entries.length === 1;
      const isUnopposedScore = dto.entries.length === 1;

      if (isFirstScoreOfMatch && isUnopposedScore && !match.senshuLocked) {
        senshu = dto.entries[0].corner === Corner.RED ? SenshuHolder.RED : SenshuHolder.BLUE;
        senshuScoreEventId = createdEvents[0].id;
      }

      // ====================== MERCY RULE & WINNER ======================
      const mercyRuleTriggered = ScoreHelper.checkMercyRule(newRedScore, newBlueScore);

      let winnerId: string | null = null;
      let resultType: MatchResultType | null = null;

      if (mercyRuleTriggered) {
        // Whoever leads when the mercy-rule gap is hit wins.
        // NOTE: confirm `MatchResultType.MERCY_RULE` (or whatever your
        // schema actually calls it) — swap this for the real enum value.
        winnerId = newRedScore > newBlueScore ? match.redAthleteId : match.blueAthleteId;
        resultType = MatchResultType.POINT_GAP;
      }

      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          redScore: newRedScore,
          blueScore: newBlueScore,
          senshu,
          senshuScoreEventId,

          ...(mercyRuleTriggered && {
            status: MatchStatus.COMPLETED,
            resultType,
            winnerId,
            completedAt: new Date(),
          }),
        },
        include: {
          redAthlete: true,
          blueAthlete: true,
        },
      });

      // Move winner to next round
      if (mercyRuleTriggered && winnerId) {
        await this.advanceWinner(tx, matchId, winnerId);
      }

      return {
        success: true,
        match: updatedMatch,
        scoreEvents: createdEvents,
        mercyRuleTriggered,
        senshuAwarded: senshu !== match.senshu,
      };
    });
  }

  async undoScore(matchId: string, scoreEventId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });
    if (!match) throw new NotFoundException('Match not found');

    const event = await this.prisma.scoreEvent.findUnique({
      where: { id: scoreEventId },
    });
    if (!event || event.matchId !== matchId) {
      throw new NotFoundException('Score event not found');
    }
    if (event.wasUndone) {
      throw new BadRequestException('This event was already undone');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.scoreEvent.update({
        where: { id: scoreEventId },
        data: { wasUndone: true },
      });

      const redDelta = event.corner === Corner.RED ? -event.points : 0;
      const blueDelta = event.corner === Corner.BLUE ? -event.points : 0;

      const wasSenshuGrantor = match.senshuScoreEventId === scoreEventId;

      const updatedMatch = await tx.match.update({
        where: { id: matchId },
        data: {
          redScore: Math.max(0, match.redScore + redDelta),
          blueScore: Math.max(0, match.blueScore + blueDelta),
          ...(wasSenshuGrantor && {
            senshu: SenshuHolder.NONE,
            senshuScoreEventId: null,
          }),
        },
        include: {
          redAthlete: true,
          blueAthlete: true,
        },
      });

      return {
        success: true,
        match: updatedMatch,
        message: 'Score undone successfully',
      };
    });
  }

  // Handle Senshu loss in last 15 seconds
  async forfeitSenshu(matchId: string, corner: Corner) {
    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');

    if (match.senshu === corner) {
      await this.prisma.match.update({
        where: { id: matchId },
        data: {
          senshuLocked: true,
        },
      });
      return { success: true, message: `Senshu forfeited by ${corner}` };
    }

    return { success: false, message: 'No Senshu to forfeit' };
  }

  async getMatchWithHistory(matchId: string) {
    return this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        scoreEvents: {
          where: { wasUndone: false },
          orderBy: { timestamp: 'desc' },
        },
        redAthlete: true,
        blueAthlete: true,
      },
    });
  }

  async getAllLiveMatches() {
    return this.prisma.match.findMany({
      where: { status: { in: [MatchStatus.IN_PROGRESS, MatchStatus.PAUSED] } },
      include: {
        redAthlete: true,
        blueAthlete: true,
        category: true,
        tatami: true,
      },
      orderBy: { startedAt: 'asc' },
    });
  }

  // Now takes the active transaction client so the next-match lookup
  // sees the winner update that hasn't committed yet.
  private async advanceWinner(
    tx: Prisma.TransactionClient,
    matchId: string,
    winnerId: string,
  ){
    const match = await tx.match.findUnique({
      where: { id: matchId },
    });

    if (!match?.nextMatchId) return;

    const nextMatch = await tx.match.findUnique({
      where: { id: match.nextMatchId },
    });

    if (!nextMatch) return;

    const data: any = {};

    if (!nextMatch.redAthleteId) {
      data.redAthleteId = winnerId;
    } else if (!nextMatch.blueAthleteId) {
      data.blueAthleteId = winnerId;
    }

    if (Object.keys(data).length) {
      await tx.match.update({
        where: { id: nextMatch.id },
        data,
      });
    }
  }
}
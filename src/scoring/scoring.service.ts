import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateScoreDto } from './dto/create-score.dto'
import { ScoreHelper } from './helpers/score.helper'
import {
  Corner,
  Prisma,
  SenshuHolder,
  MatchStatus,
  MatchResultType,
} from '@prisma/client'
import { randomUUID } from 'crypto'

@Injectable()
export class ScoringService {
  constructor(private prisma: PrismaService) {}

  async recordExchange(
    matchId: string,
    dto: CreateScoreDto,
  ) {
    const match =
      await this.prisma.match.findUnique({
        where: { id: matchId },
        include: { scoreEvents: true },
      })

    if (!match) {
      throw new NotFoundException(
        'Match not found',
      )
    }

    if (
      match.status !== MatchStatus.IN_PROGRESS &&
      match.status !== MatchStatus.PAUSED
    ) {
      throw new BadRequestException(
        'Match is not active',
      )
    }

    if (
      !match.redAthleteId ||
      !match.blueAthleteId
    ) {
      throw new BadRequestException(
        'Match is missing an athlete in one corner',
      )
    }

    if (dto.entries.length === 2) {
      const corners = new Set(
        dto.entries.map((e) => e.corner),
      )

      if (corners.size !== 2) {
        throw new BadRequestException(
          'A two-entry exchange must have one RED and one BLUE entry',
        )
      }
    }

    const exchangeId = randomUUID()

    return this.prisma.$transaction(
      async (tx) => {
        let redDelta = 0
        let blueDelta = 0

        const rows = dto.entries.map(
          (entry) => {
            const points =
              ScoreHelper.getPoints(entry.type)

            const athleteId =
              entry.corner === Corner.RED
                ? match.redAthleteId!
                : match.blueAthleteId!

            if (
              entry.corner === Corner.RED
            ) {
              redDelta += points
            } else {
              blueDelta += points
            }

            return {
              matchId,
              athleteId,
              corner: entry.corner,
              type: entry.type,
              points,
              exchangeId,
              wasUndone: false,
            }
          },
        )

        await tx.scoreEvent.createMany({
          data: rows,
        })

        const createdEvents =
          await tx.scoreEvent.findMany({
            where: { exchangeId },
            orderBy: {
              timestamp: 'asc',
            },
          })

        const newRedScore =
          match.redScore + redDelta

        const newBlueScore =
          match.blueScore + blueDelta

        // ======================
        // SENSHU
        // ======================

        let senshu = match.senshu
        let senshuScoreEventId =
          match.senshuScoreEventId

        const priorActiveEvents =
          match.scoreEvents.filter(
            (e) => !e.wasUndone,
          ).length

        const isFirstScoreOfMatch =
          priorActiveEvents === 0 &&
          dto.entries.length === 1

        const isUnopposedScore =
          dto.entries.length === 1

        if (
          isFirstScoreOfMatch &&
          isUnopposedScore &&
          !match.senshuLocked
        ) {
          senshu =
            dto.entries[0].corner === Corner.RED
              ? SenshuHolder.RED
              : SenshuHolder.BLUE

          senshuScoreEventId =
            createdEvents[0].id
        }

        // ======================
        // MERCY RULE
        // ======================

        const mercyRuleTriggered =
          ScoreHelper.checkMercyRule(
            newRedScore,
            newBlueScore,
          )

        let winnerId: string | null = null
        let resultType:
          | MatchResultType
          | null = null

        if (mercyRuleTriggered) {
          winnerId =
            newRedScore > newBlueScore
              ? match.redAthleteId
              : match.blueAthleteId

          resultType =
            MatchResultType.POINT_GAP
        }

        const scoredMatch =
          await tx.match.update({
            where: { id: matchId },
            data: {
              redScore: newRedScore,
              blueScore: newBlueScore,
              senshu,
              senshuScoreEventId,
            },
            include: {
              redAthlete: true,
              blueAthlete: true,
            },
          })

        let finalMatch = scoredMatch

        if (
          mercyRuleTriggered &&
          winnerId &&
          resultType
        ) {
          finalMatch =
            await this.completeMatch(
              tx,
              matchId,
              winnerId,
              resultType,
            )
        }

        return {
          success: true,
          match: finalMatch,
          scoreEvents: createdEvents,
          mercyRuleTriggered,
          senshuAwarded:
            senshu !== match.senshu,
        }
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    )
  }

  // ==========================================
  // GET MATCH WITH HISTORY
  // ==========================================

  async getMatchWithHistory(matchId: string) {
    const match =
      await this.prisma.match.findUnique({
        where: {
          id: matchId,
        },
        include: {
          redAthlete: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
            },
          },
          blueAthlete: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
            },
          },
          category: true,
          scoreEvents: {
            orderBy: {
              timestamp: 'desc',
            },
            take: 10,
          },
        },
      })

    if (!match) {
      throw new NotFoundException(
        'Match not found',
      )
    }

    return match
  }

  // ==========================================
  // GET ALL LIVE MATCHES
  // ==========================================

  async getAllLiveMatches() {
    return this.prisma.match.findMany({
      where: {
        status: {
          in: [
            MatchStatus.IN_PROGRESS,
            MatchStatus.PAUSED,
          ],
        },
      },
      include: {
        redAthlete: true,
        blueAthlete: true,
        category: true,
        tatami: true,
      },
      orderBy: {
        startedAt: 'asc',
      },
    })
  }

  // ==========================================
  // COMPLETE MATCH WHEN TIMER REACHES ZERO
  // ==========================================

  async completeMatchByTime(
    matchId: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const match =
          await tx.match.findUnique({
            where: { id: matchId },
          })

        if (!match) {
          throw new NotFoundException(
            'Match not found',
          )
        }

        if (
          match.status === MatchStatus.COMPLETED
        ) {
          return match
        }

        let winnerId: string | null = null

        if (
          match.redScore >
          match.blueScore
        ) {
          winnerId = match.redAthleteId
        } else if (
          match.blueScore >
          match.redScore
        ) {
          winnerId = match.blueAthleteId
        } else {
          // Tie-break using Senshu
          if (
            match.senshu ===
            SenshuHolder.RED
          ) {
            winnerId = match.redAthleteId
          }

          if (
            match.senshu ===
            SenshuHolder.BLUE
          ) {
            winnerId = match.blueAthleteId
          }
        }

        if (!winnerId) {
          throw new BadRequestException(
            'Cannot complete match: no winner can be determined',
          )
        }

        return this.completeMatch(
          tx,
          matchId,
          winnerId,
          MatchResultType.TIME,
        )
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    )
  }

  // ==========================================
  // UNDO SCORE
  // ==========================================

  async undoScore(
    matchId: string,
    scoreEventId: string,
  ) {
    const match =
      await this.prisma.match.findUnique({
        where: { id: matchId },
      })

    if (!match) {
      throw new NotFoundException(
        'Match not found',
      )
    }

    const event =
      await this.prisma.scoreEvent.findUnique({
        where: { id: scoreEventId },
      })

    if (
      !event ||
      event.matchId !== matchId
    ) {
      throw new NotFoundException(
        'Score event not found',
      )
    }

    if (event.wasUndone) {
      throw new BadRequestException(
        'This event was already undone',
      )
    }

    return this.prisma.$transaction(
      async (tx) => {
        await tx.scoreEvent.update({
          where: {
            id: scoreEventId,
          },
          data: {
            wasUndone: true,
          },
        })

        const redDelta =
          event.corner === Corner.RED
            ? -event.points
            : 0

        const blueDelta =
          event.corner === Corner.BLUE
            ? -event.points
            : 0

        const wasSenshuGrantor =
          match.senshuScoreEventId ===
          scoreEventId

        const updatedMatch =
          await tx.match.update({
            where: {
              id: matchId,
            },
            data: {
              redScore: Math.max(
                0,
                match.redScore + redDelta,
              ),
              blueScore: Math.max(
                0,
                match.blueScore + blueDelta,
              ),
              ...(wasSenshuGrantor && {
                senshu: SenshuHolder.NONE,
                senshuScoreEventId: null,
              }),
            },
            include: {
              redAthlete: true,
              blueAthlete: true,
            },
          })

        return {
          success: true,
          match: updatedMatch,
          message:
            'Score undone successfully',
        }
      },
      {
        maxWait: 10000,
        timeout: 20000,
      },
    )
  }

  // ==========================================
  // COMPLETE MATCH
  // ==========================================

  async completeMatch(
    tx: Prisma.TransactionClient,
    matchId: string,
    winnerId: string,
    resultType: MatchResultType,
  ) {
    const result =
      await tx.match.updateMany({
        where: {
          id: matchId,
          status: {
            not: MatchStatus.COMPLETED,
          },
        },
        data: {
          status: MatchStatus.COMPLETED,
          winnerId,
          resultType,
          completedAt: new Date(),
          timeRemaining: 0,
        },
      })

    if (result.count === 0) {
      throw new BadRequestException(
        'Match is already completed',
      )
    }

    const match =
      await tx.match.findUnique({
        where: { id: matchId },
      })

    if (!match) {
      throw new NotFoundException(
        'Match not found after completion',
      )
    }

    await this.routeWinner(
      tx,
      match,
      winnerId,
    )

    await this.routeLoser(
      tx,
      match,
      winnerId,
    )

    const completed =
      await tx.match.findUnique({
        where: { id: matchId },
        include: {
          redAthlete: true,
          blueAthlete: true,
        },
      })

    if (!completed) {
      throw new NotFoundException(
        'Match not found after completion',
      )
    }

    return completed
  }

  async advanceWinner(
    tx: Prisma.TransactionClient,
    matchId: string,
    winnerId: string,
  ) {
    const match =
      await tx.match.findUnique({
        where: { id: matchId },
      })

    if (!match) {
      throw new NotFoundException(
        'Match not found',
      )
    }

    await this.routeWinner(
      tx,
      match,
      winnerId,
    )
  }

  async advanceLoser(
    tx: Prisma.TransactionClient,
    matchId: string,
    winnerId: string,
  ) {
    const match =
      await tx.match.findUnique({
        where: { id: matchId },
      })

    if (!match) {
      throw new NotFoundException(
        'Match not found',
      )
    }

    await this.routeLoser(
      tx,
      match,
      winnerId,
    )
  }

  private async routeWinner(
    tx: Prisma.TransactionClient,
    match: Prisma.MatchGetPayload<{}>,
    winnerId: string,
  ) {
    console.log('[ROUTE WINNER]', {
      matchId: match.id,
      winnerId,
      nextMatchId: match.nextMatchId,
      nextCorner: match.nextCorner,
    })

    if (!match.nextMatchId) {
      console.log(
        `[ROUTE WINNER] Match ${match.id} has no next match`,
      )
      return
    }

    if (!match.nextCorner) {
      throw new BadRequestException(
        'Next corner is not configured for this match',
      )
    }

    await tx.match.update({
      where: {
        id: match.nextMatchId,
      },
      data:
        match.nextCorner === Corner.RED
          ? {
              redAthleteId: winnerId,
            }
          : {
              blueAthleteId: winnerId,
            },
    })
  }

  private async routeLoser(
    tx: Prisma.TransactionClient,
    match: Prisma.MatchGetPayload<{}>,
    winnerId: string,
  ) {
    if (!match.loserNextMatchId) {
      return
    }

    const loserId =
      match.redAthleteId === winnerId
        ? match.blueAthleteId
        : match.redAthleteId

    if (!loserId) {
      return
    }

    if (!match.loserNextCorner) {
      throw new BadRequestException(
        'loserNextCorner is not configured for this match',
      )
    }

    await tx.match.update({
      where: {
        id: match.loserNextMatchId,
      },
      data:
        match.loserNextCorner === Corner.RED
          ? {
              redAthleteId: loserId,
            }
          : {
              blueAthleteId: loserId,
            },
    })
  }
}
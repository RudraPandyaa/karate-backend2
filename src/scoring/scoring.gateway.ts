import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { PrismaService } from '../prisma/prisma.service'
import { Injectable } from '@nestjs/common'
import { ScoringService } from './scoring.service'
import { CreateScoreDto } from './dto/create-score.dto'

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/scoring',
})
export class ScoringGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server

  private activeTimers = new Map<string, NodeJS.Timeout>()

  constructor(
    private prisma: PrismaService,
    private scoringService: ScoringService,
  ) {}

  // =========================================================
  // CONNECTION
  // =========================================================

  handleConnection(client: Socket) {
    console.log(`🔌 Client connected to scoring gateway: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected from scoring gateway: ${client.id}`)
  }

  // =========================================================
  // JOIN MATCH
  // =========================================================

  @SubscribeMessage('joinMatch')
  handleJoinMatch(
    @MessageBody() data: { matchId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`match-${data.matchId}`)

    console.log(
      `Client ${client.id} joined match room: ${data.matchId}`,
    )

    return {
      event: 'joined',
      matchId: data.matchId,
    }
  }

  // =========================================================
  // START TIMER
  // =========================================================

  @SubscribeMessage('startTimer')
  async startTimer(
    @MessageBody() data: { matchId: string },
  ) {
    const match = await this.prisma.match.findUnique({
      where: {
        id: data.matchId,
      },
    })

    if (!match) {
      return
    }

    // Do not start an already completed match
    if (match.status === 'COMPLETED') {
      return
    }

    // Do not start a match with no time remaining
    if (match.timeRemaining <= 0) {
      return
    }

    // Prevent duplicate timers
    if (this.activeTimers.has(data.matchId)) {
      clearInterval(
        this.activeTimers.get(data.matchId)!,
      )

      this.activeTimers.delete(data.matchId)
    }

    await this.prisma.match.update({
      where: {
        id: data.matchId,
      },
      data: {
        status: 'IN_PROGRESS',
        startedAt: match.startedAt ?? new Date(),
      },
    })

    this.server
      .to(`match-${data.matchId}`)
      .emit('timerStarted', {
        message: 'Match Started',
      })

    const interval = setInterval(async () => {
      try {
        const current =
          await this.prisma.match.findUnique({
            where: {
              id: data.matchId,
            },
          })

        if (!current) {
          clearInterval(interval)
          this.activeTimers.delete(data.matchId)
          return
        }

        // If paused or completed, stop this server timer
        if (current.status !== 'IN_PROGRESS') {
          clearInterval(interval)
          this.activeTimers.delete(data.matchId)
          return
        }

        // =====================================================
        // TIMER REACHED ZERO
        // =====================================================
        if (current.timeRemaining <= 1) {
          clearInterval(interval)
          this.activeTimers.delete(data.matchId)

          try {
            const result =
              await this.scoringService.completeMatchByTime(
                data.matchId,
              )

            this.server
              .to(`match-${data.matchId}`)
              .emit('timerEnded', {
                message: 'Time Up',
                timeRemaining: 0,
                match: result,
              })
          } catch (error) {
            console.error(
              `[Match Completion Error] ${data.matchId}`,
              error,
            )
          }

          return
        }

        // =====================================================
        // DECREASE ONE SECOND
        // =====================================================

        const updated =
          await this.prisma.match.update({
            where: {
              id: data.matchId,
            },
            data: {
              timeRemaining: {
                decrement: 1,
              },
            },
          })

        this.server
          .to(`match-${data.matchId}`)
          .emit('timerUpdate', {
            timeRemaining:
              updated.timeRemaining,
            isRunning: true,
          })
      } catch (error) {
        console.error(
          `[Timer Error] Match ${data.matchId}`,
          error,
        )

        clearInterval(interval)
        this.activeTimers.delete(data.matchId)
      }
    }, 1000)

    this.activeTimers.set(
      data.matchId,
      interval,
    )
  }

  // =========================================================
  // PAUSE TIMER
  // =========================================================

  @SubscribeMessage('pauseTimer')
  async pauseTimer(
    @MessageBody() data: { matchId: string },
  ) {
    const match = await this.prisma.match.findUnique({
      where: {
        id: data.matchId,
      },
    })

    if (!match) {
      return
    }

    if (this.activeTimers.has(data.matchId)) {
      clearInterval(
        this.activeTimers.get(data.matchId)!,
      )

      this.activeTimers.delete(data.matchId)
    }

    await this.prisma.match.update({
      where: {
        id: data.matchId,
      },
      data: {
        status: 'PAUSED',
      },
    })

    this.server
      .to(`match-${data.matchId}`)
      .emit('timerPaused', {
        message: 'Match Paused',
      })
  }

  // =========================================================
  // ADJUST TIME
  // =========================================================

  @SubscribeMessage('adjustTime')
  async adjustTime(
    @MessageBody()
    data: {
      matchId: string
      deltaSeconds: number
    },
  ) {
    const match =
      await this.prisma.match.findUnique({
        where: {
          id: data.matchId,
        },
      })

    if (!match) {
      return {
        success: false,
        message: 'Match not found',
      }
    }

    // Must pause before adjusting time
    if (match.status !== 'PAUSED') {
      const message =
        'Pause the match before adding or removing seconds'

      this.server
        .to(`match-${data.matchId}`)
        .emit('timerAdjustmentRejected', {
          message,
        })

      return {
        success: false,
        message,
      }
    }

    if (
      !Number.isInteger(data.deltaSeconds) ||
      data.deltaSeconds === 0
    ) {
      return {
        success: false,
        message: 'Invalid time adjustment',
      }
    }

    const newTimeRemaining =
      Math.max(
        0,
        match.timeRemaining +
          data.deltaSeconds,
      )

    const updated =
      await this.prisma.match.update({
        where: {
          id: data.matchId,
        },
        data: {
          timeRemaining: newTimeRemaining,
        },
      })

    const message =
      data.deltaSeconds > 0
        ? `+${data.deltaSeconds} seconds added`
        : `${Math.abs(data.deltaSeconds)} seconds removed`

    this.server
      .to(`match-${data.matchId}`)
      .emit('timerAdjusted', {
        timeRemaining:
          updated.timeRemaining,
        delta: data.deltaSeconds,
        message,
      })

    return {
      success: true,
      timeRemaining:
        updated.timeRemaining,
      message,
    }
  }

  // =========================================================
  // SCORING
  // =========================================================

  @SubscribeMessage('recordExchange')
  async recordExchange(
    @MessageBody() dto: any,
  ) {
    const result =
      await this.scoringService.recordExchange(
        dto.matchId,
        dto as CreateScoreDto,
      )

    this.server
      .to(`match-${dto.matchId}`)
      .emit('scoreUpdated', result)

    return result
  }

  // =========================================================
  // UNDO SCORE
  // =========================================================

  @SubscribeMessage('undoScore')
  async undoScore(
    @MessageBody()
    dto: {
      matchId: string
      scoreEventId: string
    },
  ) {
    const result =
      await this.scoringService.undoScore(
        dto.matchId,
        dto.scoreEventId,
      )

    this.server
      .to(`match-${dto.matchId}`)
      .emit('scoreUpdated', result)

    return result
  }
}
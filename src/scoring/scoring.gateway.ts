import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { Injectable } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { CreateScoreDto } from './dto/create-score.dto';

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/scoring',
})
export class ScoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private activeTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    private scoringService: ScoringService,
  ) {}

  // Required methods for interfaces
  handleConnection(client: Socket) {
    console.log(`🔌 Client connected to scoring gateway: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔌 Client disconnected from scoring gateway: ${client.id}`);
  }

  // ====================== JOIN MATCH ======================
  @SubscribeMessage('joinMatch')
  handleJoinMatch(
    @MessageBody() data: { matchId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(`match-${data.matchId}`);
    console.log(`Client ${client.id} joined match room: ${data.matchId}`);
    return { event: 'joined', matchId: data.matchId };
  }

  // ====================== TIMER ======================
  @SubscribeMessage('startTimer')
  async startTimer(@MessageBody() data: { matchId: string }) {
    if (this.activeTimers.has(data.matchId)) {
      clearInterval(this.activeTimers.get(data.matchId)!);
    }

    await this.prisma.match.update({
      where: { id: data.matchId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    this.server.to(`match-${data.matchId}`).emit('timerStarted', {
      message: 'Match Started',
    });

    const interval = setInterval(async () => {
      const match = await this.prisma.match.findUnique({
        where: { id: data.matchId },
      });

      if (!match || match.timeRemaining <= 0 || match.status !== 'IN_PROGRESS') {
        clearInterval(interval);
        this.activeTimers.delete(data.matchId);

        this.server.to(`match-${data.matchId}`).emit('timerEnded', {
          message: 'Time Up',
        });

        return;
      }

      const updated = await this.prisma.match.update({
        where: { id: data.matchId },
        data: {
          timeRemaining: match.timeRemaining - 1,
        },
      });

      this.server.to(`match-${data.matchId}`).emit('timerUpdate', {
        timeRemaining: updated.timeRemaining,
        isRunning: true,
      });
    }, 1000);

    this.activeTimers.set(data.matchId, interval);
  }

  @SubscribeMessage('pauseTimer')
  async pauseTimer(@MessageBody() data: { matchId: string }) {
    if (this.activeTimers.has(data.matchId)) {
      clearInterval(this.activeTimers.get(data.matchId)!);
      this.activeTimers.delete(data.matchId);
    }

    await this.prisma.match.update({
      where: { id: data.matchId },
      data: {
        status: 'PAUSED',
      },
    });

    this.server.to(`match-${data.matchId}`).emit('timerPaused', {
      message: 'Match Paused',
    });
  }

  @SubscribeMessage('adjustTime')
  async adjustTime(
    @MessageBody()
    data: {
      matchId: string;
      deltaSeconds: number;
    },
  ) {
    const match = await this.prisma.match.findUnique({
      where: {
        id: data.matchId,
      },
    });

    if (!match) return;

    const updated = await this.prisma.match.update({
      where: {
        id: data.matchId,
      },
      data: {
        timeRemaining: Math.max(
          0,
          match.timeRemaining + data.deltaSeconds,
        ),
      },
    });

    this.server.to(`match-${data.matchId}`).emit('timerAdjusted', {
      timeRemaining: updated.timeRemaining,
      delta: data.deltaSeconds,
      message:
        data.deltaSeconds > 0
          ? `+${data.deltaSeconds} seconds added`
          : `${Math.abs(data.deltaSeconds)} seconds removed`,
    });

    this.server.to(`match-${data.matchId}`).emit('timerUpdate', {
      timeRemaining: updated.timeRemaining,
      isRunning: match.status === 'IN_PROGRESS',
    });
  }

  // ====================== SCORING ======================
  @SubscribeMessage('recordExchange')
  async recordExchange(@MessageBody() dto: any) {
    const result = await this.scoringService.recordExchange(dto.matchId, dto as CreateScoreDto);
    this.server.to(`match-${dto.matchId}`).emit('scoreUpdated', result);
    return result;
  }

  @SubscribeMessage('undoScore')
  async undoScore(@MessageBody() dto: { matchId: string; scoreEventId: string }) {
    const result = await this.scoringService.undoScore(dto.matchId, dto.scoreEventId);
    this.server.to(`match-${dto.matchId}`).emit('scoreUpdated', result);
    return result;
  }
}
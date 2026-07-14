import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTatamiDto } from './dto/create-tatami.dto/create-tatami.dto';
import { UpdateTatamiDto } from './dto/update-tatami.dto/update-tatami.dto';

@Injectable()
export class TatamiService {
  constructor(private prisma: PrismaService) {}

  async autoAssign(tournamentId: string) {
    const tatamis = await this.prisma.tatami.findMany({ where: { tournamentId } });
    if (!tatamis.length) throw new BadRequestException('No tatamis configured');

    const ready = await this.prisma.match.findMany({
      where: {
        tatamiId: null,
        status: 'SCHEDULED',
        redAthleteId: { not: null },
        blueAthleteId: { not: null },
        category: { tournamentId },
      },
      orderBy: { bracketSlot: 'asc' },
    });

    const load = await Promise.all(
      tatamis.map((t) =>
        this.prisma.match.count({
          where: { tatamiId: t.id, status: { in: ['SCHEDULED', 'IN_PROGRESS', 'PAUSED'] } },
        }),
      ),
    );

    for (const match of ready) {
      const i = load.indexOf(Math.min(...load));
      await this.prisma.match.update({ where: { id: match.id }, data: { tatamiId: tatamis[i].id } });
      load[i]++;
    }
    return { assigned: ready.length };
  }

  async getQueue(tatamiId: string, upcoming = 3) {
    const current = await this.prisma.match.findFirst({
      where: { tatamiId, status: { in: ['IN_PROGRESS', 'PAUSED'] } },
      include: { redAthlete: true, blueAthlete: true, category: true },
    });
    const next = await this.prisma.match.findMany({
      where: { tatamiId, status: 'SCHEDULED' },
      orderBy: { bracketSlot: 'asc' },
      take: upcoming,
      include: { redAthlete: true, blueAthlete: true, category: true },
    });
    return { current, next };
  }

  async create(dto: CreateTatamiDto) {
    // Check if tournament exists
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    // Check if tatami number already exists for this tournament
    const existing = await this.prisma.tatami.findUnique({
      where: {
        tournamentId_number: {
          tournamentId: dto.tournamentId,
          number: dto.number,
        },
      },
    });

    if (existing) {
      throw new BadRequestException(`Tatami number ${dto.number} already exists for this tournament`);
    }

    const tatami = await this.prisma.tatami.create({
      data: {
        tournamentId: dto.tournamentId,
        number: dto.number,
        name: dto.name || `Tatami ${dto.number}`,
      },
      include: {
        tournament: true,
      },
    });

    return { message: 'Tatami created successfully', tatami };
  }

  async findByTournament(tournamentId: string) {
    return this.prisma.tatami.findMany({
      where: { tournamentId },
      include: {
        matches: {
          include: {
            redAthlete: true,
            blueAthlete: true,
          },
        },
      },
      orderBy: { number: 'asc' },
    });
  }

  async update(id: string, dto: UpdateTatamiDto) {
    const tatami = await this.prisma.tatami.findUnique({ where: { id } });
    if (!tatami) throw new NotFoundException('Tatami not found');

    return this.prisma.tatami.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string) {
    const tatami = await this.prisma.tatami.findUnique({ where: { id } });
    if (!tatami) throw new NotFoundException('Tatami not found');

    await this.prisma.tatami.delete({ where: { id } });
    return { message: 'Tatami deleted successfully' };
  }

  async assignMatch(tatamiId: string, matchId: string) {
    const tatami = await this.prisma.tatami.findUnique({
      where: { id: tatamiId },
    });

    if (!tatami) {
      throw new NotFoundException('Tatami not found');
    }

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data: {
        tatamiId,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.tatami.findUnique({
      where: { id },
      include: {
        tournament: true,
        matches: {
          include: {
            redAthlete: true,
            blueAthlete: true,
            category: true,
          },
        },
      },
    });
  }

  async findAll() {
    return this.prisma.tatami.findMany({
      include: {
        tournament: true,
        matches: {
          where: {
            status: {
              in: ['SCHEDULED', 'IN_PROGRESS', 'PAUSED'],
            },
          },
          take: 1,
          include: {
            redAthlete: true,
            blueAthlete: true,
            category: true,
          },
        },
      },
      orderBy: {
        number: 'asc',
      },
    });
  }
}
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { CreateCategoryDto } from './dto/create-category.dto';


@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTournamentDto) {
    const tournament = await this.prisma.tournament.create({
      data: {
        name: dto.name,
        location: dto.location,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),

        organization: {
          connect: {
            id: dto.organizationId,
          },
        },
      },
      select: {
        id: true,
        name: true,
        location: true,
        startDate: true,
        endDate: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      message: "Tournament created successfully",
      tournament,
    };
  }

  async findAll() {
    return this.prisma.tournament.findMany({
      orderBy: { startDate: 'desc' },
      include: { _count: { select: { categories: true, tatamis: true } } },
    });
  }

  async findOne(id: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        categories: true,
        tatamis: true,
        _count: { select: { categories: true } },
      },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const matchesCount = await this.prisma.match.count({
      where: { category: { tournamentId: id } },
    });

    return { ...tournament, matchesCount };
  }

  async update(id: string, dto: UpdateTournamentDto) {
    await this.findOne(id); // throws if missing
    return this.prisma.tournament.update({
      where: { id },
      data: {
        ...dto,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.tournament.delete({ where: { id } });
  }

  // ----- Categories nested under a tournament -----

  async addCategory(tournamentId: string, dto: CreateCategoryDto) {
    await this.findOne(tournamentId);
    return this.prisma.category.create({
      data: { ...dto, tournamentId },
    });
  }

  async getCategories(tournamentId: string) {
    await this.findOne(tournamentId);
    return this.prisma.category.findMany({
      where: { tournamentId },
      include: { _count: { select: { athletes: true, matches: true } } },
    });
  }

  async removeCategory(tournamentId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, tournamentId },
    });
    if (!category) throw new NotFoundException('Category not found');
    return this.prisma.category.delete({ where: { id: categoryId } });
  }

  async getMatches(tournamentId: string) {
    await this.findOne(tournamentId);
    return this.prisma.match.findMany({
      where: { category: { tournamentId } },
      include: {
        redAthlete: true,
        blueAthlete: true,
        category: true,
        tatami: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAthletes(tournamentId: string) {
    await this.findOne(tournamentId);

    const entries = await this.prisma.categoryAthlete.findMany({
      where: { category: { tournamentId } },
      include: { athlete: true },
    });

    const byId = new Map<string, (typeof entries)[number]['athlete']>();
    for (const entry of entries) {
      if (!byId.has(entry.athleteId)) byId.set(entry.athleteId, entry.athlete);
    }

    return Array.from(byId.values());
  }
}
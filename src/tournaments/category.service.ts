import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Prisma, Gender, Discipline } from '@prisma/client';
import { RegisterAthleteDto } from './dto/register-athlete';
@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}
    async registerAthlete(
    categoryId: string,
    dto: RegisterAthleteDto,
  ) {
    // 1. Check category exists
    const category = await this.prisma.category.findUnique({
      where: {
        id: categoryId,
      },
    });

    if (!category) {
      throw new NotFoundException(
        `Category ${categoryId} not found`,
      );
    }

    // 2. Check athlete exists
    const athlete = await this.prisma.athlete.findUnique({
      where: {
        id: dto.athleteId,
      },
    });

    if (!athlete) {
      throw new NotFoundException(
        `Athlete ${dto.athleteId} not found`,
      );
    }

    // 3. Check athlete is not already registered
    const existingRegistration =
      await this.prisma.categoryAthlete.findUnique({
        where: {
          categoryId_athleteId: {
            categoryId,
            athleteId: dto.athleteId,
          },
        },
      });

    if (existingRegistration) {
      throw new BadRequestException(
        'Athlete is already registered in this category',
      );
    }

    // 4. Register athlete
    return this.prisma.categoryAthlete.create({
      data: {
        categoryId,
        athleteId: dto.athleteId,
        seed: dto.seed,
      },
      include: {
        athlete: true,
        category: true,
      },
    });
  }

  findAll(search?: string) {
    let where: Prisma.CategoryWhereInput = {};

    if (search) {
      const stringMatch: Prisma.CategoryWhereInput[] = [
        { name: { contains: search, mode: 'insensitive' } },
        { ageGroup: { contains: search, mode: 'insensitive' } },
      ];

      const genderValues = Object.values(Gender) as string[];
      if (genderValues.includes(search.toUpperCase())) {
        stringMatch.push({ gender: search.toUpperCase() as Gender });
      }

      const disciplineValues = Object.values(Discipline) as string[];
      if (disciplineValues.includes(search.toUpperCase())) {
        stringMatch.push({ discipline: search.toUpperCase() as Discipline });
      }

      where = { OR: stringMatch };
    }

    return this.prisma.category.findMany({
      where,
          include: {
      tournament: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          athletes: true,
          matches: true,
        },
      },
    },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { tournament: { select: { id: true, name: true } } },
    });

    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }

    return category;
  }

  // `routeTournamentId` is passed in by the nested
  // POST /tournaments/:id/categories route. The flat POST /categories
  // route passes undefined and relies on dto.tournamentId instead.
  create(dto: CreateCategoryDto, routeTournamentId?: string) {
    const { tournamentId: bodyTournamentId, ...rest } = dto;
    const tournamentId = routeTournamentId ?? bodyTournamentId;

    if (!tournamentId) {
      throw new BadRequestException('tournamentId is required');
    }

    return this.prisma.category.create({
      data: {
        ...rest,
        tournament: { connect: { id: tournamentId } },
      },
      include: { tournament: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);

    const { tournamentId, ...rest } = dto;

    return this.prisma.category.update({
      where: { id },
      data: {
        ...rest,
        ...(tournamentId && { tournament: { connect: { id: tournamentId } } }),
      },
      include: { tournament: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.category.delete({ where: { id } });
  }
}
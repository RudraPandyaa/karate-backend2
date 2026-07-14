import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { EnrollAthleteDto } from './dto/enroll-athlete.dto';

@Injectable()
export class AthletesService {
  constructor(private prisma: PrismaService) {}

  create(dto: CreateAthleteDto) {
    return this.prisma.athlete.create({
      data: {
        ...dto,
        country: dto.country ?? 'IND',
      },
    });
  }

  findAll(search?: string) {
    return this.prisma.athlete.findMany({
      where: search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { state: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      include: { _count: { select: { categories: true } } },
    });
  }

  async findOne(id: string) {
    const athlete = await this.prisma.athlete.findUnique({
      where: { id },
      include: {
        categories: {
          include: { category: true },
        },
      },
    });
    if (!athlete) throw new NotFoundException('Athlete not found');
    return athlete;
  }

  async update(id: string, dto: UpdateAthleteDto) {
    await this.findOne(id);
    return this.prisma.athlete.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.athlete.delete({ where: { id } });
  }

  // ----- Category enrollment -----

  async enroll(athleteId: string, dto: EnrollAthleteDto) {
    await this.findOne(athleteId);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
    });
    if (!category) throw new NotFoundException('Category not found');

    const existing = await this.prisma.categoryAthlete.findUnique({
      where: {
        categoryId_athleteId: {
          categoryId: dto.categoryId,
          athleteId,
        },
      },
    });
    if (existing) {
      throw new ConflictException('Athlete already enrolled in this category');
    }

    return this.prisma.categoryAthlete.create({
      data: {
        athleteId,
        categoryId: dto.categoryId,
        seed: dto.seed,
      },
      include: { category: true },
    });
  }

  async unenroll(athleteId: string, categoryId: string) {
    const enrollment = await this.prisma.categoryAthlete.findUnique({
      where: {
        categoryId_athleteId: { categoryId, athleteId },
      },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');

    return this.prisma.categoryAthlete.delete({
      where: { id: enrollment.id },
    });
  }

  getEnrollments(athleteId: string) {
    return this.prisma.categoryAthlete.findMany({
      where: { athleteId },
      include: { category: { include: { tournament: true } } },
    });
  }
}
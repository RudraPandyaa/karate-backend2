import { IsString, IsEnum, IsOptional, IsNumber, IsNotEmpty } from 'class-validator';
import { Discipline, Gender } from '@prisma/client';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  ageGroup: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsEnum(Discipline)
  discipline: Discipline;

  @IsOptional()
  @IsNumber()
  weightMin?: number;

  @IsOptional()
  @IsNumber()
  weightMax?: number;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  tournamentId?: string;
}
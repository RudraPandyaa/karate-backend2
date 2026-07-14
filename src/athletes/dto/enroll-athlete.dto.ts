import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class EnrollAthleteDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seed?: number;
}
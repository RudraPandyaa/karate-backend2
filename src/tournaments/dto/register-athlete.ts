import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RegisterAthleteDto {
  @IsString()
  @IsNotEmpty()
  athleteId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  seed?: number;
}
import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class GenerateBracketDto {
  @IsString()
  categoryId: string;

  @IsOptional()
  @IsBoolean()
  separateClubs?: boolean = false;
}

export class AssignMatchesToTatamiDto {
  @IsString()
  tatamiId: string;

  @IsString({ each: true })
  matchIds: string[];
}
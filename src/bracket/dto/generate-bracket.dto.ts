import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class GenerateBracketDto {
  @IsString()
  categoryId: string;

  // NOTE: currently unused by BracketService.generateBracket() —
  // same-club separation is not implemented in BracketGenerator yet.
  @IsOptional()
  @IsBoolean()
  separateClubs?: boolean = false;
}

export class AssignMatchesToTatamiDto {
  @IsString()
  tatamiId: string;

  @IsArray()
  @IsString({ each: true })
  matchIds: string[];
}
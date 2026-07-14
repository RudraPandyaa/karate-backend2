import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AthletesService } from './athletes.service';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { EnrollAthleteDto } from './dto/enroll-athlete.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Role } from '@prisma/client';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator'; 

@ApiTags('tournaments')
@ApiBearerAuth('JWT')  
@Controller('athletes')
export class AthletesController {
  constructor(private athletesService: AthletesService) {}

  @Public() 
  @Get()
  findAll(@Query('search') search?: string) {
    return this.athletesService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.athletesService.findOne(id);
  }

  @Get(':id/enrollments')
  getEnrollments(@Param('id') id: string) {
    return this.athletesService.getEnrollments(id);
  }

  // @UseGuards(RolesGuard)
  // @Roles(Role.ADMIN, Role.ORGANIZER, Role.SCOREKEEPER)
  @Post()
  create(@Body() dto: CreateAthleteDto) {
    return this.athletesService.create(dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER, Role.SCOREKEEPER)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateAthleteDto) {
    return this.athletesService.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.athletesService.remove(id);
  }

  // ----- Category enrollment -----

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER, Role.SCOREKEEPER)
  @Post(':id/enroll')
  enroll(@Param('id') id: string, @Body() dto: EnrollAthleteDto) {
    return this.athletesService.enroll(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.ORGANIZER)
  @Delete(':id/enroll/:categoryId')
  unenroll(
    @Param('id') id: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.athletesService.unenroll(id, categoryId);
  }
}
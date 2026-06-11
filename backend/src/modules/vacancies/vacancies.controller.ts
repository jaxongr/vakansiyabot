import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { VacanciesService } from './vacancies.service';
import { ListVacanciesDto } from './dto/list-vacancies.dto';
import { UpdateVacancyDto } from './dto/update-vacancy.dto';

@ApiTags('vacancies')
@ApiBearerAuth()
@Controller()
export class VacanciesController {
  constructor(private readonly vacancies: VacanciesService) {}

  @Get('vacancies')
  @ApiOperation({ summary: 'Vakansiyalar (cursor, filtr, full-text q)' })
  list(@Query() dto: ListVacanciesDto) {
    return this.vacancies.list(dto);
  }

  @Get('vacancies/:id')
  @ApiOperation({ summary: 'Vakansiya tafsiloti (manba kanallar bilan)' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.vacancies.detail(id);
  }

  @Patch('vacancies/:id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Moderatsiya: edit (guruh posti yangilanadi) / hide' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateVacancyDto) {
    return this.vacancies.update(id, dto);
  }

  @Get('me/saved')
  @ApiOperation({ summary: 'Saqlangan vakansiyalar' })
  saved(@CurrentUser() user: JwtPayload) {
    return this.vacancies.savedList(user.sub);
  }

  @Post('me/saved/:vacancyId')
  @ApiOperation({ summary: 'Vakansiyani saqlash' })
  save(@CurrentUser() user: JwtPayload, @Param('vacancyId', ParseUUIDPipe) vacancyId: string) {
    return this.vacancies.save(user.sub, vacancyId);
  }

  @Delete('me/saved/:vacancyId')
  @ApiOperation({ summary: 'Saqlanganlardan olib tashlash' })
  unsave(@CurrentUser() user: JwtPayload, @Param('vacancyId', ParseUUIDPipe) vacancyId: string) {
    return this.vacancies.unsave(user.sub, vacancyId);
  }
}

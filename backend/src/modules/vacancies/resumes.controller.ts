import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ResumesService } from './resumes.service';
import { ListVacanciesDto } from './dto/list-vacancies.dto';

@ApiTags('resumes')
@ApiBearerAuth()
@Controller('resumes')
export class ResumesController {
  constructor(private readonly resumes: ResumesService) {}

  @Get()
  @ApiOperation({ summary: 'Rezyumelar — ish izlovchilar (cursor, filtr)' })
  list(@Query() dto: ListVacanciesDto) {
    return this.resumes.list(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Rezyume tafsiloti' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.resumes.detail(id);
  }
}

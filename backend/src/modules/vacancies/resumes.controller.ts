import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
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
  @ApiOperation({ summary: 'Rezyume tafsiloti (kontakt — Pro obuna uchun)' })
  detail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    return this.resumes.detail(id, user.sub, user.role);
  }
}

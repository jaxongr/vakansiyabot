import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../redis/cache.service';
import { Public } from '../../common/decorators/public.decorator';

const TTL = 86_400;

@ApiTags('refs')
@Public()
@Controller()
export class RefsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  @Get('regions')
  @ApiOperation({ summary: 'Viloyatlar (special: remote/other/resumes flagi bilan)' })
  async regions() {
    const cached = await this.cache.get<object[]>('regions:all');
    if (cached) return cached;
    const regions = await this.prisma.region.findMany({
      where: { code: { not: 'resumes' } },
      select: { id: true, code: true, nameUz: true, nameCyr: true, special: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });
    await this.cache.set('regions:all', regions, TTL);
    return regions;
  }

  @Get('categories')
  @ApiOperation({ summary: 'Kategoriyalar' })
  async categories() {
    const cached = await this.cache.get<object[]>('categories:all');
    if (cached) return cached;
    const categories = await this.prisma.category.findMany({
      select: { id: true, code: true, nameUz: true, sortOrder: true },
      orderBy: { sortOrder: 'asc' },
    });
    await this.cache.set('categories:all', categories, TTL);
    return categories;
  }
}

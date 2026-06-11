import { Injectable } from '@nestjs/common';
import { WebSource, WebSourceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { buildCursorPage } from '../../common/pagination/cursor';
import { CreateWebSourceDto } from './dto/create-web-source.dto';
import { ScraperService } from './scraper.service';

@Injectable()
export class WebSourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scraper: ScraperService,
  ) {}

  async create(dto: CreateWebSourceDto): Promise<WebSource> {
    const existing = await this.prisma.webSource.findFirst({
      where: { url: dto.url, deletedAt: null },
    });
    if (existing) {
      throw AppException.conflict('E1004' as never, 'Bu URL allaqachon qo`shilgan');
    }
    const source = await this.prisma.webSource.create({
      data: {
        type: dto.type,
        name: dto.name,
        url: dto.url,
        intervalMin: dto.intervalMin ?? 30,
      },
    });
    // darhol bir marta skanerlaymiz (kutib turmasdan, fonda)
    void this.scraper.scrapeOne(source);
    return source;
  }

  async list(cursor?: string, limit = 20) {
    const rows = await this.prisma.webSource.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    return buildCursorPage(rows, limit);
  }

  async setStatus(id: string, status: WebSourceStatus): Promise<WebSource> {
    await this.findOrThrow(id);
    return this.prisma.webSource.update({ where: { id }, data: { status } });
  }

  async remove(id: string): Promise<void> {
    await this.findOrThrow(id);
    await this.prisma.webSource.update({
      where: { id },
      data: { deletedAt: new Date(), status: WebSourceStatus.PAUSED },
    });
  }

  async triggerNow(id: string): Promise<{ created: number }> {
    const source = await this.findOrThrow(id);
    const created = await this.scraper.scrapeOne(source);
    return { created };
  }

  private async findOrThrow(id: string): Promise<WebSource> {
    const source = await this.prisma.webSource.findFirst({ where: { id, deletedAt: null } });
    if (!source) throw AppException.notFound('Manba topilmadi');
    return source;
  }
}

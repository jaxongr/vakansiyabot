import { Injectable } from '@nestjs/common';
import { Prisma, Role, VacancyStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from '../billing/billing.service';
import { AppException } from '../../common/errors/app.exception';
import { buildCursorPage } from '../../common/pagination/cursor';
import { ListVacanciesDto } from './dto/list-vacancies.dto';

const RESUME_SELECT = {
  id: true,
  fullName: true,
  age: true,
  title: true,
  experienceYears: true,
  skills: true,
  salaryExpectation: true,
  currency: true,
  status: true,
  origin: true,
  createdAt: true,
  region: { select: { id: true, code: true, nameUz: true } },
  category: { select: { id: true, code: true, nameUz: true } },
} satisfies Prisma.ResumeSelect;

/** Ish beruvchilar uchun rezyumelar ro'yxati */
@Injectable()
export class ResumesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly billing: BillingService,
  ) {}

  async list(dto: ListVacanciesDto) {
    const limit = dto.limit ?? 20;
    const rows = await this.prisma.resume.findMany({
      where: {
        status: VacancyStatus.ACTIVE,
        deletedAt: null,
        ...(dto.regionId ? { regionId: dto.regionId } : {}),
        ...(dto.categoryId ? { categoryId: dto.categoryId } : {}),
        ...(dto.q
          ? {
              OR: [
                { title: { contains: dto.q, mode: 'insensitive' } },
                { about: { contains: dto.q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: RESUME_SELECT,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(dto.cursor ? { cursor: { id: dto.cursor }, skip: 1 } : {}),
    });
    return buildCursorPage(rows, limit);
  }

  /**
   * Rezyume tafsiloti. Kontakt (telefon/tg) faqat Pro obunaga ega ish
   * beruvchilarga (yoki adminga) ochiq — hh.uz modeli.
   */
  async detail(id: string, userId: string, role: Role) {
    const resume = await this.prisma.resume.findFirst({
      where: { id, deletedAt: null },
      include: {
        region: { select: { id: true, code: true, nameUz: true } },
        category: { select: { id: true, code: true, nameUz: true } },
      },
    });
    if (!resume) throw AppException.notFound('Rezyume topilmadi');

    const hasAccess = role === Role.ADMIN || (await this.billing.hasResumeAccess(userId));
    if (hasAccess) {
      return { ...resume, contactLocked: false };
    }
    // kontaktni yashiramiz, Pro taklif qilamiz
    return {
      ...resume,
      phones: [],
      tgContact: null,
      contactLocked: true,
      lockMessage: "Kontaktni ko'rish uchun Employer Pro obunasi kerak",
    };
  }
}

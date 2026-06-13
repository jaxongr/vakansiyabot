import { Injectable, Logger } from '@nestjs/common';
import { ApplicationStatus, Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../../common/errors/app.exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { SmsService } from '../sms/sms.service';
import { BotService } from '../publisher/bot.service';

export interface ApplyInput {
  vacancyId: string;
  resumeId?: string;
  phone?: string;
  coverNote?: string;
}

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsService,
    private readonly bot: BotService,
  ) {}

  /** Ish izlovchi vakansiyaga ariza topshiradi */
  async apply(userId: string, input: ApplyInput) {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: input.vacancyId, deletedAt: null, status: 'ACTIVE' },
      include: { submittedBy: true },
    });
    if (!vacancy) throw AppException.notFound('Vakansiya topilmadi yoki faol emas');

    // rezyume biriktirilsa — egasi shu user ekanini tekshiramiz (yoki ixtiyoriy)
    if (input.resumeId) {
      const resume = await this.prisma.resume.findFirst({
        where: { id: input.resumeId, deletedAt: null },
      });
      if (!resume) throw AppException.notFound('Rezyume topilmadi');
    }

    try {
      const application = await this.prisma.application.create({
        data: {
          vacancyId: input.vacancyId,
          applicantId: userId,
          resumeId: input.resumeId,
          phone: input.phone,
          coverNote: input.coverNote?.slice(0, 1000),
        },
        select: { id: true },
      });

      await this.notifyEmployer(vacancy.id, vacancy.title, vacancy.submittedBy?.tgUserId ?? null);
      return { id: application.id, applied: true };
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        throw AppException.conflict(
          ErrorCode.CONFLICT,
          "Siz bu vakansiyaga allaqachon ariza topshirgansiz",
        );
      }
      throw error;
    }
  }

  /** Ariza kelganda ish beruvchiga bot xabar (bot orqali joylagan bo'lsa) */
  private async notifyEmployer(
    vacancyId: string,
    title: string,
    employerTgId: bigint | null,
  ): Promise<void> {
    const count = await this.prisma.application.count({ where: { vacancyId } });
    if (employerTgId && this.bot.instance) {
      try {
        await this.bot.instance.api.sendMessage(
          Number(employerTgId),
          `📩 "<b>${this.esc(title)}</b>" e'loningizga yangi ariza keldi!\n` +
            `Jami arizalar: ${count}. Botda "💎 E'lonlarim" orqali ko'ring.`,
          { parse_mode: 'HTML' },
        );
      } catch (e) {
        this.logger.warn(`Employer notify failed: ${(e as Error).message}`);
      }
    }
  }

  /** Ish izlovchi: men topshirgan arizalar */
  async myApplications(userId: string) {
    const apps = await this.prisma.application.findMany({
      where: { applicantId: userId },
      include: {
        vacancy: { select: { id: true, title: true, region: { select: { nameUz: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return apps.map((a) => ({
      id: a.id,
      status: a.status,
      createdAt: a.createdAt,
      vacancy: { id: a.vacancy.id, title: a.vacancy.title, region: a.vacancy.region.nameUz },
    }));
  }

  /** Ish beruvchi: vakansiyaga kelgan arizalar (faqat egasi yoki admin) */
  async applicationsForVacancy(vacancyId: string, userId: string, role: Role) {
    const vacancy = await this.prisma.vacancy.findFirst({
      where: { id: vacancyId, deletedAt: null },
    });
    if (!vacancy) throw AppException.notFound('Vakansiya topilmadi');
    if (role !== Role.ADMIN && vacancy.submittedById !== userId) {
      throw AppException.forbidden('Bu vakansiya sizniki emas');
    }

    const apps = await this.prisma.application.findMany({
      where: { vacancyId },
      include: {
        applicant: { select: { firstName: true, username: true } },
        resume: {
          select: {
            id: true,
            fullName: true,
            title: true,
            experienceYears: true,
            phones: true,
            tgContact: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return apps;
  }

  /** Ariza holatini o'zgartirish (ish beruvchi/admin) */
  async setStatus(applicationId: string, userId: string, role: Role, status: ApplicationStatus) {
    const app = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: { vacancy: { select: { submittedById: true } } },
    });
    if (!app) throw AppException.notFound('Ariza topilmadi');
    if (role !== Role.ADMIN && app.vacancy.submittedById !== userId) {
      throw AppException.forbidden('Ruxsat yo`q');
    }
    return this.prisma.application.update({ where: { id: applicationId }, data: { status } });
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}

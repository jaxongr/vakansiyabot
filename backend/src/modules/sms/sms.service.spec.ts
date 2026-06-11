import { SmsProvider, SmsStatus } from '@prisma/client';
import { SmsService } from './sms.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SystemStatusService } from '../system/system-status.service';
import { EskizAdapter } from './adapters/eskiz.adapter';
import { PlayMobileAdapter } from './adapters/playmobile.adapter';

describe('SmsService', () => {
  let service: SmsService;
  const prisma = {
    smsSetting: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    smsLog: { create: jest.fn(), findMany: jest.fn() },
  };
  const eskiz = { provider: 'ESKIZ', ensureToken: jest.fn(), send: jest.fn(), balance: jest.fn() };
  const playmobile = { provider: 'PLAYMOBILE', send: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SmsService(
      prisma as unknown as PrismaService,
      new SystemStatusService(),
      eskiz as unknown as EskizAdapter,
      playmobile as unknown as PlayMobileAdapter,
    );
  });

  const settings = (over: Record<string, unknown> = {}) => ({
    id: 's1',
    provider: SmsProvider.ESKIZ,
    enabled: true,
    login: 'a@b.uz',
    password: 'pw',
    token: 'tok',
    tokenExpiry: new Date(Date.now() + 10 * 24 * 3600_000),
    sender: '4546',
    baseUrl: null,
    balance: null,
    notifyOnPublish: false,
    ...over,
  });

  it('o`chirilgan bo`lsa yubormaydi', async () => {
    prisma.smsSetting.findFirst.mockResolvedValue(settings({ enabled: false }));
    const res = await service.send('998901234567', 'salom');
    expect(res.ok).toBe(false);
    expect(eskiz.send).not.toHaveBeenCalled();
  });

  it('Eskiz orqali yuboradi va SENT jurnaliga yozadi', async () => {
    prisma.smsSetting.findFirst.mockResolvedValue(settings());
    eskiz.ensureToken.mockResolvedValue(null); // token amalda
    eskiz.send.mockResolvedValue({ ok: true, providerMessageId: 'm1' });

    const res = await service.send('998901234567', 'salom');

    expect(res.ok).toBe(true);
    expect(prisma.smsLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: SmsStatus.SENT }) }),
    );
  });

  it('token eskirgan bo`lsa yangilaydi', async () => {
    prisma.smsSetting.findFirst.mockResolvedValue(settings({ token: null }));
    eskiz.ensureToken.mockResolvedValue({ token: 'new', expiry: new Date() });
    prisma.smsSetting.update.mockResolvedValue(settings({ token: 'new' }));
    eskiz.send.mockResolvedValue({ ok: true });

    await service.send('998901234567', 'salom');

    expect(prisma.smsSetting.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ token: 'new' }) }),
    );
  });

  it('yuborish xatosi -> FAILED jurnal', async () => {
    prisma.smsSetting.findFirst.mockResolvedValue(settings());
    eskiz.ensureToken.mockResolvedValue(null);
    eskiz.send.mockResolvedValue({ ok: false, error: 'balans yetarli emas' });

    const res = await service.send('998901234567', 'salom');

    expect(res.ok).toBe(false);
    expect(prisma.smsLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: SmsStatus.FAILED }) }),
    );
  });

  it('login o`zgarsa keshlangan token bekor qilinadi', async () => {
    prisma.smsSetting.findFirst.mockResolvedValue(settings());
    prisma.smsSetting.update.mockResolvedValue(settings());

    await service.updateSettings({ login: 'yangi@b.uz' });

    expect(prisma.smsSetting.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ token: null, tokenExpiry: null }),
      }),
    );
  });

  it('PlayMobile provideri tanlanadi', async () => {
    prisma.smsSetting.findFirst.mockResolvedValue(settings({ provider: SmsProvider.PLAYMOBILE }));
    playmobile.send.mockResolvedValue({ ok: true });

    await service.send('998901234567', 'salom');

    expect(playmobile.send).toHaveBeenCalled();
    expect(eskiz.send).not.toHaveBeenCalled();
  });
});

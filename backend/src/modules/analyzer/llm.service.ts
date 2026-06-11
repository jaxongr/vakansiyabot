import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ExtractedVacancy } from '../../queues/queue.types';
import { REGION_CODES } from './dictionaries/cities';
import { CATEGORIES } from './dictionaries/categories';

const llmResponseSchema = z.object({
  kind: z.enum(['VACANCY', 'RESUME', 'OTHER']),
  title: z.string().min(1).max(120).optional(),
  company: z.string().max(120).optional().nullable(),
  regionCode: z.string().optional(),
  district: z.string().max(80).optional().nullable(),
  categoryCode: z.string().optional(),
  salaryMin: z.number().int().positive().optional().nullable(),
  salaryMax: z.number().int().positive().optional().nullable(),
  currency: z.enum(['UZS', 'USD']).optional(),
  employmentType: z.enum(['FULL_TIME', 'PART_TIME', 'REMOTE', 'SHIFT']).optional(),
  phones: z.array(z.string()).optional(),
  tgContact: z.string().optional().nullable(),
  resume: z
    .object({
      fullName: z.string().max(120).optional().nullable(),
      age: z.number().int().min(14).max(70).optional().nullable(),
      experienceYears: z.number().int().min(0).max(50).optional().nullable(),
      experience: z.string().max(2000).optional().nullable(),
      education: z.string().max(500).optional().nullable(),
      skills: z.array(z.string().max(60)).optional(),
      salaryExpectation: z.number().int().positive().optional().nullable(),
    })
    .optional()
    .nullable(),
});

const VALID_REGION_CODES = new Set(Object.values(REGION_CODES));
const VALID_CATEGORY_CODES = new Set(CATEGORIES.map((c) => c.code));

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly client: Anthropic | null;
  private readonly model: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('ANTHROPIC_API_KEY');
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
    this.model = config.get<string>('LLM_MODEL', 'claude-haiku-4-5-20251001');
  }

  get isEnabled(): boolean {
    return this.client !== null;
  }

  /**
   * Rules to'liq aniqlay olmagan postni LLM bilan tahlil qiladi.
   * Qat'iy JSON, zod validate, 1 retry. Muvaffaqiyatsiz -> null (DLQ caller'da).
   */
  async extract(text: string, rulesDraft: ExtractedVacancy): Promise<ExtractedVacancy | null> {
    if (!this.client) return null;

    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const raw = await this.callModel(text);
        const parsed = llmResponseSchema.parse(raw);
        return this.mergeWithDraft(parsed, rulesDraft, text);
      } catch (error) {
        this.logger.warn(`LLM extract attempt ${attempt} failed: ${(error as Error).message}`);
      }
    }
    return null;
  }

  private async callModel(text: string): Promise<unknown> {
    const client = this.client;
    if (!client) throw new Error('LLM disabled');

    const response = await client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: this.systemPrompt(),
      messages: [{ role: 'user', content: text.slice(0, 6000) }],
    });

    const block = response.content.find((b) => b.type === 'text');
    if (!block || block.type !== 'text') throw new Error('LLM returned no text');
    const jsonText = block.text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    return JSON.parse(jsonText);
  }

  private systemPrompt(): string {
    return [
      'Sen Telegram postlarini tahlil qiluvchi ekstraktorsan. Faqat JSON qaytar, boshqa hech narsa yozma.',
      '',
      'Post turini aniqla:',
      '- "VACANCY" — ish beruvchi xodim izlayapti',
      '- "RESUME" — odam o\'ziga ish izlayapti ("ish izlayman", "ish kerak", rezyume)',
      '- "OTHER" — reklama, yangilik, so\'rov, kanal posti (ish e\'loni EMAS)',
      '',
      `regionCode quyidagilardan biri: ${[...VALID_REGION_CODES].join(', ')}`,
      `categoryCode quyidagilardan biri: ${[...VALID_CATEGORY_CODES].join(', ')}`,
      '',
      'JSON sxema:',
      '{"kind":"VACANCY|RESUME|OTHER","title":"qisqa lavozim nomi","company":null,',
      '"regionCode":"...","district":null,"categoryCode":"...",',
      '"salaryMin":null,"salaryMax":null,"currency":"UZS|USD",',
      '"employmentType":"FULL_TIME|PART_TIME|REMOTE|SHIFT",',
      '"phones":["998901234567"],"tgContact":"@username",',
      '"resume":{"fullName":null,"age":null,"experienceYears":null,"experience":null,"education":null,"skills":[],"salaryExpectation":null}}',
      '',
      'kind=OTHER bo\'lsa qolgan maydonlar shart emas. resume faqat kind=RESUME uchun.',
      'Telefonlarni 998XXXXXXXXX formatda qaytar. Aniqlay olmagan maydonga null qo\'y.',
    ].join('\n');
  }

  private mergeWithDraft(
    llm: z.infer<typeof llmResponseSchema>,
    draft: ExtractedVacancy,
    text: string,
  ): ExtractedVacancy {
    const regionCode =
      llm.regionCode && VALID_REGION_CODES.has(llm.regionCode as never)
        ? llm.regionCode
        : draft.regionCode;
    const categoryCode =
      llm.categoryCode && VALID_CATEGORY_CODES.has(llm.categoryCode)
        ? llm.categoryCode
        : draft.categoryCode;

    return {
      kind: llm.kind,
      title: llm.title ?? draft.title,
      description: text.trim(),
      company: llm.company ?? draft.company,
      regionCode,
      district: llm.district ?? draft.district,
      categoryCode,
      salaryMin: llm.salaryMin ?? draft.salaryMin,
      salaryMax: llm.salaryMax ?? draft.salaryMax,
      currency: llm.currency ?? draft.currency,
      employmentType: llm.employmentType ?? draft.employmentType,
      phones: llm.phones && llm.phones.length > 0 ? llm.phones : draft.phones,
      tgContact: llm.tgContact ?? draft.tgContact,
      resume:
        llm.kind === 'RESUME'
          ? {
              fullName: llm.resume?.fullName ?? draft.resume?.fullName,
              age: llm.resume?.age ?? draft.resume?.age,
              experienceYears: llm.resume?.experienceYears ?? draft.resume?.experienceYears,
              experience: llm.resume?.experience ?? undefined,
              education: llm.resume?.education ?? undefined,
              skills: llm.resume?.skills ?? [],
              salaryExpectation: llm.resume?.salaryExpectation ?? undefined,
            }
          : undefined,
    };
  }
}

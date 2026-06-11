import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../redis/redis.constants';

export type IntakeFlow = 'vacancy' | 'resume';

export interface IntakeDraft {
  title?: string;
  company?: string;
  regionCode?: string;
  categoryCode?: string;
  salaryMin?: number;
  salaryMax?: number;
  currency?: 'UZS' | 'USD';
  employmentType?: 'FULL_TIME' | 'PART_TIME' | 'REMOTE' | 'SHIFT';
  description?: string;
  phones?: string[];
  // resume maydonlari
  fullName?: string;
  age?: number;
  experienceYears?: number;
  skills?: string[];
  education?: string;
  salaryExpectation?: number;
  about?: string;
}

export interface IntakeState {
  flow: IntakeFlow;
  step: string;
  draft: IntakeDraft;
}

const TTL_SECONDS = 1800; // 30 daqiqa

@Injectable()
export class IntakeStateService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private key(tgUserId: number): string {
    return `intake:${tgUserId}`;
  }

  async get(tgUserId: number): Promise<IntakeState | null> {
    const raw = await this.redis.get(this.key(tgUserId));
    return raw ? (JSON.parse(raw) as IntakeState) : null;
  }

  async set(tgUserId: number, state: IntakeState): Promise<void> {
    await this.redis.set(this.key(tgUserId), JSON.stringify(state), 'EX', TTL_SECONDS);
  }

  async clear(tgUserId: number): Promise<void> {
    await this.redis.del(this.key(tgUserId));
  }
}

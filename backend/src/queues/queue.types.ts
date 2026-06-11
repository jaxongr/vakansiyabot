/** BullMQ queue nomlari va job payload tiplari — bitta manba */

export const ANALYZE_QUEUE = 'analyze';
export const DEDUP_QUEUE = 'dedup';
export const PUBLISH_QUEUE = 'publish';

export interface AnalyzeJobData {
  rawPostId: string;
}

export interface DedupJobData {
  rawPostId: string;
  /** rules/llm chiqargan strukturali ma'lumot */
  extracted: ExtractedVacancy;
}

export interface PublishJobData {
  /** Vakansiya yoki rezyume — bittasi to'ldiriladi */
  vacancyId?: string;
  resumeId?: string;
  action: 'create' | 'edit' | 'delete';
}

export interface ExtractedVacancy {
  kind: 'VACANCY' | 'RESUME' | 'OTHER';
  title: string;
  description: string;
  company?: string;
  regionCode: string;
  district?: string;
  categoryCode: string;
  salaryMin?: number;
  salaryMax?: number;
  currency: 'UZS' | 'USD';
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'REMOTE' | 'SHIFT';
  phones: string[];
  tgContact?: string;
  /** RESUME uchun qo'shimcha maydonlar */
  resume?: {
    fullName?: string;
    age?: number;
    experienceYears?: number;
    experience?: string;
    education?: string;
    skills?: string[];
    salaryExpectation?: number;
  };
}

export interface Region {
  id: string;
  code: string;
  nameUz: string;
  nameCyr: string;
  special: boolean;
  sortOrder: number;
}

export interface Category {
  id: string;
  code: string;
  nameUz: string;
  sortOrder: number;
}

export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'REMOTE' | 'SHIFT';

export interface VacancyListItem {
  id: string;
  title: string;
  company: string | null;
  district: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: 'UZS' | 'USD';
  employmentType: EmploymentType;
  origin: 'CHANNEL' | 'BOT' | 'WEB';
  featured?: boolean;
  createdAt: string;
  region: { id: string; code: string; nameUz: string };
  category: { id: string; code: string; nameUz: string };
}

export interface VacancySource {
  origin: string;
  channelTitle: string;
  channelUsername: string | null;
  externalUrl: string | null;
  postedAt: string;
}

export interface VacancyDetail extends VacancyListItem {
  description: string;
  phones: string[];
  tgContact: string | null;
  sources: VacancySource[];
}

export interface ResumeListItem {
  id: string;
  fullName: string;
  age: number | null;
  title: string;
  experienceYears: number | null;
  skills: string[];
  salaryExpectation: number | null;
  currency: 'UZS' | 'USD';
  createdAt: string;
  region: { id: string; code: string; nameUz: string };
  category: { id: string; code: string; nameUz: string };
}

export interface ResumeDetail extends ResumeListItem {
  about: string;
  education: string | null;
  experience: string | null;
  phones: string[];
  tgContact: string | null;
  contactLocked?: boolean;
  lockMessage?: string;
}

export interface Page<T> {
  data: T[];
  meta: { nextCursor: string | null; limit: number };
}

export interface Me {
  id: string;
  tgUserId: string;
  username: string | null;
  firstName: string | null;
  regionId: string | null;
  role: 'USER' | 'ADMIN';
  region: { id: string; code: string; nameUz: string } | null;
}

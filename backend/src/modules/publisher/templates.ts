import { Currency, EmploymentType } from '@prisma/client';

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: "To'liq stavka",
  PART_TIME: 'Yarim stavka',
  REMOTE: 'Masofaviy',
  SHIFT: 'Smenali',
};

const MAX_DESCRIPTION = 400;

export interface VacancyTemplateData {
  id: string;
  title: string;
  description: string;
  company?: string | null;
  regionName: string;
  district?: string | null;
  salaryMin?: number | null;
  salaryMax?: number | null;
  currency: Currency;
  employmentType: EmploymentType;
  phones: string[];
  tgContact?: string | null;
  sourceChannels: string[];
}

export interface ResumeTemplateData {
  id: string;
  fullName: string;
  age?: number | null;
  title: string;
  about: string;
  regionName: string;
  experienceYears?: number | null;
  education?: string | null;
  skills: string[];
  salaryExpectation?: number | null;
  currency: Currency;
  phones: string[];
  tgContact?: string | null;
}

function esc(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function truncate(text: string, max = MAX_DESCRIPTION): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function formatSalary(
  min?: number | null,
  max?: number | null,
  currency: Currency = Currency.UZS,
): string {
  const unit = currency === Currency.USD ? '$' : "so'm";
  const fmt = (n: number) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (min && max && min !== max) return `${fmt(min)}–${fmt(max)} ${unit}`;
  if (min) return `${fmt(min)} ${unit}`;
  return 'Kelishilgan';
}

export function vacancyHtml(v: VacancyTemplateData): string {
  const lines: string[] = [];
  lines.push(`💼 <b>${esc(v.title)}</b>`);
  if (v.company) lines.push(`🏢 ${esc(v.company)}`);
  lines.push(
    `💰 ${formatSalary(v.salaryMin, v.salaryMax, v.currency)} | 🕘 ${EMPLOYMENT_LABELS[v.employmentType]}`,
  );
  lines.push(`📍 ${esc(v.regionName)}${v.district ? `, ${esc(v.district)}` : ''}`);
  lines.push('');
  lines.push(esc(truncate(v.description)));
  lines.push('');

  const contacts: string[] = [];
  if (v.phones.length > 0) contacts.push(`📞 ${v.phones.map((p) => `+${p}`).join(', ')}`);
  if (v.tgContact) contacts.push(`✈️ ${esc(v.tgContact)}`);
  if (contacts.length > 0) lines.push(contacts.join(' | '));

  if (v.sourceChannels.length > 0) {
    lines.push(`📡 Manba: ${v.sourceChannels.map(esc).join(', ')}`);
  }

  return lines.join('\n');
}

export function resumeHtml(r: ResumeTemplateData): string {
  const lines: string[] = [];
  lines.push(`👤 <b>${esc(r.fullName)}</b>${r.age ? `, ${r.age} yosh` : ''}`);
  lines.push(`🔎 <b>${esc(r.title)}</b> lavozimini izlayapti`);
  lines.push(`📍 ${esc(r.regionName)}`);
  if (r.experienceYears) lines.push(`🛠 Tajriba: ${r.experienceYears} yil`);
  if (r.education) lines.push(`🎓 ${esc(r.education)}`);
  if (r.skills.length > 0) lines.push(`⚡ ${r.skills.map(esc).join(', ')}`);
  if (r.salaryExpectation) {
    lines.push(`💰 Kutilayotgan maosh: ${formatSalary(r.salaryExpectation, null, r.currency)}`);
  }
  lines.push('');
  lines.push(esc(truncate(r.about)));
  lines.push('');

  const contacts: string[] = [];
  if (r.phones.length > 0) contacts.push(`📞 ${r.phones.map((p) => `+${p}`).join(', ')}`);
  if (r.tgContact) contacts.push(`✈️ ${esc(r.tgContact)}`);
  if (contacts.length > 0) lines.push(contacts.join(' | '));

  return lines.join('\n');
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  useCategories,
  useRegions,
  useResumes,
  useSaveSearch,
  useVacancies,
  VacancyFilters,
} from '../api/hooks';
import { VacancyCard } from '../components/VacancyCard';
import { ResumeCard } from '../components/ResumeCard';
import { Button, Center, Screen, Spinner } from '../components/ui';
import { css } from '../theme';

const Top = styled.div`
  position: sticky;
  top: 0;
  z-index: 10;
  background: ${css.bg};
  padding: 12px 12px 8px;
  border-bottom: 1px solid color-mix(in srgb, ${css.hint} 15%, transparent);
`;
const Search = styled.input`
  width: 100%;
  box-sizing: border-box;
  border: 1px solid color-mix(in srgb, ${css.hint} 25%, transparent);
  background: ${css.secondaryBg};
  color: ${css.text};
  border-radius: 12px;
  padding: 11px 14px;
  font-size: 15px;
  font-family: inherit;
  outline: none;
  &::placeholder {
    color: ${css.hint};
  }
`;
const Filters = styled.div`
  display: flex;
  gap: 8px;
  margin-top: 8px;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;
const Select = styled.select`
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, ${css.hint} 25%, transparent);
  background: ${css.bg};
  color: ${css.text};
  border-radius: 10px;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  outline: none;
`;
const Tabs = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
`;
const Tab = styled.button<{ $active: boolean }>`
  flex: 1;
  border: none;
  border-radius: 10px;
  padding: 9px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  background: ${(p) => (p.$active ? css.button : css.secondaryBg)};
  color: ${(p) => (p.$active ? css.buttonText : css.text)};
`;
const SaveSearchBtn = styled.button`
  flex-shrink: 0;
  border: 1px solid ${css.button};
  background: ${css.bg};
  color: ${css.button};
  border-radius: 10px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
`;
const SavedLink = styled.button`
  position: fixed;
  bottom: 18px;
  right: 16px;
  z-index: 20;
  border: none;
  background: ${css.button};
  color: ${css.buttonText};
  border-radius: 28px;
  padding: 12px 18px;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  box-shadow: 0 4px 14px rgba(107, 70, 193, 0.35);
  cursor: pointer;
`;

export function Home() {
  const navigate = useNavigate();
  const { data: regions } = useRegions();
  const { data: categories } = useCategories();

  const [tab, setTab] = useState<'vacancies' | 'resumes'>('vacancies');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [regionId, setRegionId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [employmentType, setEmploymentType] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const filters: VacancyFilters = useMemo(
    () => ({
      q: debouncedQ || undefined,
      regionId: regionId || undefined,
      categoryId: categoryId || undefined,
      employmentType: employmentType || undefined,
    }),
    [debouncedQ, regionId, categoryId, employmentType],
  );

  const saveSearch = useSaveSearch();
  const vacanciesQuery = useVacancies(filters);
  const resumesQuery = useResumes(filters);
  const active = tab === 'vacancies' ? vacanciesQuery : resumesQuery;
  const { isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = active;

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage();
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const vacancyItems = vacanciesQuery.data?.pages.flatMap((p) => p.data) ?? [];
  const resumeItems = resumesQuery.data?.pages.flatMap((p) => p.data) ?? [];
  const count = tab === 'vacancies' ? vacancyItems.length : resumeItems.length;

  return (
    <Screen>
      <Top>
        <Tabs>
          <Tab $active={tab === 'vacancies'} onClick={() => setTab('vacancies')}>
            💼 Vakansiyalar
          </Tab>
          <Tab $active={tab === 'resumes'} onClick={() => setTab('resumes')}>
            👤 Rezyumelar
          </Tab>
        </Tabs>
        <Search
          placeholder="🔍 Kasb, lavozim qidirish..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Filters>
          <Select value={regionId} onChange={(e) => setRegionId(e.target.value)}>
            <option value="">Barcha viloyatlar</option>
            {regions?.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nameUz}
              </option>
            ))}
          </Select>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Barcha yo'nalishlar</option>
            {categories?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nameUz}
              </option>
            ))}
          </Select>
          <Select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
            <option value="">Ish turi</option>
            <option value="FULL_TIME">To'liq</option>
            <option value="PART_TIME">Yarim stavka</option>
            <option value="REMOTE">Masofaviy</option>
            <option value="SHIFT">Smenali</option>
          </Select>
          {tab === 'vacancies' && (regionId || categoryId || employmentType || debouncedQ) && (
            <SaveSearchBtn
              onClick={async () => {
                try {
                  await saveSearch.mutateAsync({
                    regionId: regionId || undefined,
                    categoryId: categoryId || undefined,
                    employmentType: employmentType || undefined,
                    q: debouncedQ || undefined,
                  });
                  alert("🔔 Qidiruv saqlandi! Mos vakansiya chiqsa botda xabar olasiz.");
                } catch {
                  alert('Saqlashda xatolik');
                }
              }}
            >
              🔔 Saqlash
            </SaveSearchBtn>
          )}
        </Filters>
      </Top>

      {isLoading && <Spinner />}
      {isError && (
        <Center>
          <span>😕 Ma'lumotlarni yuklab bo'lmadi</span>
          <Button $variant="ghost" onClick={() => window.location.reload()}>
            Qayta yuklash
          </Button>
        </Center>
      )}
      {!isLoading && !isError && count === 0 && (
        <Center>🔍 Hech narsa topilmadi. Filtrlarni o'zgartiring.</Center>
      )}

      {tab === 'vacancies'
        ? vacancyItems.map((v) => <VacancyCard key={v.id} v={v} />)
        : resumeItems.map((r) => <ResumeCard key={r.id} r={r} />)}
      <div ref={sentinel} style={{ height: 1 }} />
      {isFetchingNextPage && <Spinner />}

      <SavedLink onClick={() => navigate('/saved')}>⭐ Saqlangan</SavedLink>
    </Screen>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useSaved, useToggleSave, useVacancy } from '../api/hooks';
import { Button, Card, EMPLOYMENT_LABEL, Pill, Screen, Spinner, Center, formatSalary } from '../components/ui';
import { getWebApp } from '../telegram';
import { css } from '../theme';

const Title = styled.h1`
  font-size: 20px;
  margin: 0 0 10px;
  padding: 0 4px;
`;
const Section = styled.div`
  margin: 10px 0;
  h4 {
    margin: 0 0 6px;
    font-size: 13px;
    color: ${css.hint};
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
`;
const Desc = styled.p`
  white-space: pre-wrap;
  line-height: 1.55;
  font-size: 15px;
  margin: 0;
`;
const Actions = styled.div`
  display: flex;
  gap: 10px;
  padding: 12px;
  position: sticky;
  bottom: 0;
  background: ${css.bg};
  border-top: 1px solid color-mix(in srgb, ${css.hint} 15%, transparent);
  & > * {
    flex: 1;
  }
`;
const SourceLink = styled.a`
  display: block;
  color: ${css.link};
  font-size: 14px;
  margin: 4px 0;
  text-decoration: none;
`;

export function VacancyPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: v, isLoading, isError } = useVacancy(id);
  const { data: saved } = useSaved();
  const toggleSave = useToggleSave();
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const wa = getWebApp();
    wa?.BackButton.show();
    const back = () => navigate(-1);
    wa?.BackButton.onClick(back);
    return () => {
      wa?.BackButton.offClick(back);
      wa?.BackButton.hide();
    };
  }, [navigate]);

  useEffect(() => {
    if (saved && v) setIsSaved(saved.some((s) => s.id === v.id));
  }, [saved, v]);

  if (isLoading) return <Spinner />;
  if (isError || !v)
    return (
      <Center>
        😕 Vakansiya topilmadi
        <Button $variant="ghost" onClick={() => navigate('/')}>
          Bosh sahifa
        </Button>
      </Center>
    );

  const handleSave = async () => {
    const next = await toggleSave.mutateAsync({ id: v.id, saved: isSaved });
    setIsSaved(next);
  };

  const openContact = () => {
    const wa = getWebApp();
    if (v.tgContact) {
      const username = v.tgContact.replace('@', '');
      wa ? wa.openTelegramLink(`https://t.me/${username}`) : window.open(`https://t.me/${username}`);
    } else if (v.phones[0]) {
      window.location.href = `tel:+${v.phones[0]}`;
    }
  };

  return (
    <Screen>
      <div style={{ padding: '16px 12px 0' }}>
        <Title>{v.title}</Title>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 4px' }}>
          <Pill>📍 {v.region.nameUz}{v.district ? `, ${v.district}` : ''}</Pill>
          <Pill $accent>{v.category.nameUz}</Pill>
          <Pill>{EMPLOYMENT_LABEL[v.employmentType]}</Pill>
        </div>
      </div>

      <Card>
        <div style={{ color: '#15997a', fontWeight: 700, fontSize: 17, marginBottom: 8 }}>
          💰 {formatSalary(v.salaryMin, v.salaryMax, v.currency)}
        </div>
        {v.company && <div style={{ marginBottom: 8 }}>🏢 {v.company}</div>}
        <Section>
          <h4>Tavsif</h4>
          <Desc>{v.description}</Desc>
        </Section>
        {v.sources.length > 0 && (
          <Section>
            <h4>Manba</h4>
            {v.sources.map((s, i) =>
              s.externalUrl ? (
                <SourceLink key={i} href={s.externalUrl} target="_blank" rel="noreferrer">
                  🌐 {s.channelTitle}
                </SourceLink>
              ) : (
                <div key={i} style={{ fontSize: 14, color: css.hint }}>
                  📡 {s.channelTitle}
                  {s.channelUsername ? ` (@${s.channelUsername})` : ''}
                </div>
              ),
            )}
          </Section>
        )}
      </Card>

      <Actions>
        <Button onClick={openContact}>
          {v.tgContact ? '✈️ Bog\'lanish' : v.phones[0] ? '📞 Qo\'ng\'iroq' : 'Aloqa yo\'q'}
        </Button>
        <Button $variant="ghost" onClick={handleSave} disabled={toggleSave.isPending}>
          {isSaved ? '⭐ Saqlangan' : '☆ Saqlash'}
        </Button>
      </Actions>
    </Screen>
  );
}

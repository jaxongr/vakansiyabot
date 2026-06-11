import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { useResume } from '../api/hooks';
import { Button, Card, Center, Pill, Screen, Spinner, formatSalary } from '../components/ui';
import { getWebApp } from '../telegram';
import { css } from '../theme';

const Title = styled.h1`
  font-size: 20px;
  margin: 0 0 4px;
  padding: 0 4px;
`;
const Section = styled.div`
  margin: 12px 0;
  h4 {
    margin: 0 0 6px;
    font-size: 13px;
    color: ${css.hint};
    text-transform: uppercase;
    letter-spacing: 0.4px;
  }
  p {
    margin: 0;
    white-space: pre-wrap;
    line-height: 1.55;
    font-size: 15px;
  }
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

export function ResumePage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: r, isLoading, isError } = useResume(id);

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

  if (isLoading) return <Spinner />;
  if (isError || !r)
    return (
      <Center>
        😕 Rezyume topilmadi
        <Button $variant="ghost" onClick={() => navigate('/')}>
          Bosh sahifa
        </Button>
      </Center>
    );

  const openContact = () => {
    const wa = getWebApp();
    if (r.tgContact) {
      const username = r.tgContact.replace('@', '');
      wa ? wa.openTelegramLink(`https://t.me/${username}`) : window.open(`https://t.me/${username}`);
    } else if (r.phones[0]) {
      window.location.href = `tel:+${r.phones[0]}`;
    }
  };

  return (
    <Screen>
      <div style={{ padding: '16px 12px 0' }}>
        <Title>👤 {r.fullName}{r.age ? `, ${r.age} yosh` : ''}</Title>
        <div style={{ fontSize: 15, color: css.hint, padding: '0 4px 8px' }}>{r.title}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 4px' }}>
          <Pill>📍 {r.region.nameUz}</Pill>
          <Pill $accent>{r.category.nameUz}</Pill>
          {r.experienceYears ? <Pill>🛠 {r.experienceYears} yil tajriba</Pill> : null}
        </div>
      </div>

      <Card>
        {r.salaryExpectation ? (
          <div style={{ color: '#15997a', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
            💰 Kutilayotgan maosh: {formatSalary(r.salaryExpectation, null, r.currency)}
          </div>
        ) : null}
        <Section>
          <h4>O'zi haqida</h4>
          <p>{r.about}</p>
        </Section>
        {r.education && (
          <Section>
            <h4>Ma'lumoti</h4>
            <p>{r.education}</p>
          </Section>
        )}
        {r.skills.length > 0 && (
          <Section>
            <h4>Ko'nikmalar</h4>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {r.skills.map((s, i) => (
                <Pill key={i}>{s}</Pill>
              ))}
            </div>
          </Section>
        )}
      </Card>

      <Actions>
        <Button onClick={openContact}>
          {r.tgContact ? "✈️ Bog'lanish" : r.phones[0] ? "📞 Qo'ng'iroq" : "Aloqa yo'q"}
        </Button>
      </Actions>
    </Screen>
  );
}

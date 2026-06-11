import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useSaved } from '../api/hooks';
import { VacancyCard } from '../components/VacancyCard';
import { Center, Screen, Spinner } from '../components/ui';
import { getWebApp } from '../telegram';
import { css } from '../theme';

const Header = styled.h1`
  font-size: 20px;
  padding: 16px;
  margin: 0;
  border-bottom: 1px solid color-mix(in srgb, ${css.hint} 15%, transparent);
`;

export function Saved() {
  const navigate = useNavigate();
  const { data, isLoading } = useSaved();

  useEffect(() => {
    const wa = getWebApp();
    wa?.BackButton.show();
    const back = () => navigate('/');
    wa?.BackButton.onClick(back);
    return () => {
      wa?.BackButton.offClick(back);
      wa?.BackButton.hide();
    };
  }, [navigate]);

  return (
    <Screen>
      <Header>⭐ Saqlangan vakansiyalar</Header>
      {isLoading && <Spinner />}
      {!isLoading && (!data || data.length === 0) && (
        <Center>Hali saqlangan vakansiya yo'q</Center>
      )}
      {data?.map((v) => <VacancyCard key={v.id} v={v} />)}
    </Screen>
  );
}

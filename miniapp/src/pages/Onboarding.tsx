import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useRegions, useSetRegion } from '../api/hooks';
import { Button, Center, Screen, Spinner } from '../components/ui';
import { css } from '../theme';

const Header = styled.div`
  padding: 24px 16px 8px;
  h1 {
    font-size: 22px;
    margin: 0 0 6px;
  }
  p {
    color: ${css.hint};
    margin: 0;
    font-size: 14px;
  }
`;
const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 16px;
`;
const RegionBtn = styled.button`
  border: 1px solid color-mix(in srgb, ${css.hint} 25%, transparent);
  background: ${css.bg};
  color: ${css.text};
  border-radius: 12px;
  padding: 16px 12px;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  &:active {
    background: ${css.secondaryBg};
  }
`;

export function Onboarding() {
  const { data: regions, isLoading } = useRegions();
  const setRegion = useSetRegion();
  const navigate = useNavigate();

  if (isLoading) return <Spinner />;

  const choose = async (regionId: string) => {
    try {
      await setRegion.mutateAsync(regionId);
    } catch {
      // dev rejimida auth bo'lmasligi mumkin — baribir davom etamiz
    }
    localStorage.setItem('onboarded', '1');
    navigate('/');
  };

  return (
    <Screen>
      <Header>
        <h1>Qaysi viloyatdasiz?</h1>
        <p>Sizga mos vakansiyalarni ko'rsatamiz</p>
      </Header>
      <Grid>
        {regions
          ?.filter((r) => !r.special)
          .map((r) => (
            <RegionBtn key={r.id} onClick={() => choose(r.id)}>
              {r.nameUz}
            </RegionBtn>
          ))}
      </Grid>
      <Center>
        <Button $variant="ghost" onClick={() => choose('')}>
          O'tkazib yuborish
        </Button>
      </Center>
    </Screen>
  );
}

import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ResumeListItem } from '../api/types';
import { Card, Pill, formatSalary } from './ui';
import { css } from '../theme';

const Title = styled.h3`
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
`;
const Sub = styled.div`
  font-size: 14px;
  color: ${css.hint};
  margin-bottom: 8px;
`;
const Row = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
`;

export function ResumeCard({ r }: { r: ResumeListItem }) {
  const navigate = useNavigate();
  return (
    <Card onClick={() => navigate(`/resume/${r.id}`)} style={{ cursor: 'pointer' }}>
      <Title>👤 {r.fullName}{r.age ? `, ${r.age}` : ''}</Title>
      <Sub>{r.title}</Sub>
      <Row>
        <Pill>📍 {r.region.nameUz}</Pill>
        <Pill $accent>{r.category.nameUz}</Pill>
        {r.experienceYears ? <Pill>🛠 {r.experienceYears} yil</Pill> : null}
        {r.salaryExpectation ? (
          <Pill>💰 {formatSalary(r.salaryExpectation, null, r.currency)}</Pill>
        ) : null}
      </Row>
    </Card>
  );
}

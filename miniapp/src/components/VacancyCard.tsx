import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { VacancyListItem } from '../api/types';
import { Card, EMPLOYMENT_LABEL, Pill, formatSalary } from './ui';
import { css } from '../theme';

const Title = styled.h3`
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
`;
const Salary = styled.div`
  color: #15997a;
  font-weight: 700;
  font-size: 15px;
  margin: 8px 0;
`;
const Row = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
`;
const Meta = styled.div`
  font-size: 13px;
  color: ${css.hint};
  margin-top: 6px;
`;

export function VacancyCard({ v }: { v: VacancyListItem }) {
  const navigate = useNavigate();
  return (
    <Card
      onClick={() => navigate(`/vacancy/${v.id}`)}
      style={{
        cursor: 'pointer',
        ...(v.featured ? { borderColor: '#F59E0B', borderWidth: 1.5 } : {}),
      }}
    >
      {v.featured && (
        <div style={{ fontSize: 12, fontWeight: 600, color: '#F59E0B', marginBottom: 4 }}>
          ⭐ TOP e'lon
        </div>
      )}
      <Title>{v.title}</Title>
      <Row>
        <Pill>📍 {v.region.nameUz}</Pill>
        <Pill $accent>{v.category.nameUz}</Pill>
        <Pill>{EMPLOYMENT_LABEL[v.employmentType]}</Pill>
      </Row>
      <Salary>💰 {formatSalary(v.salaryMin, v.salaryMax, v.currency)}</Salary>
      {v.company && <Meta>🏢 {v.company}</Meta>}
    </Card>
  );
}

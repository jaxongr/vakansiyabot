import { Card, Col, Empty, Row, Spin, Statistic, Tag } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useOverview } from '../api/hooks';
import { STATUS_COLOR } from '../theme';

const PIE_COLORS = ['#6B46C1', '#2DD4A8', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#10B981', '#8B5CF6'];

export function Overview() {
  const { data, isLoading } = useOverview();
  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  if (!data) return <Empty description="Ma'lumot yo'q" />;

  const daily = data.daily.map((d) => ({
    day: new Date(d.day).toLocaleDateString('uz', { day: '2-digit', month: '2-digit' }),
    count: d.count,
  }));

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Vakansiyalar" value={data.totals.vacancies} valueStyle={{ color: '#6B46C1' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Rezyumelar" value={data.totals.resumes} valueStyle={{ color: '#2DD4A8' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Manba postlar" value={data.totals.rawSources} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Dublikat %" value={data.totals.duplicatePercent} suffix="%" valueStyle={{ color: '#F59E0B' }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="Kunlik vakansiyalar (14 kun)">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#6B46C1" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card title="Viloyatlar bo'yicha">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={data.byRegion}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={95}
                  label={(e) => e.name}
                  fontSize={11}
                >
                  {data.byRegion.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Kategoriyalar bo'yicha">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.byCategory} layout="vertical" margin={{ left: 40 }}>
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="name" fontSize={10} width={90} />
                <Tooltip />
                <Bar dataKey="count" fill="#2DD4A8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card title="Komponentlar holati" style={{ marginTop: 16 }}>
        {Object.entries(data.components).length === 0 && <span>Hali ma'lumot yo'q</span>}
        {Object.entries(data.components).map(([name, c]) => (
          <Tag key={name} color={STATUS_COLOR[c.status] ?? 'default'} style={{ marginBottom: 8 }}>
            {name}: {c.status}
            {c.message ? ` — ${c.message}` : ''}
          </Tag>
        ))}
      </Card>
    </>
  );
}

import { Card, Col, Empty, Row, Spin } from 'antd';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAnalytics } from '../api/hooks';

const COLORS = ['#6B46C1', '#2DD4A8', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#10B981', '#8B5CF6'];
const ORIGIN_LABEL: Record<string, string> = { CHANNEL: 'Kanal', BOT: 'Bot', WEB: 'Sayt' };
const EMP_LABEL: Record<string, string> = {
  FULL_TIME: "To'liq",
  PART_TIME: 'Yarim',
  REMOTE: 'Masofaviy',
  SHIFT: 'Smenali',
};

export function Analytics() {
  const { data, isLoading } = useAnalytics();
  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  if (!data) return <Empty description="Ma'lumot yo'q" />;

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={10}>
          <Card title="Pipeline funnel">
            <ResponsiveContainer width="100%" height={260}>
              <FunnelChart>
                <Tooltip />
                <Funnel dataKey="count" data={data.funnel} isAnimationActive>
                  <LabelList position="right" fill="#333" stroke="none" dataKey="stage" />
                  {data.funnel.map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={14}>
          <Card title="Kunlik: vakansiya + rezyume (30 kun)">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" fontSize={11} tickFormatter={(d: string) => d.slice(5)} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="vacancies" name="Vakansiya" stroke="#6B46C1" fill="#6B46C1" fillOpacity={0.25} />
                <Area type="monotone" dataKey="resumes" name="Rezyume" stroke="#2DD4A8" fill="#2DD4A8" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={8}>
          <Card title="Manba bo'yicha">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.byOrigin.map((o: { origin: string; count: number }) => ({
                    name: ORIGIN_LABEL[o.origin] ?? o.origin,
                    value: o.count,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={85}
                  label
                >
                  {data.byOrigin.map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Ish turi">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={data.byEmployment.map((e: { type: string; count: number }) => ({
                    name: EMP_LABEL[e.type] ?? e.type,
                    value: e.count,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={85}
                  label
                >
                  {data.byEmployment.map((_: unknown, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card title="Maosh taqsimoti">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.salaryBuckets}>
                <XAxis dataKey="bucket" fontSize={10} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#F59E0B" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={14}>
          <Card title="Soatlik aktivlik (postlar kelishi)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.hourly}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="hour" fontSize={11} tickFormatter={(h: number) => `${h}:00`} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip labelFormatter={(h) => `${h}:00`} />
                <Bar dataKey="count" fill="#6B46C1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card title="Top kanallar (postlar soni)">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={data.topChannels} layout="vertical" margin={{ left: 30 }}>
                <XAxis type="number" fontSize={11} allowDecimals={false} />
                <YAxis type="category" dataKey="title" fontSize={9} width={110} />
                <Tooltip />
                <Bar dataKey="posts" fill="#2DD4A8" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </>
  );
}

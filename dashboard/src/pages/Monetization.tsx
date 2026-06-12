import { Card, Col, Empty, message, Popconfirm, Row, Spin, Statistic, Table, Tag } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from 'antd';
import { useBilling } from '../api/hooks';

const PURPOSE_LABEL: Record<string, string> = {
  SUBSCRIPTION: 'Obuna',
  FEATURED_VACANCY: 'Featured e\'lon',
  FEATURED_RESUME: 'Featured rezyume',
  RESUME_ACCESS: 'Rezyume bazasi',
};
const STATUS_COLOR: Record<string, string> = {
  PAID: 'success',
  PENDING: 'warning',
  FAILED: 'error',
  REFUNDED: 'default',
};

function fmt(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function Monetization() {
  const { payments, revenue, plans, confirm } = useBilling();
  if (revenue.isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  const r = revenue.data;

  return (
    <>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Umumiy daromad" value={r ? fmt(r.totalRevenue) : 0} suffix="so'm" valueStyle={{ color: '#16A34A' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="To'langan" value={r?.paidCount ?? 0} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Kutilmoqda" value={r?.pendingCount ?? 0} valueStyle={{ color: '#F59E0B' }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="Tariflar" value={plans.data?.length ?? 0} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={14}>
          <Card title="Kunlik daromad (30 kun)">
            {r && r.daily.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={r.daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="day" fontSize={11} tickFormatter={(d: string) => String(d).slice(5, 10)} />
                  <YAxis fontSize={11} tickFormatter={(v: number) => `${v / 1000}k`} />
                  <Tooltip formatter={(v: number) => `${fmt(v)} so'm`} />
                  <Bar dataKey="sum" fill="#16A34A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="Hali to'lov yo'q" />
            )}
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card title="Tariflar">
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={plans.data ?? []}
              columns={[
                { title: 'Tarif', dataIndex: 'name' },
                {
                  title: 'Narx',
                  dataIndex: 'priceUzs',
                  render: (p: number) => (p === 0 ? 'Bepul' : `${fmt(p)} so'm`),
                },
                {
                  title: 'Rezyume',
                  dataIndex: 'resumeAccess',
                  render: (a: boolean) => (a ? <Tag color="green">Ha</Tag> : '—'),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>

      <Card title="To'lovlar" style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          loading={payments.isLoading}
          dataSource={payments.data ?? []}
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Maqsad',
              dataIndex: 'purpose',
              render: (p: string) => PURPOSE_LABEL[p] ?? p,
            },
            {
              title: 'Summa',
              dataIndex: 'amountUzs',
              render: (a: number) => `${fmt(a)} so'm`,
            },
            { title: 'Provider', dataIndex: 'provider' },
            {
              title: 'Foydalanuvchi',
              dataIndex: 'user',
              render: (u: { username?: string; firstName?: string } | null) =>
                u ? `${u.firstName ?? ''} ${u.username ? '@' + u.username : ''}` : '—',
            },
            {
              title: 'Holat',
              dataIndex: 'status',
              render: (s: string) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
            },
            {
              title: 'Sana',
              dataIndex: 'createdAt',
              render: (d: string) => new Date(d).toLocaleString('uz'),
            },
            {
              title: 'Amal',
              render: (_: unknown, row: { id: string; status: string }) =>
                row.status === 'PENDING' ? (
                  <Popconfirm
                    title="To'lov tasdiqlansinmi?"
                    onConfirm={async () => {
                      await confirm.mutateAsync(row.id);
                      message.success('Tasdiqlandi va faollashtirildi');
                    }}
                  >
                    <Button size="small" type="primary">
                      Tasdiqlash
                    </Button>
                  </Popconfirm>
                ) : null,
            },
          ]}
        />
      </Card>
    </>
  );
}

import { Badge, Card, Col, Descriptions, Empty, Row, Spin } from 'antd';
import { useHealth } from '../api/hooks';

interface Health {
  status: string;
  db: { status: string };
  redis: { status: string };
  components: Record<string, { status: string; message?: string; updatedAt: string }>;
}

const BADGE: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  OK: 'success',
  ok: 'success',
  DEGRADED: 'warning',
  degraded: 'warning',
  DOWN: 'error',
  DISABLED: 'default',
};

export function System() {
  const { data, isLoading } = useHealth();
  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  const h = data as Health | undefined;
  if (!h) return <Empty />;

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={8}>
        <Card title="Asosiy">
          <p>
            <Badge status={BADGE[h.status] ?? 'default'} /> Umumiy: <b>{h.status}</b>
          </p>
          <p>
            <Badge status={BADGE[h.db.status] ?? 'default'} /> PostgreSQL: {h.db.status}
          </p>
          <p>
            <Badge status={BADGE[h.redis.status] ?? 'default'} /> Redis: {h.redis.status}
          </p>
        </Card>
      </Col>
      <Col xs={24} md={16}>
        <Card title="Komponentlar">
          {Object.keys(h.components).length === 0 ? (
            <Empty description="Komponent ma'lumoti yo'q" />
          ) : (
            <Descriptions column={1} bordered size="small">
              {Object.entries(h.components).map(([name, c]) => (
                <Descriptions.Item
                  key={name}
                  label={
                    <span>
                      <Badge status={BADGE[c.status] ?? 'default'} /> {name}
                    </span>
                  }
                >
                  {c.status}
                  {c.message ? ` — ${c.message}` : ''}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )}
        </Card>
      </Col>
    </Row>
  );
}

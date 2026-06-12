import { Badge, Card, Col, Descriptions, Empty, Row, Spin } from 'antd';
import { useHealth } from '../api/hooks';

interface QueueCount {
  waiting?: number;
  active?: number;
  failed?: number;
}
interface Health {
  status: string;
  db: { status: string };
  redis: { status: string };
  queues?: {
    analyze?: QueueCount;
    dedup?: QueueCount;
    publish?: QueueCount;
    deadLetter?: number;
  };
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
      {h.queues && (
        <Col xs={24}>
          <Card title="Navbatlar (BullMQ)">
            <Descriptions column={{ xs: 1, sm: 2, md: 4 }} bordered size="small">
              <Descriptions.Item label="Analyze">
                ⏳ {h.queues.analyze?.waiting ?? 0} / ▶ {h.queues.analyze?.active ?? 0} / ❌{' '}
                {h.queues.analyze?.failed ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Dedup">
                ⏳ {h.queues.dedup?.waiting ?? 0} / ▶ {h.queues.dedup?.active ?? 0} / ❌{' '}
                {h.queues.dedup?.failed ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Publish">
                ⏳ {h.queues.publish?.waiting ?? 0} / ▶ {h.queues.publish?.active ?? 0} / ❌{' '}
                {h.queues.publish?.failed ?? 0}
              </Descriptions.Item>
              <Descriptions.Item label="Dead-letter">{h.queues.deadLetter ?? 0}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      )}
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

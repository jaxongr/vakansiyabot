import { Button, Card, Col, Empty, message, Row, Space, Spin, Tag, Typography } from 'antd';
import { useDedupResolve, useDedupReview } from '../api/hooks';

interface VacancySide {
  id: string;
  title: string;
  description: string;
  phones: string[];
  createdAt: string;
}
interface Review {
  id: string;
  similarity: number;
  vacancyA: VacancySide;
  vacancyB: VacancySide;
}

function Side({ v, label }: { v: VacancySide; label: string }) {
  return (
    <Card size="small" title={label} style={{ height: '100%' }}>
      <Typography.Title level={5}>{v.title}</Typography.Title>
      <Typography.Paragraph ellipsis={{ rows: 6 }} style={{ whiteSpace: 'pre-wrap' }}>
        {v.description}
      </Typography.Paragraph>
      {v.phones.length > 0 && <Tag color="blue">📞 {v.phones.join(', ')}</Tag>}
      <div style={{ color: '#999', fontSize: 12, marginTop: 8 }}>
        {new Date(v.createdAt).toLocaleString('uz')}
      </div>
    </Card>
  );
}

export function Dedup() {
  const { data, isLoading } = useDedupReview();
  const resolve = useDedupResolve();

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;
  const reviews: Review[] = data?.data ?? [];
  if (reviews.length === 0) return <Empty description="Shubhali juftliklar yo'q" />;

  const act = async (id: string, action: 'merge' | 'separate') => {
    await resolve.mutateAsync({ id, action });
    message.success(action === 'merge' ? 'Birlashtirildi' : 'Alohida qoldirildi');
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      {reviews.map((r) => (
        <Card key={r.id} title={<Tag color="orange">O'xshashlik: {(r.similarity * 100).toFixed(1)}%</Tag>}>
          <Row gutter={16}>
            <Col span={12}>
              <Side v={r.vacancyA} label="Mavjud (A)" />
            </Col>
            <Col span={12}>
              <Side v={r.vacancyB} label="Yangi (B)" />
            </Col>
          </Row>
          <Space style={{ marginTop: 16 }}>
            <Button type="primary" onClick={() => act(r.id, 'merge')} loading={resolve.isPending}>
              🔗 Birlashtirish (B → A)
            </Button>
            <Button onClick={() => act(r.id, 'separate')} loading={resolve.isPending}>
              ✂️ Alohida qoldirish
            </Button>
          </Space>
        </Card>
      ))}
    </Space>
  );
}

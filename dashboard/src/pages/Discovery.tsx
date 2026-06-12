import { Button, Card, Empty, message, Space, Table, Tag, Typography } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { useDiscovery } from '../api/hooks';

interface Discovered {
  id: string;
  username: string;
  mentions: number;
  firstSeenIn: string | null;
  createdAt: string;
}

export function Discovery() {
  const { list, resolve } = useDiscovery();

  return (
    <Card title="Avto-kashf etilgan kanal nomzodlari">
      <Typography.Paragraph type="secondary">
        Yig'ilgan postlardagi @mention va t.me havolalaridan topilgan kanallar.
        Ko'p eslatilgan (mentions) kanallar — yaxshiroq nomzod. Tasdiqlasangiz
        kuzatuvga qo'shiladi va manba bazasi kengayadi.
      </Typography.Paragraph>
      {!list.isLoading && (!list.data || list.data.length === 0) ? (
        <Empty description="Hozircha nomzod yo'q — collector ishlagach to'ladi" />
      ) : (
        <Table<Discovered>
          rowKey="id"
          loading={list.isLoading}
          dataSource={list.data ?? []}
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: 'Kanal',
              dataIndex: 'username',
              render: (u: string) => (
                <a href={`https://t.me/${u}`} target="_blank" rel="noreferrer">
                  @{u}
                </a>
              ),
            },
            {
              title: 'Eslatildi',
              dataIndex: 'mentions',
              sorter: (a, b) => a.mentions - b.mentions,
              defaultSortOrder: 'descend',
              render: (m: number) => <Tag color={m > 3 ? 'green' : 'default'}>{m}x</Tag>,
            },
            { title: 'Topilgan joy', dataIndex: 'firstSeenIn', render: (v: string | null) => v ?? '—' },
            {
              title: 'Amal',
              render: (_: unknown, row: Discovered) => (
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={async () => {
                      await resolve.mutateAsync({ id: row.id, action: 'approve' });
                      message.success(`@${row.username} kuzatuvga qo'shildi`);
                    }}
                  >
                    Qo'shish
                  </Button>
                  <Button
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    onClick={() => resolve.mutate({ id: row.id, action: 'reject' })}
                  >
                    Rad
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}

import { useState } from 'react';
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { PlusOutlined, SyncOutlined } from '@ant-design/icons';
import { useWebSources, useWebSourceMutations } from '../api/hooks';
import { STATUS_COLOR } from '../theme';

interface WebSource {
  id: string;
  type: string;
  name: string;
  url: string;
  status: string;
  postsCount: number;
  lastError: string | null;
  lastScrapedAt: string | null;
}

export function WebSources() {
  const { data, isLoading } = useWebSources();
  const { add, scrape, remove } = useWebSourceMutations();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const submit = async () => {
    const body = await form.validateFields();
    try {
      await add.mutateAsync(body);
      message.success('Manba qo`shildi, skanerlash boshlandi');
      setOpen(false);
      form.resetFields();
    } catch (e) {
      const err = (e as { response?: { data?: { error?: { message?: string } } } }).response?.data
        ?.error?.message;
      message.error(err ?? 'Xatolik');
    }
  };

  return (
    <Card
      title="Vakansiya saytlari (RSS / HTML)"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Sayt qo'shish
        </Button>
      }
    >
      <Table<WebSource>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        pagination={false}
        columns={[
          { title: 'Nomi', dataIndex: 'name' },
          { title: 'Turi', dataIndex: 'type', render: (t: string) => <Tag>{t}</Tag> },
          {
            title: 'URL',
            dataIndex: 'url',
            ellipsis: true,
            render: (u: string) => (
              <a href={u} target="_blank" rel="noreferrer">
                {u}
              </a>
            ),
          },
          { title: 'E`lonlar', dataIndex: 'postsCount' },
          {
            title: 'Holat',
            dataIndex: 'status',
            render: (s: string, row: WebSource) => (
              <Tag color={STATUS_COLOR[s]} title={row.lastError ?? ''}>
                {s}
              </Tag>
            ),
          },
          {
            title: 'Amallar',
            render: (_: unknown, row: WebSource) => (
              <Space>
                <Button
                  size="small"
                  icon={<SyncOutlined />}
                  loading={scrape.isPending}
                  onClick={async () => {
                    const res = await scrape.mutateAsync(row.id);
                    message.success(`${res.data.created} yangi e'lon`);
                  }}
                >
                  Skanerlash
                </Button>
                <Popconfirm title="O'chirilsinmi?" onConfirm={() => remove.mutate(row.id)}>
                  <Button size="small" danger>
                    O'chirish
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal title="Vakansiya sayti qo'shish" open={open} onOk={submit} onCancel={() => setOpen(false)} confirmLoading={add.isPending}>
        <Form form={form} layout="vertical" initialValues={{ type: 'GENERIC_RSS', intervalMin: 30 }}>
          <Form.Item name="type" label="Turi" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'GENERIC_RSS', label: 'RSS / Atom feed' },
                { value: 'ISHUZ', label: 'ish.uz (HTML)' },
                { value: 'OLX', label: 'OLX (HTML)' },
                { value: 'HHUZ', label: 'hh.uz (HTML)' },
              ]}
            />
          </Form.Item>
          <Form.Item name="name" label="Nomi" rules={[{ required: true }]}>
            <Input placeholder="ish.uz IT vakansiyalari" />
          </Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true, type: 'url' }]}>
            <Input placeholder="https://ish.uz/rss" />
          </Form.Item>
          <Form.Item name="intervalMin" label="Skanerlash oralig'i (daqiqa)">
            <InputNumber min={5} max={1440} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

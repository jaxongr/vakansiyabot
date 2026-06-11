import { useState } from 'react';
import { Button, Card, Form, Input, message, Modal, Popconfirm, Space, Table, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useChannels, useChannelMutations } from '../api/hooks';
import { STATUS_COLOR } from '../theme';

interface Channel {
  id: string;
  title: string;
  username: string | null;
  status: string;
  type: string;
  postsCount: number;
}

export function Channels() {
  const { data, isLoading } = useChannels();
  const { add, setStatus, remove } = useChannelMutations();
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const submit = async () => {
    const { username } = await form.validateFields();
    try {
      await add.mutateAsync(username);
      message.success('Kanal qo`shildi');
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
      title="Kuzatilayotgan kanallar"
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Kanal qo'shish
        </Button>
      }
    >
      <Table<Channel>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        pagination={false}
        columns={[
          { title: 'Nomi', dataIndex: 'title' },
          {
            title: 'Username',
            dataIndex: 'username',
            render: (u: string | null) => (u ? `@${u}` : '—'),
          },
          { title: 'Turi', dataIndex: 'type' },
          { title: 'Postlar', dataIndex: 'postsCount' },
          {
            title: 'Holat',
            dataIndex: 'status',
            render: (s: string) => <Tag color={STATUS_COLOR[s]}>{s}</Tag>,
          },
          {
            title: 'Amallar',
            render: (_: unknown, row: Channel) => (
              <Space>
                <Button
                  size="small"
                  onClick={() =>
                    setStatus.mutate({
                      id: row.id,
                      status: row.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
                    })
                  }
                >
                  {row.status === 'ACTIVE' ? 'To`xtatish' : 'Faollashtirish'}
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

      <Modal title="Kanal qo'shish" open={open} onOk={submit} onCancel={() => setOpen(false)} confirmLoading={add.isPending}>
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="Kanal username"
            rules={[{ required: true, message: 'username kiriting' }]}
          >
            <Input placeholder="ishbor_uz yoki @ishbor_uz" prefix="@" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}

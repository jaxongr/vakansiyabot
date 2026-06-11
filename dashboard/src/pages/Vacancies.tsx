import { useState } from 'react';
import {
  Button,
  Card,
  Drawer,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Space,
  Table,
  Tag,
} from 'antd';
import { useRefs, useVacancies, useVacancyMutation } from '../api/hooks';

interface Vacancy {
  id: string;
  title: string;
  description: string;
  company: string | null;
  salaryMin: number | null;
  status: string;
  origin: string;
  region: { id: string; nameUz: string };
  category: { id: string; nameUz: string };
}

const ORIGIN_LABEL: Record<string, string> = { CHANNEL: 'Kanal', BOT: 'Bot', WEB: 'Sayt' };

export function Vacancies() {
  const { regions, categories } = useRefs();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { data, isLoading } = useVacancies(filters);
  const mutation = useVacancyMutation();
  const [editing, setEditing] = useState<Vacancy | null>(null);
  const [form] = Form.useForm();

  const openEdit = (v: Vacancy) => {
    setEditing(v);
    form.setFieldsValue(v);
  };

  const save = async () => {
    const body = await form.validateFields();
    await mutation.mutateAsync({ id: editing!.id, body });
    message.success('Saqlandi — guruhdagi post ham yangilandi');
    setEditing(null);
  };

  const hide = async (v: Vacancy) => {
    await mutation.mutateAsync({ id: v.id, body: { status: 'HIDDEN' } });
    message.success('Yashirildi — guruhdan o`chirildi');
  };

  return (
    <Card title="Vakansiyalar moderatsiyasi">
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          allowClear
          placeholder="Viloyat"
          style={{ width: 180 }}
          options={regions.data?.map((r: { id: string; nameUz: string }) => ({ value: r.id, label: r.nameUz }))}
          onChange={(v) => setFilters((f) => ({ ...f, regionId: v ?? '' }))}
        />
        <Select
          allowClear
          placeholder="Kategoriya"
          style={{ width: 180 }}
          options={categories.data?.map((c: { id: string; nameUz: string }) => ({ value: c.id, label: c.nameUz }))}
          onChange={(v) => setFilters((f) => ({ ...f, categoryId: v ?? '' }))}
        />
        <Input.Search
          placeholder="Qidirish..."
          style={{ width: 220 }}
          onSearch={(v) => setFilters((f) => ({ ...f, q: v }))}
          allowClear
        />
      </Space>

      <Table<Vacancy>
        rowKey="id"
        loading={isLoading}
        dataSource={data?.data ?? []}
        pagination={false}
        columns={[
          { title: 'Sarlavha', dataIndex: 'title', ellipsis: true },
          { title: 'Viloyat', dataIndex: ['region', 'nameUz'] },
          { title: 'Kategoriya', dataIndex: ['category', 'nameUz'] },
          {
            title: 'Manba',
            dataIndex: 'origin',
            render: (o: string) => <Tag>{ORIGIN_LABEL[o] ?? o}</Tag>,
          },
          {
            title: 'Holat',
            dataIndex: 'status',
            render: (s: string) => <Tag color={s === 'ACTIVE' ? 'success' : 'default'}>{s}</Tag>,
          },
          {
            title: 'Amallar',
            render: (_: unknown, v: Vacancy) => (
              <Space>
                <Button size="small" onClick={() => openEdit(v)}>
                  Tahrirlash
                </Button>
                <Button size="small" danger onClick={() => hide(v)}>
                  Yashirish
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Drawer
        title="Vakansiyani tahrirlash"
        width={460}
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        extra={
          <Button type="primary" onClick={save} loading={mutation.isPending}>
            Saqlash
          </Button>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Sarlavha" rules={[{ required: true, min: 3 }]}>
            <Input />
          </Form.Item>
          <Form.Item name="company" label="Kompaniya">
            <Input />
          </Form.Item>
          <Form.Item name="description" label="Tavsif" rules={[{ required: true, min: 10 }]}>
            <Input.TextArea rows={6} />
          </Form.Item>
          <Form.Item name="salaryMin" label="Maosh (min)">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="regionId" label="Viloyat">
            <Select options={regions.data?.map((r: { id: string; nameUz: string }) => ({ value: r.id, label: r.nameUz }))} />
          </Form.Item>
          <Form.Item name="categoryId" label="Kategoriya">
            <Select options={categories.data?.map((c: { id: string; nameUz: string }) => ({ value: c.id, label: c.nameUz }))} />
          </Form.Item>
        </Form>
      </Drawer>
    </Card>
  );
}

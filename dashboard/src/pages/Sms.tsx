import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from 'antd';
import { useSms } from '../api/hooks';

export function Sms() {
  const { settings, logs, update, test, balance } = useSms();
  const [form] = Form.useForm();
  const [testForm] = Form.useForm();
  const [bal, setBal] = useState<number | null>(null);

  useEffect(() => {
    if (settings.data) {
      form.setFieldsValue({
        provider: settings.data.provider,
        enabled: settings.data.enabled,
        login: settings.data.login,
        sender: settings.data.sender,
        notifyOnPublish: settings.data.notifyOnPublish,
      });
    }
  }, [settings.data, form]);

  const save = async () => {
    const values = await form.validateFields();
    // bo'sh parolni yubormaymiz (mavjudini saqlash uchun)
    if (!values.password) delete values.password;
    await update.mutateAsync(values);
    message.success('SMS sozlamalari saqlandi');
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={11}>
        <Card
          title="SMS gateway sozlamalari"
          extra={
            <Switch
              checkedChildren="Yoqilgan"
              unCheckedChildren="O'chiq"
              checked={settings.data?.enabled}
              onChange={async (v) => {
                await update.mutateAsync({ enabled: v });
                message.success(v ? 'SMS yoqildi' : "SMS o'chirildi");
              }}
            />
          }
        >
          <Form form={form} layout="vertical">
            <Form.Item name="provider" label="Provider" initialValue="ESKIZ">
              <Select
                options={[
                  { value: 'ESKIZ', label: 'Eskiz.uz' },
                  { value: 'PLAYMOBILE', label: 'Play Mobile (smsxabar.uz)' },
                ]}
              />
            </Form.Item>
            <Form.Item name="login" label="Login (email yoki login)">
              <Input placeholder="email@example.com" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Parol"
              extra="Bo'sh qoldirilsa mavjud parol saqlanadi"
            >
              <Input.Password placeholder={settings.data?.password ? '••••••••' : 'parol'} />
            </Form.Item>
            <Form.Item name="sender" label="Sender (alfanumerik / 4546)">
              <Input placeholder="4546 yoki brend" />
            </Form.Item>
            <Form.Item name="notifyOnPublish" label="E'lon joylanganda SMS xabar" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Space>
              <Button type="primary" onClick={save} loading={update.isPending}>
                Saqlash
              </Button>
              <Button
                onClick={async () => {
                  const b = await balance.mutateAsync();
                  setBal(b?.balance ?? null);
                }}
                loading={balance.isPending}
              >
                Balansni tekshirish
              </Button>
              {bal !== null && <Tag color="green">Balans: {bal}</Tag>}
            </Space>
          </Form>
        </Card>

        <Card title="Test SMS" style={{ marginTop: 16 }}>
          <Form form={testForm} layout="vertical">
            <Form.Item name="phone" label="Telefon" rules={[{ required: true }]}>
              <Input placeholder="998901234567" />
            </Form.Item>
            <Form.Item name="text" label="Matn" initialValue="Test SMS — Vakansiya bot">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Button
              onClick={async () => {
                const v = await testForm.validateFields();
                const res = await test.mutateAsync(v);
                if (res.data.ok) message.success('Yuborildi');
                else message.error(`Xato: ${res.data.error}`);
              }}
              loading={test.isPending}
            >
              Test yuborish
            </Button>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={13}>
        <Card title="SMS jurnali">
          <Typography.Paragraph type="secondary">
            Oxirgi 30 ta yuborilgan SMS
          </Typography.Paragraph>
          <Table
            rowKey="id"
            size="small"
            loading={logs.isLoading}
            dataSource={logs.data ?? []}
            pagination={false}
            columns={[
              { title: 'Telefon', dataIndex: 'phone' },
              { title: 'Matn', dataIndex: 'text', ellipsis: true },
              {
                title: 'Holat',
                dataIndex: 'status',
                render: (s: string) => (
                  <Tag color={s === 'SENT' ? 'success' : s === 'FAILED' ? 'error' : 'default'}>
                    {s}
                  </Tag>
                ),
              },
              {
                title: 'Vaqt',
                dataIndex: 'createdAt',
                render: (d: string) => new Date(d).toLocaleString('uz'),
              },
            ]}
          />
        </Card>
      </Col>
    </Row>
  );
}

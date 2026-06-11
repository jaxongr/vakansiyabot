import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Form,
  Input,
  message,
  Row,
  Space,
  Steps,
  Typography,
} from 'antd';
import { useTelegram } from '../api/hooks';

export function Telegram() {
  const { settings, startLogin, confirmCode, disconnect, updateBot } = useTelegram();
  const [step, setStep] = useState(0);
  const [loginId, setLoginId] = useState('');
  const [needPassword, setNeedPassword] = useState(false);
  const [loginForm] = Form.useForm();
  const [codeForm] = Form.useForm();
  const [botForm] = Form.useForm();

  useEffect(() => {
    if (settings.data) {
      botForm.setFieldsValue({
        botUsername: settings.data.botUsername,
        publishGroupId: settings.data.publishGroupId,
        adminIds: settings.data.adminIds,
      });
    }
  }, [settings.data, botForm]);

  const s = settings.data;
  const connected = s?.collectorEnabled && s?.sessionSet;

  const doStartLogin = async () => {
    const v = await loginForm.validateFields();
    try {
      const res = await startLogin.mutateAsync({ apiId: Number(v.apiId), apiHash: v.apiHash, phone: v.phone });
      setLoginId(res.loginId);
      setStep(1);
      message.success('Kod yuborildi — Telegramingizni tekshiring');
    } catch (e) {
      message.error(errMsg(e) ?? 'Kod yuborilmadi');
    }
  };

  const doConfirm = async () => {
    const v = await codeForm.validateFields();
    try {
      await confirmCode.mutateAsync({ loginId, code: v.code, password: v.password });
      message.success('Telegram ulandi! Collector ishga tushdi.');
      setStep(0);
      setNeedPassword(false);
    } catch (e) {
      const msg = errMsg(e);
      if (msg?.includes('2FA') || msg?.includes('parol')) {
        setNeedPassword(true);
        message.warning('2FA parol kerak — parolni kiriting');
      } else {
        message.error(msg ?? 'Tasdiqlash xatosi');
      }
    }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={13}>
        <Card
          title="Collector — Telegram userbot ulanishi"
          extra={
            <Badge
              status={connected ? 'success' : 'default'}
              text={connected ? `Ulangan: ${s?.collectorPhone ?? ''}` : 'Ulanmagan'}
            />
          }
        >
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message="Userbot kanallarni o'qish uchun kerak"
            description={
              <span>
                my.telegram.org → API development tools dan <b>api_id</b> va{' '}
                <b>api_hash</b> oling. Bu bot EMAS — oddiy Telegram akkauntingiz sessiyasi.
              </span>
            }
          />

          {connected ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              <Typography.Text type="success">
                ✅ {s?.collectorPhone} raqami bilan ulangan. Collector kanallarni kuzatmoqda.
              </Typography.Text>
              <Button
                danger
                onClick={async () => {
                  await disconnect.mutateAsync();
                  message.success('Uzildi');
                }}
              >
                Ulanishni uzish
              </Button>
            </Space>
          ) : (
            <>
              <Steps
                current={step}
                size="small"
                style={{ marginBottom: 20 }}
                items={[{ title: 'API + telefon' }, { title: 'Kod + 2FA' }]}
              />

              {step === 0 && (
                <Form form={loginForm} layout="vertical">
                  <Form.Item name="apiId" label="api_id" rules={[{ required: true }]}>
                    <Input placeholder="1234567" />
                  </Form.Item>
                  <Form.Item name="apiHash" label="api_hash" rules={[{ required: true }]}>
                    <Input placeholder="abcdef0123456789..." />
                  </Form.Item>
                  <Form.Item name="phone" label="Telefon raqam" rules={[{ required: true }]}>
                    <Input placeholder="+998901234567" />
                  </Form.Item>
                  <Button type="primary" onClick={doStartLogin} loading={startLogin.isPending}>
                    Kod yuborish
                  </Button>
                </Form>
              )}

              {step === 1 && (
                <Form form={codeForm} layout="vertical">
                  <Form.Item
                    name="code"
                    label="Telegram kelgan kod"
                    rules={[{ required: true }]}
                  >
                    <Input placeholder="12345" />
                  </Form.Item>
                  {needPassword && (
                    <Form.Item name="password" label="2FA parol" rules={[{ required: true }]}>
                      <Input.Password placeholder="Cloud parol" />
                    </Form.Item>
                  )}
                  <Space>
                    <Button type="primary" onClick={doConfirm} loading={confirmCode.isPending}>
                      Tasdiqlash va ulanish
                    </Button>
                    <Button onClick={() => setStep(0)}>Orqaga</Button>
                  </Space>
                </Form>
              )}
            </>
          )}
        </Card>
      </Col>

      <Col xs={24} lg={11}>
        <Card title="Publisher — Bot sozlamalari">
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Bot tokeni o'zgarsa, backend qayta ishga tushishi kerak"
          />
          <Form form={botForm} layout="vertical">
            <Form.Item name="botToken" label="Bot token (BotFather)" extra="Bo'sh = o'zgartirmaslik">
              <Input.Password placeholder={s?.botTokenSet ? '••••••••' : 'token'} />
            </Form.Item>
            <Form.Item name="botUsername" label="Bot username">
              <Input placeholder="vakansiya_bot" />
            </Form.Item>
            <Form.Item name="publishGroupId" label="Publish guruh ID (-100...)">
              <Input placeholder="-1001234567890" />
            </Form.Item>
            <Form.Item name="adminIds" label="Admin TG ID lar (vergul bilan)">
              <Input placeholder="123456789, 987654321" />
            </Form.Item>
            <Button
              type="primary"
              onClick={async () => {
                const v = await botForm.validateFields();
                if (!v.botToken) delete v.botToken;
                await updateBot.mutateAsync(v);
                message.success('Bot sozlamalari saqlandi (restartda qo`llanadi)');
              }}
              loading={updateBot.isPending}
            >
              Saqlash
            </Button>
          </Form>
        </Card>
      </Col>
    </Row>
  );
}

function errMsg(e: unknown): string | undefined {
  return (e as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error
    ?.message;
}

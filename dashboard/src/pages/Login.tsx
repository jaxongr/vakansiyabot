import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Card, Divider, Typography } from 'antd';
import { api, setTokens } from '../api/client';

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME as string | undefined;
const IS_LOCAL = ['localhost', '127.0.0.1'].includes(window.location.hostname);

/**
 * Telegram Login Widget. Global callback orqali backendga yuboramiz.
 * ADMIN_TG_IDS tekshiruvi backendda (E1002 -> "siz admin emassiz").
 */
export function Login() {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (window as unknown as { onTelegramAuth: (u: unknown) => void }).onTelegramAuth = async (
      user,
    ) => {
      try {
        const res = await api.post('/auth/telegram-login', user);
        setTokens(res.data.data.accessToken, res.data.data.refreshToken);
        navigate('/');
      } catch (e) {
        const code = (e as { response?: { data?: { error?: { code?: string } } } }).response?.data
          ?.error?.code;
        setError(code === 'E1002' ? "Siz admin emassiz" : 'Kirishda xatolik');
      }
    };

    if (BOT_USERNAME && ref.current && !ref.current.hasChildNodes()) {
      const script = document.createElement('script');
      script.src = 'https://telegram.org/js/telegram-widget.js?22';
      script.async = true;
      script.setAttribute('data-telegram-login', BOT_USERNAME);
      script.setAttribute('data-size', 'large');
      script.setAttribute('data-radius', '10');
      script.setAttribute('data-onauth', 'onTelegramAuth(user)');
      script.setAttribute('data-request-access', 'write');
      ref.current.appendChild(script);
    }
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f4f4f8',
      }}
    >
      <Card style={{ width: 360, textAlign: 'center' }}>
        <Typography.Title level={3} style={{ color: '#6B46C1' }}>
          Vakansiya Admin
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          Boshqaruv paneliga kirish uchun Telegram orqali tasdiqlang
        </Typography.Paragraph>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
        <div ref={ref} style={{ display: 'flex', justifyContent: 'center' }} />
        {!BOT_USERNAME && (
          <Alert
            type="info"
            showIcon
            message="VITE_BOT_USERNAME sozlanmagan"
            description=".env ga bot username qo'shing, so'ng Telegram Login tugmasi paydo bo'ladi."
          />
        )}
        {IS_LOCAL && (
          <>
            <Divider plain style={{ color: '#999' }}>
              lokal demo
            </Divider>
            <Button
              block
              size="large"
              onClick={async () => {
                try {
                  const res = await api.post('/auth/dev-login');
                  setTokens(res.data.data.accessToken, res.data.data.refreshToken);
                  navigate('/');
                } catch {
                  setError('Dev login ishlamadi (backend ishlayaptimi?)');
                }
              }}
            >
              🔧 Dev kirish (faqat lokal)
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}

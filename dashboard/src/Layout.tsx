import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button, Layout as AntLayout, Menu } from 'antd';
import {
  ApiOutlined,
  AreaChartOutlined,
  DashboardOutlined,
  GlobalOutlined,
  LogoutOutlined,
  MergeCellsOutlined,
  MessageOutlined,
  ProfileOutlined,
  SendOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { clearTokens } from './api/client';

const items = [
  { key: '/', icon: <DashboardOutlined />, label: <Link to="/">Umumiy</Link> },
  { key: '/analytics', icon: <AreaChartOutlined />, label: <Link to="/analytics">Analitika</Link> },
  { key: '/channels', icon: <ApiOutlined />, label: <Link to="/channels">Kanallar</Link> },
  { key: '/web-sources', icon: <GlobalOutlined />, label: <Link to="/web-sources">Saytlar</Link> },
  { key: '/vacancies', icon: <ProfileOutlined />, label: <Link to="/vacancies">Vakansiyalar</Link> },
  { key: '/dedup', icon: <MergeCellsOutlined />, label: <Link to="/dedup">Dublikatlar</Link> },
  { key: '/telegram', icon: <SendOutlined />, label: <Link to="/telegram">Telegram</Link> },
  { key: '/sms', icon: <MessageOutlined />, label: <Link to="/sms">SMS</Link> },
  { key: '/system', icon: <SettingOutlined />, label: <Link to="/system">Tizim</Link> },
];

export function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const selected = items.find((i) => i.key === location.pathname)?.key ?? '/';

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <AntLayout.Sider breakpoint="lg" collapsedWidth={0} theme="light" width={220}>
        <div
          style={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            fontWeight: 700,
            fontSize: 17,
            color: '#6B46C1',
          }}
        >
          Vakansiya
        </div>
        <Menu mode="inline" selectedKeys={[selected]} items={items} style={{ border: 'none' }} />
      </AntLayout.Sider>
      <AntLayout>
        <AntLayout.Header
          style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingInline: 20,
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              clearTokens();
              navigate('/login');
            }}
          >
            Chiqish
          </Button>
        </AntLayout.Header>
        <AntLayout.Content style={{ padding: 20, background: '#f4f4f8' }}>
          {children}
        </AntLayout.Content>
      </AntLayout>
    </AntLayout>
  );
}

import { lazy, ReactNode, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spin } from 'antd';
import { Layout } from './Layout';
import { isAuthed } from './api/client';

const Overview = lazy(() => import('./pages/Overview').then((m) => ({ default: m.Overview })));
const Channels = lazy(() => import('./pages/Channels').then((m) => ({ default: m.Channels })));
const WebSources = lazy(() => import('./pages/WebSources').then((m) => ({ default: m.WebSources })));
const Vacancies = lazy(() => import('./pages/Vacancies').then((m) => ({ default: m.Vacancies })));
const Dedup = lazy(() => import('./pages/Dedup').then((m) => ({ default: m.Dedup })));
const System = lazy(() => import('./pages/System').then((m) => ({ default: m.System })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));

function Protected({ children }: { children: ReactNode }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

const fallback = <Spin size="large" style={{ display: 'block', margin: '120px auto' }} />;

export function App() {
  return (
    <HashRouter>
      <Suspense fallback={fallback}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Protected><Overview /></Protected>} />
          <Route path="/channels" element={<Protected><Channels /></Protected>} />
          <Route path="/web-sources" element={<Protected><WebSources /></Protected>} />
          <Route path="/vacancies" element={<Protected><Vacancies /></Protected>} />
          <Route path="/dedup" element={<Protected><Dedup /></Protected>} />
          <Route path="/system" element={<Protected><System /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

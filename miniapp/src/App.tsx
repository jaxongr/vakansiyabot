import { useEffect, useState } from 'react';
import { Navigate, Route, HashRouter, Routes, useNavigate } from 'react-router-dom';
import { Home } from './pages/Home';
import { VacancyPage } from './pages/VacancyPage';
import { ResumePage } from './pages/ResumePage';
import { Saved } from './pages/Saved';
import { Onboarding } from './pages/Onboarding';
import { getStartParam } from './telegram';

function StartParamHandler() {
  const navigate = useNavigate();
  const [handled, setHandled] = useState(false);
  useEffect(() => {
    if (handled) return;
    setHandled(true);
    const param = getStartParam();
    if (param?.startsWith('vacancy_')) {
      navigate(`/vacancy/${param.replace('vacancy_', '')}`);
    } else if (param?.startsWith('resume_')) {
      navigate(`/resume/${param.replace('resume_', '')}`);
    }
  }, [handled, navigate]);
  return null;
}

export function App() {
  const onboarded = localStorage.getItem('onboarded') === '1';
  return (
    <HashRouter>
      <StartParamHandler />
      <Routes>
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/" element={onboarded ? <Home /> : <Navigate to="/onboarding" replace />} />
        <Route path="/vacancy/:id" element={<VacancyPage />} />
        <Route path="/resume/:id" element={<ResumePage />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

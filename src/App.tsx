import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Annual from './pages/Annual';
import IncidentLedger from './pages/IncidentLedger';
import MonthlyBoard from './pages/MonthlyBoard';
import Observation from './pages/Observation';
import Policy from './pages/Policy';
import ScoreLedger from './pages/ScoreLedger';
import Team from './pages/Team';
import { useStore } from './store';

export default function App() {
  const { loaded, load } = useStore();

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">加载中…</div>;
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MonthlyBoard />} />
          <Route path="scores" element={<ScoreLedger />} />
          <Route path="incidents" element={<IncidentLedger />} />
          <Route path="annual" element={<Annual />} />
          <Route path="observe" element={<Observation />} />
          <Route path="team" element={<Team />} />
          <Route path="policy" element={<Policy />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

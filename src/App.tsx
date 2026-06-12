import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Toaster from './components/Toast';
import Annual from './pages/Annual';
import IncidentLedger from './pages/IncidentLedger';
import MonthlyBoard from './pages/MonthlyBoard';
import My from './pages/My';
import Observation from './pages/Observation';
import Policy from './pages/Policy';
import ScoreLedger from './pages/ScoreLedger';
import Team from './pages/Team';
import { useStore } from './store';

/** 成员身份默认进入「我的积分」,管理身份进入月度看板 */
function Home() {
  const { data, currentUserId } = useStore();
  const me = data.members.find((m) => m.id === currentUserId);
  return <Navigate to={me?.role === 'member' ? '/my' : '/board'} replace />;
}

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
          <Route index element={<Home />} />
          <Route path="my" element={<My />} />
          <Route path="board" element={<MonthlyBoard />} />
          <Route path="scores" element={<ScoreLedger />} />
          <Route path="incidents" element={<IncidentLedger />} />
          <Route path="annual" element={<Annual />} />
          <Route path="observe" element={<Observation />} />
          <Route path="team" element={<Team />} />
          <Route path="policy" element={<Policy />} />
        </Route>
      </Routes>
      <Toaster />
    </HashRouter>
  );
}

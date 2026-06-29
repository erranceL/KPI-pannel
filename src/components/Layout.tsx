import { NavLink, Outlet } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  CircleUser,
  ClipboardList,
  Eye,
  LayoutDashboard,
  Trophy,
  Users,
} from 'lucide-react';
import { useStore } from '../store';
import type { Role } from '../lib/types';
import { ROLE_LABEL } from '../lib/types';

const NAV = [
  { to: '/my', label: '我的积分', icon: CircleUser, roles: ['member', 'lead', 'architect', 'cto'] },
  { to: '/board', label: '看板', icon: LayoutDashboard, roles: ['member', 'lead', 'architect', 'cto'] },
  { to: '/scores', label: '积分台账', icon: ClipboardList, roles: ['lead', 'architect', 'cto'] },
  { to: '/incidents', label: '问题与事故', icon: AlertTriangle, roles: ['lead', 'architect', 'cto'] },
  { to: '/annual', label: '年度视图', icon: Trophy, roles: ['architect', 'cto'] },
  { to: '/observe', label: '试运行观察', icon: Eye, roles: ['architect', 'cto'] },
  { to: '/team', label: '团队设置', icon: Users, roles: ['architect', 'cto'] },
  { to: '/policy', label: '制度 v2.3', icon: BookOpen, roles: ['member', 'lead', 'architect', 'cto'] },
] as const;

export default function Layout() {
  const { data, currentUserId, setCurrentUser } = useStore();
  const me = data.members.find((m) => m.id === currentUserId);
  const role: Role = me?.role ?? 'member';

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-52 flex-col border-r border-slate-200 bg-white">
        <div className="px-5 py-5">
          <div className="text-lg font-bold text-indigo-700">KPI 面板</div>
          <div className="mt-0.5 text-xs text-slate-400">研发绩效积分 · v2.3 试行</div>
        </div>
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.filter((n) => (n.roles as readonly string[]).includes(role)).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              <n.icon size={16} strokeWidth={1.8} />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-100 p-4">
          <div className="mb-1.5 text-xs text-slate-400">当前身份</div>
          <select
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm transition-colors focus:border-indigo-500 focus:outline-none"
            value={currentUserId}
            onChange={(e) => setCurrentUser(e.target.value)}
          >
            {data.members
              .filter((m) => m.active)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} · {ROLE_LABEL[m.role]}
                </option>
              ))}
          </select>
          {me && (
            <div className="mt-2 text-xs text-slate-400">
              {me.squad} / {me.level === 'unmapped' ? '职级未映射' : me.level}
            </div>
          )}
        </div>
      </aside>
      <main className="ml-52 flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}

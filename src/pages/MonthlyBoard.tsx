import { useMemo, useState } from 'react';
import { Badge, Card, EmptyHint, Info, MonthPicker, btnPrimary } from '../components/ui';
import { currentMonth, monthlyTotals, tenureMonths, todayISO } from '../lib/rules';
import { canArchive, isManager, useCurrentMember, useStore } from '../store';

type ViewMode = 'detail' | 'anonymous' | 'range';

export default function MonthlyBoard() {
  const { data, archiveMonth } = useStore();
  const me = useCurrentMember();
  const [month, setMonth] = useState(currentMonth());
  const manager = isManager(me);
  const [mode, setMode] = useState<ViewMode>(manager ? 'detail' : 'anonymous');

  const archived = data.archivedMonths.includes(month);
  const totals = useMemo(() => monthlyTotals(data, month).sort((a, b) => b.total - a.total), [data, month]);
  const memberOf = (id: string) => data.members.find((m) => m.id === id);

  const modes: { key: ViewMode; label: string; allowed: boolean }[] = [
    { key: 'detail', label: '实名明细(管理)', allowed: manager },
    { key: 'anonymous', label: '匿名排名(公示)', allowed: true },
    { key: 'range', label: '总分区间(公示)', allowed: true },
  ];

  const ranges = [
    { label: '120 分以上', min: 120, max: Infinity },
    { label: '80–119 分', min: 80, max: 119.9 },
    { label: '40–79 分', min: 40, max: 79.9 },
    { label: '0–39 分', min: 0, max: 39.9 },
    { label: '负分', min: -Infinity, max: -0.1 },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">月度看板</h1>
        <MonthPicker value={month} onChange={setMonth} />
        {archived ? (
          <Badge color="violet">已归档(8.1)</Badge>
        ) : (
          canArchive(me) && (
            <button
              className={btnPrimary}
              onClick={() => {
                if (confirm(`确认归档 ${month}?归档后本月记录锁定,不可再修改(8.1)。`)) archiveMonth(month);
              }}
            >
              归档本月
            </button>
          )
        )}
        <div className="flex-1" />
        <div className="flex gap-1 rounded-lg bg-slate-200/70 p-1">
          {modes
            .filter((m) => m.allowed)
            .map((m) => (
              <button
                key={m.key}
                className={`rounded-md px-3 py-1 text-xs font-medium ${
                  mode === m.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
                onClick={() => setMode(m.key)}
              >
                {m.label}
              </button>
            ))}
        </div>
      </div>

      <Info>
        月度总分 = 正分 + 运维杂项 − 扣分 − Lead 连带;公示期 2 个工作日,异议找架构师仲裁(8.1);试运行期间全员仅公示区间或匿名排名(8.2)。
      </Info>

      {totals.length === 0 ? (
        <Card>
          <EmptyHint text="暂无数据" />
        </Card>
      ) : mode === 'range' ? (
        <Card title={`${month} 总分区间公示`}>
          <div className="space-y-3">
            {ranges.map((r) => {
              const names = totals.filter((t) => t.total >= r.min && t.total <= r.max);
              if (!names.length) return null;
              return (
                <div key={r.label} className="flex items-start gap-4">
                  <div className="w-28 shrink-0 pt-0.5 text-sm font-medium text-slate-500">{r.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {names.map((t) => {
                      const m = memberOf(t.memberId);
                      const isMe = me?.id === t.memberId;
                      return (
                        <Badge key={t.memberId} color={isMe ? 'blue' : 'slate'}>
                          {manager || isMe ? m?.name : '●'}
                          {isMe && '(我)'}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card title={`${month} ${mode === 'detail' ? '实名明细' : '匿名排名'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th className="py-2 pr-3">#</th>
                  <th className="py-2 pr-3">{mode === 'detail' ? '姓名 / 端' : '成员'}</th>
                  <th className="py-2 pr-3 text-right">正分</th>
                  <th className="py-2 pr-3 text-right">运维</th>
                  <th className="py-2 pr-3 text-right">扣分</th>
                  <th className="py-2 pr-3 text-right">连带</th>
                  <th className="py-2 pr-3 text-right">总分</th>
                  <th className="py-2">备注</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((t, idx) => {
                  const m = memberOf(t.memberId);
                  const isMe = me?.id === t.memberId;
                  const newbie = m && tenureMonths(m.joinDate, todayISO()) < 3;
                  const show = mode === 'detail' || isMe;
                  return (
                    <tr key={t.memberId} className={`border-b border-slate-50 ${isMe ? 'bg-indigo-50/50' : ''}`}>
                      <td className="py-2 pr-3 text-slate-400">{newbie ? '—' : idx + 1}</td>
                      <td className="py-2 pr-3 font-medium">
                        {show ? `${m?.name}${mode !== 'detail' ? '(我)' : ''}` : `成员 ${String.fromCharCode(65 + idx)}`}
                        {mode === 'detail' && <span className="ml-1 text-xs text-slate-400">{m?.squad}</span>}
                        {newbie && (
                          <Badge color="green">保护期不参与排名</Badge>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-right">{t.positive}</td>
                      <td className="py-2 pr-3 text-right text-slate-500">{t.ops}</td>
                      <td className="py-2 pr-3 text-right text-red-600">{t.deduction ? `−${t.deduction}` : '0'}</td>
                      <td className="py-2 pr-3 text-right text-red-400">{t.leadLiability ? `−${t.leadLiability}` : '—'}</td>
                      <td className="py-2 pr-3 text-right text-base font-bold">{t.total}</td>
                      <td className="py-2 text-xs text-slate-400">{show && t.deduction > 0 ? '扣分明细见问题与事故台账' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

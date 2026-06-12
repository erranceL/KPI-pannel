import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, ChevronLeft, ChevronRight } from 'lucide-react';
import { Badge, Card, ConfirmDialog, EmptyHint, Info, MonthStepper, PageHeader, btnGhost } from '../components/ui';
import { addMonths, currentMonth, round1, tenureMonths, todayISO, totalsInRange } from '../lib/rules';
import { canArchive, isManager, useCurrentMember, useStore } from '../store';

type ViewMode = 'detail' | 'anonymous' | 'range';
type Period = 'month' | 'quarter' | 'year';

/** 周期对应的月份区间与展示标签(anchor 为 YYYY-MM) */
function periodInfo(period: Period, anchor: string) {
  const [y, m] = anchor.split('-').map(Number);
  if (period === 'quarter') {
    const q = Math.floor((m - 1) / 3);
    const start = `${y}-${String(q * 3 + 1).padStart(2, '0')}`;
    return { from: `${start}-01`, to: `${addMonths(start, 2)}-31`, label: `${y} Q${q + 1}`, months: 3 };
  }
  if (period === 'year') {
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y}年`, months: 12 };
  }
  return { from: `${anchor}-01`, to: `${anchor}-31`, label: `${y}年${m}月`, months: 1 };
}

export default function MonthlyBoard() {
  const { data, archiveMonth, notify } = useStore();
  const me = useCurrentMember();
  const [month, setMonth] = useState(currentMonth());
  const [period, setPeriod] = useState<Period>('month');
  const manager = isManager(me);
  const [mode, setMode] = useState<ViewMode>(manager ? 'detail' : 'anonymous');
  const [confirmArchive, setConfirmArchive] = useState(false);

  const { from, to, label, months } = periodInfo(period, month);
  const archived = data.archivedMonths.includes(month);
  const totals = useMemo(() => totalsInRange(data, from, to).sort((a, b) => b.total - a.total), [data, from, to]);
  const memberOf = (id: string) => data.members.find((m) => m.id === id);

  const summary = useMemo(() => {
    const positive = round1(totals.reduce((a, t) => a + t.positive + t.ops, 0));
    const deduction = round1(totals.reduce((a, t) => a + t.deduction + t.leadLiability, 0));
    const periodScores = data.scores.filter((s) => s.date >= from && s.date <= to && s.tier !== 'ops');
    const pendingXl = periodScores.filter((s) => s.tier === 'xlarge' && !s.xlConfirmedBy).length;
    return { positive, deduction, count: periodScores.length, pendingXl };
  }, [data, from, to, totals]);

  const modes: { key: ViewMode; label: string; allowed: boolean }[] = [
    { key: 'detail', label: '实名明细', allowed: manager },
    { key: 'anonymous', label: '匿名排名', allowed: true },
    { key: 'range', label: '总分区间', allowed: true },
  ];

  // 区间阈值随周期长度等比放大(口径仍是月度 120/80/40)
  const k = months;
  const ranges = [
    { label: `${120 * k} 分以上`, min: 120 * k, max: Infinity },
    { label: `${80 * k}–${120 * k - 1} 分`, min: 80 * k, max: 120 * k - 0.1 },
    { label: `${40 * k}–${80 * k - 1} 分`, min: 40 * k, max: 80 * k - 0.1 },
    { label: `0–${40 * k - 1} 分`, min: 0, max: 40 * k - 0.1 },
    { label: '负分', min: -Infinity, max: -0.1 },
  ];

  const periods: { key: Period; label: string }[] = [
    { key: 'month', label: '月' },
    { key: 'quarter', label: '季' },
    { key: 'year', label: '年' },
  ];
  const stepBtn =
    'flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-200/70 hover:text-slate-700';

  return (
    <div className="space-y-4">
      <PageHeader
        title="看板"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-slate-200/70 p-1">
              {modes
                .filter((m) => m.allowed)
                .map((m) => (
                  <button
                    key={m.key}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                      mode === m.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                    onClick={() => setMode(m.key)}
                  >
                    {m.label}
                  </button>
                ))}
            </div>
            {period === 'month' && !archived && canArchive(me) && (
              <button className={btnGhost} onClick={() => setConfirmArchive(true)}>
                <Archive size={14} /> 归档本月
              </button>
            )}
          </div>
        }
      >
        <div className="flex gap-1 rounded-lg bg-slate-200/70 p-1">
          {periods.map((p) => (
            <button
              key={p.key}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                period === p.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setPeriod(p.key)}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'month' ? (
          <MonthStepper value={month} onChange={setMonth} />
        ) : (
          <div className="flex items-center rounded-lg border border-slate-200 bg-white px-1 py-0.5">
            <button className={stepBtn} onClick={() => setMonth(addMonths(month, -months))} title="上一周期">
              <ChevronLeft size={16} />
            </button>
            <span className="w-[7.2rem] text-center text-sm font-medium text-slate-700">{label}</span>
            <button className={stepBtn} onClick={() => setMonth(addMonths(month, months))} title="下一周期">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        {period === 'month' && archived && <Badge color="amber">已归档 · 记录锁定</Badge>}
      </PageHeader>

      {manager && (
        <div className="grid grid-cols-4 gap-3">
          <SummaryCard label="团队正分" value={summary.positive} />
          <SummaryCard label="团队扣分" value={summary.deduction} red={summary.deduction > 0} />
          <SummaryCard label="事项数" value={summary.count} />
          <Link to="/scores" className="block">
            <div
              className={`h-full rounded-xl border p-4 transition-colors ${
                summary.pendingXl > 0
                  ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/70'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="text-xs text-slate-400">待确认特大档</div>
              <div className={`mt-1 text-2xl font-bold tabular-nums ${summary.pendingXl > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                {summary.pendingXl}
              </div>
            </div>
          </Link>
        </div>
      )}

      <Info>
        {period === 'month'
          ? '月度总分 = 正分 + 运维杂项 − 扣分 − Lead 连带;公示期 2 个工作日,异议找架构师仲裁(8.1);试运行期间全员仅公示区间或匿名排名(8.2)。'
          : `${period === 'quarter' ? '季度' : '年度'}视图为该周期内各月记录的累加,口径与月度一致;归档、公示与申诉仍按月进行(8.1)。`}
      </Info>

      {totals.length === 0 ? (
        <Card>
          <EmptyHint text="暂无数据" />
        </Card>
      ) : mode === 'range' ? (
        <Card title={`${label} 总分区间公示`}>
          <div className="space-y-3">
            {ranges.map((r) => {
              const names = totals.filter((t) => t.total >= r.min && t.total <= r.max);
              if (!names.length) return null;
              return (
                <div key={r.label} className="flex items-start gap-4">
                  <div className="w-32 shrink-0 pt-0.5 text-sm font-medium tabular-nums text-slate-500">{r.label}</div>
                  <div className="flex flex-wrap gap-2">
                    {names.map((t) => {
                      const m = memberOf(t.memberId);
                      const isMe = me?.id === t.memberId;
                      return (
                        <Badge key={t.memberId} color={isMe ? 'green' : 'slate'}>
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
        <Card title={`${label} ${mode === 'detail' ? '实名明细' : '匿名排名'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">{mode === 'detail' ? '姓名 / 端' : '成员'}</th>
                  <th className="py-2 pr-3 text-right font-medium">正分</th>
                  <th className="py-2 pr-3 text-right font-medium">运维</th>
                  <th className="py-2 pr-3 text-right font-medium">扣分</th>
                  <th className="py-2 pr-3 text-right font-medium">连带</th>
                  <th className="py-2 pr-3 text-right font-medium">总分</th>
                  <th className="py-2 font-medium">备注</th>
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
                      <td className="py-2.5 pr-3 tabular-nums text-slate-400">{newbie ? '—' : idx + 1}</td>
                      <td className="py-2.5 pr-3 font-medium">
                        {show ? `${m?.name}${mode !== 'detail' ? '(我)' : ''}` : `成员 ${String.fromCharCode(65 + idx)}`}
                        {mode === 'detail' && <span className="ml-1 text-xs text-slate-400">{m?.squad}</span>}
                        {newbie && <Badge color="green">保护期不参与排名</Badge>}
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{t.positive}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-500">{t.ops}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-red-600">{t.deduction ? `−${t.deduction}` : '0'}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-red-400">{t.leadLiability ? `−${t.leadLiability}` : '—'}</td>
                      <td className="py-2.5 pr-3 text-right text-base font-bold tabular-nums">{t.total}</td>
                      <td className="py-2.5 text-xs text-slate-400">{show && t.deduction > 0 ? '扣分明细见问题与事故台账' : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {confirmArchive && (
        <ConfirmDialog
          title={`归档 ${month}?`}
          message="归档后本月的积分与事故记录将锁定,不可再修改(8.1);已归档积分不追溯(伪造、刷分除外)。"
          confirmLabel="归档"
          onConfirm={() => {
            archiveMonth(month);
            notify(`${month} 已归档`);
          }}
          onClose={() => setConfirmArchive(false)}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, red }: { label: string; value: number; red?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold tabular-nums ${red ? 'text-red-600' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Badge, Card, EmptyHint, MonthStepper, PageHeader } from '../components/ui';
import {
  INCIDENT_LABEL,
  LIABILITY_LABEL,
  TIER_LABEL,
  addMonths,
  computeDeduction,
  currentMonth,
  deliveryFactor,
  monthOf,
  monthlyTotals,
  scoreFinal,
} from '../lib/rules';
import type { ScoreEntry } from '../lib/types';
import { useCurrentMember, useStore } from '../store';

function deliveryText(s: ScoreEntry): string {
  if (s.tier === 'online' || s.tier === 'ops') return '';
  if (s.delivery === 'zero') return '未交付';
  const f = deliveryFactor(s);
  return f >= 1 ? '全额' : `${Math.round(f * 100)}%`;
}

export default function My() {
  const { data } = useStore();
  const me = useCurrentMember();
  const [month, setMonth] = useState(currentMonth());

  const myTotal = useMemo(() => monthlyTotals(data, month).find((t) => t.memberId === me?.id), [data, month, me]);

  const myScores = useMemo(
    () =>
      data.scores
        .filter((s) => s.memberId === me?.id && monthOf(s.date) === month)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [data, month, me],
  );

  const myIncidents = useMemo(
    () => data.incidents.filter((i) => i.memberId === me?.id && monthOf(i.date) === month),
    [data, month, me],
  );

  // 近 6 个月趋势(纯 CSS 条形)
  const trend = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(month, i - 5));
    return months.map((m) => ({
      month: m,
      total: monthlyTotals(data, m).find((t) => t.memberId === me?.id)?.total ?? 0,
    }));
  }, [data, month, me]);
  const trendMax = Math.max(1, ...trend.map((t) => Math.abs(t.total)));

  if (!me) return null;

  const deductionTotal = (myTotal?.deduction ?? 0) + (myTotal?.leadLiability ?? 0);
  const leadBonus = myTotal?.leadBonus ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader title="我的积分">
        <MonthStepper value={month} onChange={setMonth} />
      </PageHeader>

      <div className={`grid gap-3 ${leadBonus > 0 ? 'grid-cols-5' : 'grid-cols-4'}`}>
        <div className="rounded-xl bg-indigo-600 p-5 text-white">
          <div className="text-xs text-indigo-200">本月总分</div>
          <div className="mt-1 text-3xl font-bold tabular-nums">{myTotal?.total ?? 0}</div>
        </div>
        <StatCard label="事项正分" value={myTotal?.positive ?? 0} />
        <StatCard label="运维杂项" value={myTotal?.ops ?? 0} />
        {leadBonus > 0 && <StatCard label="管理加成(7.3)" value={leadBonus} />}
        <StatCard label="扣分" value={deductionTotal > 0 ? -deductionTotal : 0} red={deductionTotal > 0} />
      </div>

      <Card title="近 6 个月走势">
        <div className="flex h-28 items-end gap-3 px-2">
          {trend.map((t) => (
            <div key={t.month} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="text-xs font-medium tabular-nums text-slate-500">{t.total}</div>
              <div
                className={`w-full max-w-14 rounded-md ${t.total < 0 ? 'bg-red-300' : t.month === month ? 'bg-indigo-500' : 'bg-indigo-200'}`}
                style={{ height: `${Math.max(4, (Math.abs(t.total) / trendMax) * 72)}px` }}
              />
              <div className="text-xs text-slate-400">{Number(t.month.slice(5))}月</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={`本月事项 · ${myScores.length} 条`}>
        {myScores.length === 0 ? (
          <EmptyHint text="本月还没有记录" />
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {myScores.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 pr-3 whitespace-nowrap text-slate-400">{s.date.slice(5)}</td>
                  <td className="py-2.5 pr-3">
                    <div>{s.title}</div>
                    {(s.tierReason || s.note) && <div className="text-xs text-slate-400">{s.tierReason || s.note}</div>}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <Badge>{TIER_LABEL[s.tier]} {s.points}</Badge>
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-slate-400">{deliveryText(s)}</td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">{scoreFinal(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={`本月问题与扣分 · ${myIncidents.length} 条`}>
        {myIncidents.length === 0 ? (
          <EmptyHint text="本月没有问题记录" />
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {myIncidents.map((i) => {
                const r = computeDeduction(i, me, data.scores);
                return (
                  <tr key={i.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-slate-400">{i.date.slice(5)}</td>
                    <td className="py-2.5 pr-3">
                      <div>{i.title}</div>
                      <div className="text-xs text-slate-400">{i.category}</div>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <Badge color={i.level === 'minor' ? 'slate' : 'red'}>{INCIDENT_LABEL[i.level]}</Badge>
                      {i.redline && <Badge color="red">红线</Badge>}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-slate-400">
                      {LIABILITY_LABEL[i.liability]}
                    </td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-red-600">
                      {r.final > 0 ? `−${r.final}` : '不扣分'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="mt-3 text-xs text-slate-400">对分数有异议?公示 2 天内找架构师,搞不定升级 CTO(10.3)。</div>
      </Card>
    </div>
  );
}

function StatCard({ label, value, red }: { label: string; value: number; red?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${red ? 'text-red-600' : 'text-slate-800'}`}>{value}</div>
    </div>
  );
}

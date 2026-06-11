import { useMemo, useState } from 'react';
import { Badge, Card, EmptyHint, Info, MonthPicker } from '../components/ui';
import {
  TIER_LABEL,
  addMonths,
  currentMonth,
  repeatedMinors,
  rescheduleStats,
  tierStatsBySquad,
} from '../lib/rules';
import type { Tier } from '../lib/types';
import { useStore } from '../store';

const TIER_COLORS: Record<Tier, string> = {
  small: 'bg-slate-300',
  medium: 'bg-sky-400',
  large: 'bg-indigo-500',
  xlarge: 'bg-violet-600',
  ops: 'bg-slate-200',
};

export default function Observation() {
  const { data } = useStore();
  const [from, setFrom] = useState(addMonths(currentMonth(), -2));
  const [to, setTo] = useState(currentMonth());

  const tierStats = useMemo(() => tierStatsBySquad(data, from, to), [data, from, to]);
  const reschedules = useMemo(() => rescheduleStats(data, from, to), [data, from, to]);
  const minors = useMemo(() => repeatedMinors(data, from, to), [data, from, to]);
  const memberName = (id: string) => data.members.find((m) => m.id === id)?.name ?? id;

  const avgLargeShare = tierStats.length
    ? tierStats.reduce((a, s) => a + s.largeShare, 0) / tierStats.length
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">试运行观察(10.1)</h1>
        <MonthPicker value={from} onChange={setFrom} />
        <span className="text-slate-400">至</span>
        <MonthPicker value={to} onChange={setTo} />
      </div>

      <Info>
        架构师按月跟踪四项指标,作为转正式版的修订输入:大档占比、重排期次数、小问题重复未改进、各端定档尺度一致性。
      </Info>

      <div className="grid grid-cols-2 gap-4">
        <Card title="指标一:大档占比是否异常偏高">
          {tierStats.length === 0 ? (
            <EmptyHint text="区间内无数据" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th className="py-2 pr-3">端</th>
                  <th className="py-2 pr-3 text-right">事项数</th>
                  <th className="py-2 pr-3 text-right">大档及以上占比(条数)</th>
                  <th className="py-2 pr-3 text-right">占比(分值)</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {tierStats.map((s) => (
                  <tr key={s.squad} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-medium">{s.squad}</td>
                    <td className="py-2 pr-3 text-right">{s.total}</td>
                    <td className="py-2 pr-3 text-right">{(s.largeShare * 100).toFixed(0)}%</td>
                    <td className="py-2 pr-3 text-right">{(s.largePointShare * 100).toFixed(0)}%</td>
                    <td className="py-2">
                      {s.largeShare > Math.max(0.4, avgLargeShare * 1.5) && (
                        <Badge color="amber">明显高于均值,建议抽查(3.2)</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="指标四:各端定档尺度对比">
          {tierStats.length === 0 ? (
            <EmptyHint text="区间内无数据" />
          ) : (
            <div className="space-y-3">
              {tierStats.map((s) => (
                <div key={s.squad}>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>{s.squad}</span>
                    <span>{s.total} 项</span>
                  </div>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
                    {(['small', 'medium', 'large', 'xlarge'] as Tier[]).map((t) =>
                      s.counts[t] > 0 ? (
                        <div
                          key={t}
                          className={TIER_COLORS[t]}
                          style={{ width: `${(s.counts[t] / s.total) * 100}%` }}
                          title={`${TIER_LABEL[t]} ${s.counts[t]} 项`}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-1 text-xs text-slate-500">
                {(['small', 'medium', 'large', 'xlarge'] as Tier[]).map((t) => (
                  <span key={t} className="flex items-center gap-1">
                    <span className={`inline-block h-2.5 w-2.5 rounded-sm ${TIER_COLORS[t]}`} />
                    {TIER_LABEL[t]}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="指标二:重排期是否过多(3.5)">
          {reschedules.length === 0 ? (
            <EmptyHint text="区间内无重排期记录" />
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {reschedules.map(({ entry, overLimit }) => (
                  <tr key={entry.id} className="border-b border-slate-50">
                    <td className="py-2 pr-3 text-slate-500">{entry.date}</td>
                    <td className="py-2 pr-3 font-medium">{memberName(entry.memberId)}</td>
                    <td className="py-2 pr-3">{entry.title}</td>
                    <td className="py-2 text-right">
                      <Badge color={overLimit ? 'red' : 'amber'}>
                        重排 ×{entry.reschedules}
                        {overLimit && ' · 须架构师复核'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="指标三:小问题重复但无流程改进(4.4)">
          {minors.length === 0 ? (
            <EmptyHint text="区间内无重复小问题" />
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {minors.map((r) => (
                  <tr key={`${r.memberId}-${r.category}`} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-medium">{memberName(r.memberId)}</td>
                    <td className="py-2 pr-3">{r.category}</td>
                    <td className="py-2 pr-3 text-right">×{r.count}</td>
                    <td className="py-2 text-right">
                      {r.hasChecklist ? (
                        <Badge color="red">已有规范仍重复,应按 P2 处理</Badge>
                      ) : (
                        <Badge color="amber">尚无规范,优先补充流程</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}

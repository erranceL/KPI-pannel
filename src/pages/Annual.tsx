import { useMemo, useState } from 'react';
import { Badge, Card, Info, Warn, inputCls } from '../components/ui';
import {
  GRADE_FACTOR,
  LEVEL_FACTOR,
  annualTotals,
  gradeHints,
  round1,
  simulateBonus,
  suggestRisk,
  tokenQuota,
} from '../lib/rules';
import type { Grade } from '../lib/types';
import { LEVEL_LABEL } from '../lib/types';
import { isManager, useCurrentMember, useStore } from '../store';

const GRADES: Grade[] = ['S', 'A', 'B', 'C', 'D'];

export default function Annual() {
  const { data, setAnnualConfig, setAnnualMember } = useStore();
  const me = useCurrentMember();
  const manager = isManager(me);
  const thisYear = String(new Date().getFullYear());
  const [year, setYear] = useState(thisYear);

  const cfg = data.annual[year] ?? { budget: 0, coefficient: 1, perMember: {} };
  const totals = useMemo(() => annualTotals(data, year).sort((a, b) => b.effective - a.effective), [data, year]);
  const hints = useMemo(() => gradeHints(data, year), [data, year]);
  const memberOf = (id: string) => data.members.find((m) => m.id === id);
  const hintOf = (id: string) => hints.find((h) => h.memberId === id);
  const gradeOf = (id: string): Grade => cfg.perMember[id]?.grade ?? hintOf(id)?.suggested ?? 'B';

  const bonus = useMemo(
    () => simulateBonus(data, year, cfg.budget, cfg.coefficient),
    [data, year, cfg.budget, cfg.coefficient],
  );

  const years = useMemo(() => {
    const set = new Set<string>([thisYear]);
    for (const s of data.scores) set.add(s.date.slice(0, 4));
    return [...set].sort().reverse();
  }, [data, thisYear]);

  if (!manager) {
    const mine = totals.find((t) => t.memberId === me?.id);
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">年度视图</h1>
        <Info>年度评级与分配由评级会(CTO + 架构师 + 各端 Lead)处理(9.1);你可以查看本人年度积分。</Info>
        <Card title={`${year} 我的年度积分`}>
          {mine ? (
            <div className="grid grid-cols-3 gap-4 text-center">
              <Stat label="年度正分" value={mine.allPositive} />
              <Stat label="年度扣分" value={mine.deduction + mine.leadLiability} red />
              <Stat label="年度有效积分" value={mine.effective} big />
            </div>
          ) : (
            <div className="text-sm text-slate-400">暂无数据</div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">年度视图</h1>
        <select className={inputCls + ' w-auto'} value={year} onChange={(e) => setYear(e.target.value)}>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </div>

      <Card title="年度有效积分与评级(9.1)">
        <Info>
          年度有效积分 = max(正分 − 扣分, 0);积分排名是必要条件而非充分条件,评级由评级会确定;P0 主责封顶 B,红线暂缓评定。
        </Info>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">姓名 / 端 / 职级</th>
                <th className="py-2 pr-3 text-right">正分</th>
                <th className="py-2 pr-3 text-right">扣分</th>
                <th className="py-2 pr-3 text-right">有效积分</th>
                <th className="py-2 pr-3">否决/提示</th>
                <th className="py-2 pr-3">建议</th>
                <th className="py-2 pr-3">评级</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t, idx) => {
                const m = memberOf(t.memberId);
                const h = hintOf(t.memberId);
                const pct = h ? h.percentile : 1;
                return (
                  <tr key={t.memberId} className="border-b border-slate-50">
                    <td className="py-2 pr-3 text-slate-400">
                      {idx + 1}
                      {pct <= 0.15 && <span className="ml-1 text-xs text-emerald-600">前15%</span>}
                      {pct > 0.15 && pct <= 0.4 && <span className="ml-1 text-xs text-sky-600">前40%</span>}
                    </td>
                    <td className="py-2 pr-3 font-medium">
                      {m?.name}
                      <span className="ml-1 text-xs text-slate-400">
                        {m?.squad} / {m ? LEVEL_LABEL[m.level] : ''}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-right">{t.allPositive}</td>
                    <td className="py-2 pr-3 text-right text-red-600">−{round1(t.deduction + t.leadLiability)}</td>
                    <td className="py-2 pr-3 text-right font-bold">{t.effective}</td>
                    <td className="py-2 pr-3 space-x-1">
                      {h?.redline && <Badge color="red">红线·暂缓评定</Badge>}
                      {h?.p0Primary && <Badge color="amber">P0 主责·封顶 B</Badge>}
                      {h?.p1Primary && !h.p0Primary && <Badge color="amber">P1 主责</Badge>}
                      {h?.belowHalfMedian && <Badge color="slate">低于中位数 50%</Badge>}
                    </td>
                    <td className="py-2 pr-3">
                      <Badge color="slate">{h?.suggested}</Badge>
                    </td>
                    <td className="py-2 pr-3">
                      <select
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        value={gradeOf(t.memberId)}
                        onChange={(e) => setAnnualMember(year, t.memberId, { grade: e.target.value as Grade })}
                      >
                        {GRADES.map((g) => (
                          <option key={g} value={g}>
                            {g}(×{GRADE_FACTOR[g]})
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="年终奖模拟(9.2)">
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <label className="text-sm">
            <div className="mb-1 text-xs text-slate-500">公司年度奖金预算</div>
            <input
              type="number"
              className={inputCls + ' w-40'}
              value={cfg.budget || ''}
              placeholder="如 1000000"
              onChange={(e) => setAnnualConfig(year, { budget: Number(e.target.value) })}
            />
          </label>
          <label className="text-sm">
            <div className="mb-1 text-xs text-slate-500">经营系数(0–1.2)</div>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1.2}
              className={inputCls + ' w-28'}
              value={cfg.coefficient}
              onChange={(e) => setAnnualConfig(year, { coefficient: Math.min(1.2, Math.max(0, Number(e.target.value))) })}
            />
          </label>
          <div className="text-sm">
            实际总池 = <span className="text-lg font-bold text-indigo-700">{bonus.pool.toLocaleString()}</span>
          </div>
        </div>
        {bonus.zeroDenominator ? (
          <Warn>全员年度正向积分总和为 0,不按公式分配,由管理层另行决定(9.2)。</Warn>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                    <th className="py-2 pr-3">姓名</th>
                    <th className="py-2 pr-3 text-right">有效积分(分子)</th>
                    <th className="py-2 pr-3 text-right">占正分总和比例</th>
                    <th className="py-2 pr-3 text-right">模拟年终奖</th>
                    <th className="py-2">提示</th>
                  </tr>
                </thead>
                <tbody>
                  {bonus.rows
                    .slice()
                    .sort((a, b) => b.share - a.share)
                    .map((r) => (
                      <tr key={r.memberId} className="border-b border-slate-50">
                        <td className="py-2 pr-3 font-medium">{memberOf(r.memberId)?.name}</td>
                        <td className="py-2 pr-3 text-right">{r.effective}</td>
                        <td className="py-2 pr-3 text-right text-slate-500">
                          {bonus.totalPositive ? ((r.effective / bonus.totalPositive) * 100).toFixed(1) : 0}%
                        </td>
                        <td className="py-2 pr-3 text-right font-semibold">{r.share.toLocaleString()}</td>
                        <td className="py-2">{r.over3x && <Badge color="amber">超平均 3 倍,需复核数据真实性</Badge>}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex gap-6 text-sm text-slate-500">
              <span>
                分母(全员正分总和):<b>{bonus.totalPositive}</b>
              </span>
              <span>
                已分配:<b>{bonus.distributed.toLocaleString()}</b>
              </span>
              <span>
                因扣分留存公司:<b className="text-slate-700">{bonus.retained.toLocaleString()}</b>(不二次分配,9.2)
              </span>
            </div>
          </>
        )}
      </Card>

      <Card title="Token 配额模拟(9.3)">
        <Info>
          个人 Token 配额 = 岗位基础配额 × 职级系数 × 年度绩效系数 × 长期贡献系数 × 风险调整系数;职级未映射前一律按 1.0。
        </Info>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th className="py-2 pr-3">姓名</th>
                <th className="py-2 pr-3">基础配额</th>
                <th className="py-2 pr-3 text-right">职级</th>
                <th className="py-2 pr-3 text-right">绩效</th>
                <th className="py-2 pr-3">长期贡献(0.8–1.5)</th>
                <th className="py-2 pr-3">风险(0–1)</th>
                <th className="py-2 pr-3 text-right">配额</th>
              </tr>
            </thead>
            <tbody>
              {totals.map((t) => {
                const m = memberOf(t.memberId);
                if (!m) return null;
                const p = cfg.perMember[t.memberId] ?? {};
                const grade = gradeOf(t.memberId);
                const riskSug = suggestRisk(data, t.memberId, year);
                const base = p.baseQuota ?? 100;
                const longTerm = p.longTerm ?? 1;
                const risk = p.risk ?? riskSug.value;
                return (
                  <tr key={t.memberId} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-medium">{m.name}</td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        value={base}
                        onChange={(e) => setAnnualMember(year, t.memberId, { baseQuota: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-3 text-right">
                      ×{LEVEL_FACTOR[m.level]}
                      {m.level === 'unmapped' && <div className="text-xs text-amber-600">未映射按 1.0</div>}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {grade} ×{GRADE_FACTOR[grade]}
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step={0.05}
                        min={0.8}
                        max={1.5}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        value={longTerm}
                        onChange={(e) => setAnnualMember(year, t.memberId, { longTerm: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-2 pr-3">
                      <input
                        type="number"
                        step={0.05}
                        min={0}
                        max={1}
                        className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        value={risk}
                        onChange={(e) => setAnnualMember(year, t.memberId, { risk: Number(e.target.value) })}
                      />
                      <div className="text-xs text-slate-400">{riskSug.reason}</div>
                    </td>
                    <td className="py-2 pr-3 text-right text-base font-bold">
                      {tokenQuota(base, m.level === 'unmapped' ? 'L2' : m.level, grade, longTerm, risk)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-xs text-slate-400">
          归属周期 4 年、1 年 cliff,离职与税务以 Token 授予协议为准(9.4);长期贡献系数由 CTO 逐项书面说明后填入。
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, red, big }: { label: string; value: number; red?: boolean; big?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 font-bold ${big ? 'text-2xl text-indigo-700' : 'text-xl'} ${red ? 'text-red-600' : ''}`}>
        {value}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Badge, Card, Info, PageHeader, Warn, inputBase } from '../components/ui';
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

type Tab = 'grade' | 'bonus' | 'token';

export default function Annual() {
  const { data, setAnnualConfig, setAnnualMember } = useStore();
  const me = useCurrentMember();
  const manager = isManager(me);
  const thisYear = String(new Date().getFullYear());
  const [year, setYear] = useState(thisYear);
  const [tab, setTab] = useState<Tab>('grade');

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
        <PageHeader title="年度视图" />
        <Info>年度评级与分配由评级会(CTO + 架构师 + 各端 Lead)处理(9.1);你可以查看本人年度积分。</Info>
        <Card title={`${year} 我的年度积分`}>
          {mine ? (
            <div className="grid grid-cols-3 gap-4 text-center">
              <Stat label="年度正分" value={mine.allPositive} />
              <Stat label="年度扣分" value={round1(mine.deduction + mine.leadLiability)} red />
              <Stat label="年度有效积分" value={mine.effective} big />
            </div>
          ) : (
            <div className="text-sm text-slate-400">暂无数据</div>
          )}
        </Card>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'grade', label: '评级' },
    { key: 'bonus', label: '年终奖模拟' },
    { key: 'token', label: 'Token 模拟' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="年度视图"
        actions={
          <div className="flex gap-1 rounded-lg bg-slate-200/70 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                className={`rounded-md px-3.5 py-1 text-xs font-medium transition-colors ${
                  tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        <select className={inputBase} value={year} onChange={(e) => setYear(e.target.value)}>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </select>
      </PageHeader>

      {tab === 'grade' && (
        <Card title="年度有效积分与评级(9.1)">
          <Info>
            年度有效积分 = max(正分 − 扣分, 0);积分排名是必要条件而非充分条件,评级由评级会确定;P0 主责封顶 B,红线暂缓评定。
          </Info>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th className="py-2 pr-3 font-medium">#</th>
                  <th className="py-2 pr-3 font-medium">姓名 / 端 / 职级</th>
                  <th className="py-2 pr-3 text-right font-medium">正分</th>
                  <th className="py-2 pr-3 text-right font-medium">扣分</th>
                  <th className="py-2 pr-3 text-right font-medium">有效积分</th>
                  <th className="py-2 pr-3 font-medium">否决/提示</th>
                  <th className="py-2 pr-3 font-medium">建议</th>
                  <th className="py-2 pr-3 font-medium">评级</th>
                </tr>
              </thead>
              <tbody>
                {totals.map((t, idx) => {
                  const m = memberOf(t.memberId);
                  const h = hintOf(t.memberId);
                  const pct = h ? h.percentile : 1;
                  return (
                    <tr key={t.memberId} className="border-b border-slate-50">
                      <td className="py-2.5 pr-3 tabular-nums text-slate-400">
                        {idx + 1}
                        {pct <= 0.15 && <span className="ml-1 text-xs text-emerald-600">前15%</span>}
                        {pct > 0.15 && pct <= 0.4 && <span className="ml-1 text-xs text-slate-400">前40%</span>}
                      </td>
                      <td className="py-2.5 pr-3 font-medium">
                        {m?.name}
                        <span className="ml-1 text-xs text-slate-400">
                          {m?.squad} / {m ? LEVEL_LABEL[m.level] : ''}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{t.allPositive}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums text-red-600">
                        −{round1(t.deduction + t.leadLiability)}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold tabular-nums">{t.effective}</td>
                      <td className="py-2.5 pr-3 space-x-1">
                        {h?.redline && <Badge color="red">红线·暂缓评定</Badge>}
                        {h?.p0Primary && <Badge color="amber">P0 主责·封顶 B</Badge>}
                        {h?.p1Primary && !h.p0Primary && <Badge color="amber">P1 主责</Badge>}
                        {h?.belowHalfMedian && <Badge>低于中位数 50%</Badge>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge>{h?.suggested}</Badge>
                      </td>
                      <td className="py-2.5 pr-3">
                        <select
                          className="rounded-lg border border-slate-300 px-2 py-1 text-sm transition-colors focus:border-indigo-500 focus:outline-none"
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
      )}

      {tab === 'bonus' && (
        <Card title="年终奖模拟(9.2)">
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <div className="mb-1 text-xs text-slate-500">公司年度奖金预算</div>
              <input
                type="number"
                className={inputBase + ' w-40'}
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
                className={inputBase + ' w-28'}
                value={cfg.coefficient}
                onChange={(e) => setAnnualConfig(year, { coefficient: Math.min(1.2, Math.max(0, Number(e.target.value))) })}
              />
            </label>
            <div className="text-sm">
              实际总池 = <span className="text-lg font-bold tabular-nums text-indigo-700">{bonus.pool.toLocaleString()}</span>
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
                      <th className="py-2 pr-3 font-medium">姓名</th>
                      <th className="py-2 pr-3 text-right font-medium">有效积分(分子)</th>
                      <th className="py-2 pr-3 text-right font-medium">占正分总和比例</th>
                      <th className="py-2 pr-3 text-right font-medium">模拟年终奖</th>
                      <th className="py-2 font-medium">提示</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bonus.rows
                      .slice()
                      .sort((a, b) => b.share - a.share)
                      .map((r) => (
                        <tr key={r.memberId} className="border-b border-slate-50">
                          <td className="py-2.5 pr-3 font-medium">{memberOf(r.memberId)?.name}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums">{r.effective}</td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-slate-500">
                            {bonus.totalPositive ? ((r.effective / bonus.totalPositive) * 100).toFixed(1) : 0}%
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{r.share.toLocaleString()}</td>
                          <td className="py-2.5">{r.over3x && <Badge color="amber">超平均 3 倍,需复核数据真实性</Badge>}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex gap-6 text-sm text-slate-500">
                <span>
                  分母(全员正分总和):<b className="tabular-nums">{bonus.totalPositive.toLocaleString()}</b>
                </span>
                <span>
                  已分配:<b className="tabular-nums">{bonus.distributed.toLocaleString()}</b>
                </span>
                <span>
                  因扣分留存公司:<b className="tabular-nums text-slate-700">{bonus.retained.toLocaleString()}</b>(不二次分配,9.2)
                </span>
              </div>
            </>
          )}
        </Card>
      )}

      {tab === 'token' && (
        <Card title="Token 配额模拟(9.3)">
          <Info>
            个人 Token 配额 = 岗位基础配额 × 职级系数 × 年度绩效系数 × 长期贡献系数 × 风险调整系数;职级未映射前一律按 1.0。点行内「调整」修改参数。
          </Info>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th className="py-2 pr-3 font-medium">姓名</th>
                  <th className="py-2 pr-3 text-right font-medium">基础配额</th>
                  <th className="py-2 pr-3 text-right font-medium">职级</th>
                  <th className="py-2 pr-3 text-right font-medium">绩效</th>
                  <th className="py-2 pr-3 text-right font-medium">长期贡献</th>
                  <th className="py-2 pr-3 text-right font-medium">风险</th>
                  <th className="py-2 pr-3 text-right font-medium">配额</th>
                  <th className="w-16 py-2" />
                </tr>
              </thead>
              <tbody>
                {totals.map((t) => (
                  <TokenRow key={t.memberId} memberId={t.memberId} year={year} gradeOf={gradeOf} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-slate-400">
            归属周期 4 年、1 年 cliff,离职与税务以 Token 授予协议为准(9.4);长期贡献系数由 CTO 逐项书面说明后填入。
          </div>
        </Card>
      )}
    </div>
  );
}

/** Token 行:默认只读展示,点「调整」展开输入 */
function TokenRow({ memberId, year, gradeOf }: { memberId: string; year: string; gradeOf: (id: string) => Grade }) {
  const { data, setAnnualMember } = useStore();
  const [editing, setEditing] = useState(false);

  const m = data.members.find((x) => x.id === memberId);
  if (!m) return null;

  const cfg = data.annual[year] ?? { budget: 0, coefficient: 1, perMember: {} };
  const p = cfg.perMember[memberId] ?? {};
  const grade = gradeOf(memberId);
  const riskSug = suggestRisk(data, memberId, year);
  const base = p.baseQuota ?? 100;
  const longTerm = p.longTerm ?? 1;
  const risk = p.risk ?? riskSug.value;
  const quota = tokenQuota(base, m.level === 'unmapped' ? 'L2' : m.level, grade, longTerm, risk);

  const smallInput = 'w-20 rounded-lg border border-slate-300 px-2 py-1 text-right text-sm transition-colors focus:border-indigo-500 focus:outline-none';

  return (
    <tr className="border-b border-slate-50">
      <td className="py-2.5 pr-3 font-medium">{m.name}</td>
      <td className="py-2.5 pr-3 text-right tabular-nums">
        {editing ? (
          <input
            type="number"
            className={smallInput + ' w-24'}
            value={base}
            onChange={(e) => setAnnualMember(year, memberId, { baseQuota: Number(e.target.value) })}
          />
        ) : (
          base.toLocaleString()
        )}
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-500">
        ×{LEVEL_FACTOR[m.level]}
        {m.level === 'unmapped' && <div className="text-xs text-amber-600">未映射按 1.0</div>}
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums text-slate-500">
        {grade} ×{GRADE_FACTOR[grade]}
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums">
        {editing ? (
          <input
            type="number"
            step={0.05}
            min={0.8}
            max={1.5}
            className={smallInput}
            value={longTerm}
            onChange={(e) => setAnnualMember(year, memberId, { longTerm: Number(e.target.value) })}
          />
        ) : (
          <span className="text-slate-500">×{longTerm}</span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right tabular-nums">
        {editing ? (
          <div>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className={smallInput}
              value={risk}
              onChange={(e) => setAnnualMember(year, memberId, { risk: Number(e.target.value) })}
            />
            <div className="mt-0.5 text-xs text-slate-400">{riskSug.reason}</div>
          </div>
        ) : (
          <span className="text-slate-500" title={riskSug.reason}>
            ×{risk}
          </span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right text-base font-bold tabular-nums">{quota.toLocaleString()}</td>
      <td className="py-2.5 text-right">
        <button
          className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
            editing ? 'bg-indigo-50 text-indigo-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
          }`}
          onClick={() => setEditing(!editing)}
        >
          {editing ? '完成' : '调整'}
        </button>
      </td>
    </tr>
  );
}

function Stat({ label, value, red, big }: { label: string; value: number; red?: boolean; big?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 font-bold tabular-nums ${big ? 'text-2xl text-indigo-700' : 'text-xl'} ${red ? 'text-red-600' : ''}`}>
        {value}
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { Badge, Card, EmptyHint, Field, Info, Modal, MonthPicker, Warn, btnGhost, btnPrimary, inputCls } from '../components/ui';
import {
  INCIDENT_BASE,
  INCIDENT_LABEL,
  LIABILITY_FACTOR,
  LIABILITY_LABEL,
  REPORTING_FACTOR,
  REPORTING_LABEL,
  computeDeduction,
  currentMonth,
  minorRepeatCount,
  monthOf,
  todayISO,
} from '../lib/rules';
import type { IncidentEntry, IncidentLevel, Liability, Reporting } from '../lib/types';
import { isManager, maxIncidentLevel, useCurrentMember, useStore, uid } from '../store';

export default function IncidentLedger() {
  const { data, removeIncident } = useStore();
  const me = useCurrentMember();
  const [month, setMonth] = useState(currentMonth());
  const [showAdd, setShowAdd] = useState(false);

  const archived = data.archivedMonths.includes(month);
  const levelCap = maxIncidentLevel(me);
  const manager = isManager(me);

  const entries = useMemo(() => {
    let list = data.incidents.filter((i) => monthOf(i.date) === month);
    if (!manager && me) list = list.filter((i) => i.memberId === me.id);
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [data, month, manager, me]);

  const memberName = (id?: string) => data.members.find((m) => m.id === id)?.name ?? id ?? '';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">问题与事故台账</h1>
        <MonthPicker value={month} onChange={setMonth} />
        {archived && <Badge color="violet">本月已归档,记录锁定</Badge>}
        <div className="flex-1" />
        {levelCap && !archived && (
          <button className={btnPrimary} onClick={() => setShowAdd(true)}>
            + 记录问题/事故
          </button>
        )}
      </div>

      <Info>
        扣分 = 档位分 × 责任系数 × 报告系数(4.1);P0/P1 由 CTO 认定,P2 可由架构师认定(4.5);小问题不扣分,30 天内同类重复 2 次升级 P2(4.4)。
      </Info>

      <Card>
        {entries.length === 0 ? (
          <EmptyHint text="本月暂无记录" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th className="py-2 pr-3">日期</th>
                  <th className="py-2 pr-3">档位</th>
                  <th className="py-2 pr-3">事项</th>
                  <th className="py-2 pr-3">责任人</th>
                  <th className="py-2 pr-3">责任/报告</th>
                  <th className="py-2 pr-3 text-right">实际扣分</th>
                  <th className="py-2 pr-3">Lead 连带</th>
                  <th className="py-2 pr-3">认定人</th>
                  {manager && !archived && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {entries.map((i) => {
                  const target = data.members.find((m) => m.id === i.memberId);
                  const r = target ? computeDeduction(i, target, data.scores) : null;
                  return (
                    <tr key={i.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                      <td className="py-2 pr-3 whitespace-nowrap text-slate-500">{i.date}</td>
                      <td className="py-2 pr-3">
                        <Badge color={i.level === 'P0' ? 'red' : i.level === 'P1' ? 'amber' : i.level === 'P2' ? 'blue' : 'slate'}>
                          {INCIDENT_LABEL[i.level]}
                        </Badge>
                        {i.redline && <Badge color="red">红线</Badge>}
                      </td>
                      <td className="py-2 pr-3">
                        <div>{i.title}</div>
                        <div className="text-xs text-slate-400">
                          {i.category}
                          {i.note ? ` · ${i.note}` : ''}
                        </div>
                      </td>
                      <td className="py-2 pr-3 font-medium">{memberName(i.memberId)}</td>
                      <td className="py-2 pr-3 text-xs whitespace-nowrap">
                        {LIABILITY_LABEL[i.liability]} ×{LIABILITY_FACTOR[i.liability]} / ×{REPORTING_FACTOR[i.reporting]}
                      </td>
                      <td className="py-2 pr-3 text-right">
                        {r && (
                          <div>
                            <span className={`font-semibold ${r.final > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                              {r.final > 0 ? `−${r.final}` : '0'}
                            </span>
                            {r.capApplied && <div className="text-xs text-amber-600">已触发封顶</div>}
                            {r.newbieHalved && <div className="text-xs text-sky-600">新人减半</div>}
                          </div>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-xs whitespace-nowrap">
                        {i.leadFault && r ? `${memberName(i.leadMemberId)} −${r.leadDeduction}` : '—'}
                      </td>
                      <td className="py-2 pr-3 text-xs">{memberName(i.decidedBy)}</td>
                      {manager && !archived && (
                        <td className="py-2 text-right">
                          <button className="text-xs text-red-500 hover:underline" onClick={() => removeIncident(i.id)}>
                            删除
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {showAdd && me && <AddIncidentModal onClose={() => setShowAdd(false)} />}
    </div>
  );
}

function AddIncidentModal({ onClose }: { onClose: () => void }) {
  const { data, addIncident } = useStore();
  const me = useCurrentMember();
  const activeMembers = data.members.filter((m) => m.active);

  const levelCap = maxIncidentLevel(me);
  const allowedLevels: IncidentLevel[] =
    levelCap === 'P0' ? ['P0', 'P1', 'P2', 'minor'] : levelCap === 'P2' ? ['P2', 'minor'] : ['minor'];

  const [memberId, setMemberId] = useState(activeMembers[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState<IncidentLevel>(allowedLevels[allowedLevels.length - 1]);
  const [liability, setLiability] = useState<Liability>('primary');
  const [reporting, setReporting] = useState<Reporting>('passive');
  const [redline, setRedline] = useState(false);
  const [leadFault, setLeadFault] = useState(false);
  const [leadMemberId, setLeadMemberId] = useState('');
  const [hasChecklist, setHasChecklist] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const target = data.members.find((m) => m.id === memberId);

  const draft: IncidentEntry = {
    id: 'draft',
    date,
    memberId,
    title,
    category,
    level,
    liability,
    reporting,
    redline,
    leadFault,
    leadMemberId: leadFault ? leadMemberId : undefined,
    hasChecklist: hasChecklist || undefined,
    note: note || undefined,
    decidedBy: me?.id ?? '',
  };
  const calc = target ? computeDeduction(draft, target, data.scores) : null;

  const repeats = category ? minorRepeatCount(data.incidents, memberId, category, date) : 0;
  const escalateHint = level === 'minor' && repeats >= 1;

  const save = () => {
    if (!title.trim()) return setError('请填写事项描述');
    if (!category.trim()) return setError('请填写问题类别(用于 30 天同类重复判定,4.4)');
    if (leadFault && !leadMemberId) return setError('勾选了管理失误连带,请选择连带的 Lead');
    addIncident({ ...draft, id: uid('i'), title: title.trim(), category: category.trim() });
    onClose();
  };

  return (
    <Modal title="记录问题/事故" onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-4">
          <Field label="责任人">
            <select className={inputCls} value={memberId} onChange={(e) => setMemberId(e.target.value)}>
              {activeMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}({m.squad})
                </option>
              ))}
            </select>
          </Field>
          <Field label="日期">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="事项描述">
            <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="如:下单接口故障 40 分钟" />
          </Field>
          <Field label="问题类别(同类判定用)">
            <input className={inputCls} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="如:文案错误 / 配置错误 / 核心接口故障" />
          </Field>
          <Field label={`档位(4.2)${levelCap !== 'P0' ? ' · 当前身份最高可记 ' + (levelCap === 'P2' ? 'P2' : '小问题') : ''}`}>
            <div className="flex gap-2">
              {(['P0', 'P1', 'P2', 'minor'] as IncidentLevel[]).map((l) => (
                <button
                  key={l}
                  disabled={!allowedLevels.includes(l)}
                  className={`rounded-lg border px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-30 ${
                    level === l ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600'
                  }`}
                  onClick={() => setLevel(l)}
                >
                  {INCIDENT_LABEL[l]}
                  {l !== 'minor' && ` −${INCIDENT_BASE[l]}`}
                </button>
              ))}
            </div>
          </Field>
          <Field label="责任(4.3)">
            <select className={inputCls} value={liability} onChange={(e) => setLiability(e.target.value as Liability)}>
              {(['primary', 'secondary', 'none'] as Liability[]).map((l) => (
                <option key={l} value={l}>
                  {LIABILITY_LABEL[l]} ×{LIABILITY_FACTOR[l]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="报告情形(4.3)">
            <select
              className={inputCls}
              value={reporting}
              onChange={(e) => {
                const v = e.target.value as Reporting;
                setReporting(v);
                if (v === 'concealed') setRedline(true);
              }}
            >
              {(['proactive', 'passive', 'late', 'concealed'] as Reporting[]).map((r) => (
                <option key={r} value={r}>
                  {REPORTING_LABEL[r]} ×{REPORTING_FACTOR[r]}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={redline} onChange={(e) => setRedline(e.target.checked)} />
            标记红线审查(6.1)—— 不适用扣分封顶,年度评级暂缓
          </label>
          {level === 'minor' && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={hasChecklist} onChange={(e) => setHasChecklist(e.target.checked)} />
              该类问题已有明确规范/检查清单(4.4)
            </label>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={leadFault} onChange={(e) => setLeadFault(e.target.checked)} />
            Lead 管理失误(未安排 Review / 排期明显不合理),连带 30%(7.1)
          </label>
          {leadFault && (
            <Field label="连带的 Lead">
              <select className={inputCls} value={leadMemberId} onChange={(e) => setLeadMemberId(e.target.value)}>
                <option value="">选择 Lead</option>
                {activeMembers
                  .filter((m) => m.role !== 'member')
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}({m.squad})
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field label="备注">
            <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 text-xs font-semibold text-slate-500">扣分实时计算(4.1)</div>
            {calc && level !== 'minor' ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">档位分</span>
                  <span>{calc.base}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">× 责任系数</span>
                  <span>{calc.liabilityFactor}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">× 报告系数</span>
                  <span>{calc.reportingFactor}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500">理论扣分</span>
                  <span className="font-medium">{calc.raw}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">封顶值(40%)</span>
                  <span>{redline ? '不适用(红线)' : calc.cap}</span>
                </div>
                <div className="text-xs text-slate-400">{calc.capBasis}</div>
                {calc.capApplied && <div className="text-xs font-medium text-amber-600">已按封顶取值(4.1)</div>}
                {calc.newbieHalved && <div className="text-xs font-medium text-sky-600">入职未满 3 个月,扣分减半(10.2)</div>}
                <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base">
                  <span className="font-semibold">实际扣分</span>
                  <span className="font-bold text-red-600">−{calc.final}</span>
                </div>
                {leadFault && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Lead 连带(30%)</span>
                    <span className="font-medium text-red-500">−{calc.leadDeduction}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-slate-400">小问题不扣分,仅记录(4.4)。</div>
            )}
          </div>

          {escalateHint && (
            <Warn>
              30 天内该责任人「{category}」类问题已有 {repeats} 条,本条为第 {repeats + 1} 条:
              {hasChecklist ? '已有规范/清单,按 4.4 应升级为 P2 记录。' : '尚无规范/清单,应优先补充流程,不直接升级扣分(4.4)。'}
            </Warn>
          )}
          {reporting === 'concealed' && <Warn>隐瞒/误导将触发红线审查(4.3 / 6.1),已自动勾选红线标记。</Warn>}
          {level === 'P0' && (
            <Info>
              提示:若责任人走完 Review + 审批 + 回滚预案且信息真实,最多按次责处理(5.1),请确认责任选择。
            </Info>
          )}

          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={onClose}>
              取消
            </button>
            <button className={btnPrimary} onClick={save}>
              保存
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

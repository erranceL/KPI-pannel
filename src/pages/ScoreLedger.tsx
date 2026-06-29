import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Card,
  EmptyHint,
  Field,
  FieldError,
  Info,
  Modal,
  MonthStepper,
  PageHeader,
  Warn,
  btnGhost,
  btnPrimary,
  inputBase,
  inputCls,
} from '../components/ui';
import {
  TIER_LABEL,
  currentMonth,
  deliveryFactor,
  monthOf,
  normalizeKpiConfig,
  round1,
  scoreFinal,
  todayISO,
  validTierPoints,
} from '../lib/rules';
import type { Member, ScoreEntry, Tier } from '../lib/types';
import { SQUADS } from '../lib/types';
import { canConfirmXl, canRecordScores, useCurrentMember, useStore, uid } from '../store';

const TIERS: Tier[] = ['small', 'medium', 'large', 'xlarge', 'online'];

/** 交付列展示:线上/运维不适用;否则按系数显示百分比 */
function deliveryText(s: ScoreEntry): string {
  if (s.tier === 'online' || s.tier === 'ops') return '—';
  if (s.delivery === 'zero') return '未交付';
  const f = deliveryFactor(s);
  if (f >= 1) return '全额';
  return `${Math.round(f * 100)}%`;
}

/** 成员下拉:按端分组 */
function MemberOptions({ members }: { members: Member[] }) {
  return (
    <>
      {SQUADS.map((sq) => {
        const ms = members.filter((m) => m.squad === sq);
        if (!ms.length) return null;
        return (
          <optgroup key={sq} label={sq}>
            {ms.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}

export default function ScoreLedger() {
  const { data, removeScore, updateScore } = useStore();
  const me = useCurrentMember();
  const [month, setMonth] = useState(currentMonth());
  const [squad, setSquad] = useState<string>('全部');
  const [modal, setModal] = useState<null | { entry?: ScoreEntry }>(null);

  const archived = data.archivedMonths.includes(month);
  const manager = canRecordScores(me);

  const entries = useMemo(() => {
    let list = data.scores.filter((s) => monthOf(s.date) === month && s.tier !== 'ops');
    if (!manager && me) list = list.filter((s) => s.memberId === me.id); // 成员只看本人(8.2)
    if (squad !== '全部') {
      list = list.filter((s) => data.members.find((m) => m.id === s.memberId)?.squad === squad);
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [data, month, squad, manager, me]);

  const memberName = (id: string) => data.members.find((m) => m.id === id)?.name ?? id;
  const memberSquad = (id: string) => data.members.find((m) => m.id === id)?.squad ?? '';

  return (
    <div className="space-y-4">
      <PageHeader
        title="积分台账"
        actions={
          manager && !archived ? (
            <button className={btnPrimary} onClick={() => setModal({})}>
              <Plus size={15} /> 记一笔
            </button>
          ) : undefined
        }
      >
        <MonthStepper value={month} onChange={setMonth} />
        <select className={inputBase} value={squad} onChange={(e) => setSquad(e.target.value)}>
          <option>全部</option>
          {SQUADS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        {archived && <Badge color="amber">已归档 · 记录锁定</Badge>}
      </PageHeader>

      {!manager && <Info>成员身份仅可查看本人明细(8.2);记账由各端 Lead 完成。</Info>}

      {manager && <OpsCard month={month} archived={archived} />}

      <Card>
        {entries.length === 0 ? (
          <EmptyHint
            text="本月暂无事项记录"
            action={
              manager && !archived ? (
                <button className={btnPrimary} onClick={() => setModal({})}>
                  <Plus size={15} /> 记第一笔
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th className="py-2 pr-3 font-medium">日期</th>
                  <th className="py-2 pr-3 font-medium">端</th>
                  <th className="py-2 pr-3 font-medium">姓名</th>
                  <th className="py-2 pr-3 font-medium">事项</th>
                  <th className="py-2 pr-3 font-medium">档位</th>
                  <th className="py-2 pr-3 font-medium">交付</th>
                  <th className="py-2 pr-3 text-right font-medium">实得</th>
                  <th className="py-2 pr-3 font-medium">状态</th>
                  {manager && !archived && <th className="w-20 py-2" />}
                </tr>
              </thead>
              <tbody>
                {entries.map((s) => (
                  <tr key={s.id} className="group border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                    <td className="py-2.5 pr-3 whitespace-nowrap text-slate-400">{s.date.slice(5)}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{memberSquad(s.memberId)}</td>
                    <td className="py-2.5 pr-3 font-medium">{memberName(s.memberId)}</td>
                    <td className="py-2.5 pr-3">
                      <div>{s.title}</div>
                      {(s.tierReason || s.note) && <div className="text-xs text-slate-400">{s.tierReason || s.note}</div>}
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap">
                      <Badge>{TIER_LABEL[s.tier]} {s.points}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-xs text-slate-500">{deliveryText(s)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums">{scoreFinal(s)}</td>
                    <td className="py-2.5 pr-3 space-x-1 whitespace-nowrap">
                      {s.selfFix && <Badge color="amber">自修不计分</Badge>}
                      {s.tier === 'xlarge' && !s.xlConfirmedBy && <Badge color="amber">特大待确认</Badge>}
                      {s.tier === 'xlarge' && s.xlConfirmedBy && <Badge color="green">已确认</Badge>}
                      {s.reschedules > 0 && (
                        <Badge color={s.reschedules > 2 ? 'red' : 'amber'}>重排 ×{s.reschedules}</Badge>
                      )}
                      {s.splitGroupId && <Badge>拆分</Badge>}
                    </td>
                    {manager && !archived && (
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {s.tier === 'xlarge' && !s.xlConfirmedBy && canConfirmXl(me) && (
                            <button
                              className="rounded-md px-1.5 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-50"
                              onClick={() => updateScore({ ...s, xlConfirmedBy: me!.id })}
                            >
                              确认
                            </button>
                          )}
                          <button
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-700"
                            title="编辑"
                            onClick={() => setModal({ entry: s })}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                            title="删除(可撤销)"
                            onClick={() => removeScore(s.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && me && <ScoreModal entry={modal.entry} onClose={() => setModal(null)} />}
    </div>
  );
}

/** 运维杂项:每人每月一笔(3.9),内联滑杆直接调整 */
function OpsCard({ month, archived }: { month: string; archived: boolean }) {
  const { data, addScores, updateScore } = useStore();
  const me = useCurrentMember();
  const [open, setOpen] = useState(false);

  const config = normalizeKpiConfig(data.config);
  const opsCfg = config.tiers.ops;
  const members = data.members.filter((m) => m.active);
  const entryOf = (id: string) => data.scores.find((s) => s.tier === 'ops' && s.memberId === id && monthOf(s.date) === month);
  const recorded = members.filter((m) => (entryOf(m.id)?.points ?? 0) > 0).length;

  const band = (p: number) => (p <= 3 ? '低强度' : p <= 7 ? '中强度' : '高强度');

  const setPoints = (m: Member, points: number) => {
    const ex = entryOf(m.id);
    if (ex) {
      if (ex.points !== points) updateScore({ ...ex, points });
    } else {
      addScores([
        {
          id: uid('s'),
          date: `${month}-15`,
          memberId: m.id,
          title: '当月发布/值班杂项',
          tier: 'ops',
          points,
          delivery: 'full',
          reschedules: 0,
          recordedBy: me?.id ?? '',
        },
      ]);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-slate-700"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
        本月运维杂项
        <span className="font-normal text-slate-400">
          每人每月一笔总账 {opsCfg.min}–{opsCfg.max} 分(3.9) · 已记 {recorded} 人
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 border-t border-slate-100 px-5 py-3">
          {members.map((m) => {
            const points = entryOf(m.id)?.points ?? 0;
            return (
              <div key={m.id} className="flex items-center gap-3 py-1.5">
                <div className="w-24 shrink-0 truncate text-sm">
                  {m.name}
                  <span className="ml-1 text-xs text-slate-400">{m.squad}</span>
                </div>
                <input
                  type="range"
                  min={opsCfg.min}
                  max={opsCfg.max}
                  value={points}
                  disabled={archived}
                  className="min-w-0 flex-1 accent-indigo-600"
                  onChange={(e) => setPoints(m, Number(e.target.value))}
                />
                <div className="w-16 shrink-0 text-right text-sm tabular-nums">
                  <span className="font-semibold">{points}</span>
                  <span className="ml-1 text-xs text-slate-400">{band(points)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface Participant {
  memberId: string;
  points: number;
}

/** 记一笔 / 编辑:常用字段始终可见,少用字段折叠;行内即时校验 */
function ScoreModal({ entry, onClose }: { entry?: ScoreEntry; onClose: () => void }) {
  const { data, addScores, updateScore, notify } = useStore();
  const me = useCurrentMember();
  const activeMembers = data.members.filter((m) => m.active);
  const config = normalizeKpiConfig(data.config);
  const editing = !!entry;
  const isSplitRow = !!entry?.splitGroupId;

  const [title, setTitle] = useState(entry?.title ?? '');
  const [date, setDate] = useState(entry?.date ?? todayISO());
  const [tier, setTier] = useState<Tier>(entry?.tier ?? 'medium');
  const [points, setPoints] = useState(entry?.points ?? config.tiers.medium.defaultPoints);
  const [tierReason, setTierReason] = useState(entry?.tierReason ?? '');
  // 交付:未交付勾选 + 工期/延期(≥3 天套公式)
  const [notDelivered, setNotDelivered] = useState(entry?.delivery === 'zero');
  const [plannedDays, setPlannedDays] = useState(entry?.plannedDays ?? 0);
  const [delayDays, setDelayDays] = useState(entry?.delayDays ?? 0);
  const [reschedules, setReschedules] = useState(entry?.reschedules ?? 0);
  const [selfFix, setSelfFix] = useState(!!entry?.selfFix);
  const [showMore, setShowMore] = useState(editing ? (entry.reschedules ?? 0) > 0 || !!entry.selfFix : false);
  const [touched, setTouched] = useState(false);

  const [memberId, setMemberId] = useState(entry?.memberId ?? activeMembers[0]?.id ?? '');
  const [participants, setParticipants] = useState<Participant[]>([
    { memberId: activeMembers[0]?.id ?? '', points: config.tiers.medium.defaultPoints },
  ]);

  const tierCfg = config.tiers[tier];
  const min = tierCfg.min;
  const max = tierCfg.max;
  const isOnline = tier === 'online';
  const usesFormula = !isOnline && plannedDays >= config.delivery.formulaMinPlannedDays;
  const split = !editing && participants.length > 1;
  const splitSum = participants.reduce((a, p) => a + (Number.isFinite(p.points) ? p.points : 0), 0);
  const pointsOutOfRange = !validTierPoints(tier, points);

  // 实时交付系数与实得(线上/运维系数 1;未交付 0)
  const previewFactor = deliveryFactor({
    tier,
    delivery: notDelivered ? 'zero' : 'full',
    plannedDays,
    delayDays,
  } as ScoreEntry);

  // 编辑拆分行:组内总分不得超过该档上限(3.7)
  const groupSum = useMemo(() => {
    if (!isSplitRow) return 0;
    const others = data.scores
      .filter((s) => s.splitGroupId === entry!.splitGroupId && s.id !== entry!.id)
      .reduce((a, s) => a + s.points, 0);
    return others + points;
  }, [data, entry, isSplitRow, points]);

  const errors = {
    title: !title.trim() ? '请填写事项名称' : '',
    points: !editing && pointsOutOfRange ? `${TIER_LABEL[tier]}档分值须为 ${min}–${max} 的整数` : '',
    reason: (tier === 'large' || tier === 'xlarge') && !tierReason.trim() ? '大档及以上须备注进入该档的理由(3.2)' : '',
    split: split && splitSum > max ? `拆分合计 ${splitSum} 超过档位上限 ${max}(3.7)` : '',
    member: split && participants.some((p) => !p.memberId) ? '请选择所有协作成员' : '',
    group: isSplitRow && groupSum > max && !editing ? `拆分组合计 ${groupSum} 超过档位上限 ${max}(3.7)` : '',
  };
  const canSave = !Object.values(errors).some(Boolean);

  const setTierAndPoints = (t: Tier) => {
    setTier(t);
    const pts = config.tiers[t].defaultPoints;
    setPoints(pts);
    if (!editing) setParticipants((ps) => (ps.length === 1 ? [{ ...ps[0], points: pts }] : ps));
    if (t === 'online' || t === 'ops') {
      setNotDelivered(false);
      setPlannedDays(0);
      setDelayDays(0);
    }
  };

  const deliveryFields = (): Pick<ScoreEntry, 'delivery' | 'plannedDays' | 'delayDays'> => {
    if (isOnline) return { delivery: 'full' };
    if (notDelivered) return { delivery: 'zero' };
    return {
      delivery: 'full',
      plannedDays: plannedDays > 0 ? plannedDays : undefined,
      delayDays: usesFormula && delayDays > 0 ? delayDays : undefined,
    };
  };

  const save = () => {
    setTouched(true);
    if (!canSave) return;

    if (editing) {
      updateScore({
        ...entry!,
        title: title.trim(),
        date,
        memberId,
        tier,
        points,
        ...deliveryFields(),
        tierReason: tierReason.trim() || undefined,
        reschedules,
        selfFix: selfFix || undefined,
        xlConfirmedBy: tier === 'xlarge' ? entry!.xlConfirmedBy : undefined,
      });
      notify('已保存修改');
    } else {
      const groupId = split ? uid('grp') : undefined;
      const df = deliveryFields();
      addScores(
        participants.map((p) => ({
          id: uid('s'),
          date,
          memberId: p.memberId,
          title: title.trim(),
          tier,
          points: split ? p.points : points,
          ...df,
          tierReason: tierReason.trim() || undefined,
          reschedules,
          splitGroupId: groupId,
          selfFix: selfFix || undefined,
          recordedBy: me?.id ?? '',
        })),
      );
      notify(split ? `已记录 ${participants.length} 条拆分事项` : '已记录 1 条事项');
    }
    onClose();
  };

  return (
    <Modal title={editing ? '编辑事项' : '记一笔积分'} onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="事项(一句话)">
            <input
              className={inputCls}
              value={title}
              autoFocus={!editing}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="如:桥合约提现限额逻辑"
            />
            <FieldError text={touched ? errors.title : ''} />
          </Field>
          <Field label="日期">
            <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </div>

        {!split && (
          <Field label={editing ? '成员' : '成员(协作拆分见下方「更多选项」)'}>
            <select
              className={inputCls}
              value={editing ? memberId : participants[0].memberId}
              onChange={(e) =>
                editing
                  ? setMemberId(e.target.value)
                  : setParticipants((ps) => [{ ...ps[0], memberId: e.target.value }])
              }
            >
              <MemberOptions members={activeMembers} />
            </select>
          </Field>
        )}

        <Field label="档位(3.1)">
          <div className="flex flex-wrap gap-2">
            {TIERS.map((t) => (
              <button
                key={t}
                disabled={isSplitRow && t !== tier}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                  tier === t ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                }`}
                onClick={() => setTierAndPoints(t)}
              >
                {TIER_LABEL[t]} {config.tiers[t].min}–{config.tiers[t].max}
              </button>
            ))}
          </div>
          {isSplitRow && <div className="mt-1 text-xs text-slate-400">拆分行不可改档;调整本行分值见下方</div>}
        </Field>

        {!split && (
          <Field label={`分值(${TIER_LABEL[tier]}档 ${min}–${max})`}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={min}
                max={max}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="min-w-0 flex-1 accent-indigo-600"
              />
              <input
                type="number"
                min={min}
                max={max}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className={inputBase + ' w-20'}
              />
            </div>
            <FieldError text={touched ? errors.points : ''} />
            {editing && pointsOutOfRange && (
              <div className="mt-1 text-xs text-amber-600">
                当前分值不在最新规则区间内,作为历史记录允许保存;新建记录会强制校验。
              </div>
            )}
          </Field>
        )}

        {isOnline && (
          <Info>
            线上问题处理(3.1):及时响应基础分 3;主动发现 &gt; 用户发现 &gt; 老板发现、下班后/周日支援、给出正确分析并推动解决(即便他人执行)→ 区间内取高位。自己 bug 导致的线上问题不计本项正分,按严重程度分级——小问题不扣分、达 P2 及以上改记问题与事故台账。
          </Info>
        )}

        {(tier === 'large' || tier === 'xlarge') && (
          <Field label="进入该档的理由(3.2)">
            <input
              className={inputCls}
              value={tierReason}
              onChange={(e) => setTierReason(e.target.value)}
              placeholder="工作量/涉及范围/风险面,一句话即可"
            />
            <FieldError text={touched ? errors.reason : ''} />
          </Field>
        )}

        {tier === 'xlarge' && !entry?.xlConfirmedBy && (
          <Warn>特大档需架构师或 CTO 确认(3.1);保存后将标记为「待确认」。</Warn>
        )}

        {isSplitRow && (
          <Field label={`本行分值(拆分组上限 ${max})`}>
            <input
              type="number"
              min={0}
              className={inputBase + ' w-28'}
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
            <FieldError text={errors.group} />
          </Field>
        )}

        {!isOnline && (
          <Field label="交付(3.4)">
            <label className="mb-2 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={notDelivered} onChange={(e) => setNotDelivered(e.target.checked)} />
              未交付 / 到期才暴露做不完(0 分)
            </label>
            {!notDelivered && (
              <div className="flex flex-wrap items-end gap-4 rounded-lg bg-slate-50 p-3">
                <label className="text-xs text-slate-500">
                  <div className="mb-1">原计划工期(工作日)</div>
                  <input
                    type="number"
                    min={0}
                    className={inputBase + ' w-28'}
                    value={plannedDays || ''}
                    placeholder="如 5"
                    onChange={(e) => setPlannedDays(Math.max(0, Number(e.target.value)))}
                  />
                </label>
                <label className="text-xs text-slate-500">
                  <div className="mb-1">实际延期(天)</div>
                  <input
                    type="number"
                    min={0}
                    className={inputBase + ' w-28'}
                    value={delayDays || ''}
                    placeholder="0"
                    disabled={!usesFormula}
                    onChange={(e) => setDelayDays(Math.max(0, Number(e.target.value)))}
                  />
                </label>
                <div className="text-sm">
                  <div className="text-xs text-slate-500">交付系数 → 实得</div>
                  <div className="font-semibold tabular-nums">
                    ×{previewFactor} → {round1(points * previewFactor)}
                  </div>
                </div>
              </div>
            )}
            <div className="mt-1 text-xs text-slate-400">
              {plannedDays > 0 && plannedDays < config.delivery.formulaMinPlannedDays
                ? `工期 < ${config.delivery.formulaMinPlannedDays} 天:不套延期公式,只看是否交付(全额/未交付)`
                : `工期 ≥ ${config.delivery.formulaMinPlannedDays} 天:实得 = max(0, 1 − 延期天数 × ${config.delivery.delayPenalty} / 工期) × 分值;延期指超出约定/重排后期限的未预警天数(3.5)`}
            </div>
          </Field>
        )}

        <button
          className="flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
          onClick={() => setShowMore(!showMore)}
        >
          {showMore ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          更多选项(重排期 / 自修标记{editing ? '' : ' / 协作拆分'})
        </button>

        {showMore && (
          <div className="space-y-4 rounded-xl bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="重排期次数(3.5)" hint="提前 1 个工作日预警并经 Lead 确认的重排,不算延期">
                <input
                  type="number"
                  min={0}
                  className={inputBase + ' w-28'}
                  value={reschedules}
                  onChange={(e) => setReschedules(Math.max(0, Number(e.target.value)))}
                />
              </Field>
              <label className="flex items-center gap-2 pt-5 text-sm text-slate-600">
                <input type="checkbox" checked={selfFix} onChange={(e) => setSelfFix(e.target.checked)} />
                修复本人 90 天内引入的问题
              </label>
            </div>
            {reschedules > 2 && <Warn>同一事项重排期已超过 2 次,须架构师复核(3.5)。</Warn>}
            {selfFix && <Warn>修复本人近期引入的问题不计正分(3.8),该条实得将记为 0。</Warn>}

            {!editing && (
              <Field label="协作拆分(多人按人头拆分值,3.7)">
                <div className="space-y-2">
                  {participants.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        className={inputBase + ' min-w-0 flex-1'}
                        value={p.memberId}
                        onChange={(e) =>
                          setParticipants((ps) => ps.map((x, i) => (i === idx ? { ...x, memberId: e.target.value } : x)))
                        }
                      >
                        <option value="">选择成员</option>
                        <MemberOptions members={activeMembers} />
                      </select>
                      <input
                        type="number"
                        min={0}
                        className={inputBase + ' w-24 shrink-0'}
                        value={p.points}
                        disabled={!split}
                        onChange={(e) =>
                          setParticipants((ps) => ps.map((x, i) => (i === idx ? { ...x, points: Number(e.target.value) } : x)))
                        }
                      />
                      {split && (
                        <button
                          className="text-xs text-red-500 hover:underline"
                          onClick={() =>
                            setParticipants((ps) => {
                              const next = ps.filter((_, i) => i !== idx);
                              return next.length === 1 ? [{ ...next[0], points }] : next;
                            })
                          }
                        >
                          移除
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    className="text-xs font-medium text-indigo-600 hover:underline"
                    onClick={() => setParticipants((ps) => [...ps, { memberId: '', points: 0 }])}
                  >
                    + 添加协作者
                  </button>
                  {split && (
                    <div className={`text-xs ${errors.split ? 'font-medium text-red-600' : 'text-slate-400'}`}>
                      拆分合计 {splitSum} / 档位上限 {max}
                    </div>
                  )}
                  <FieldError text={errors.member} />
                </div>
              </Field>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
          {!canSave && touched && <span className="mr-auto text-xs text-red-600">请先修正上方标红的内容</span>}
          <button className={btnGhost} onClick={onClose}>
            取消
          </button>
          <button className={btnPrimary} onClick={save} disabled={touched && !canSave}>
            {editing ? '保存修改' : '保存'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

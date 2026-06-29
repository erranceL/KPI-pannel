import { useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Badge,
  Card,
  ConfirmDialog,
  Field,
  Info,
  Modal,
  PageHeader,
  Warn,
  btnDanger,
  btnGhost,
  btnPrimary,
  inputBase,
  inputCls,
} from '../components/ui';
import {
  DEFAULT_KPI_CONFIG,
  INCIDENT_LABEL,
  LIABILITY_LABEL,
  normalizeKpiConfig,
  REPORTING_LABEL,
  tenureMonths,
  TIER_LABEL,
  todayISO,
} from '../lib/rules';
import type { IncidentLevel, KpiRuleConfig, Level, Liability, Member, Reporting, Role, Squad, Tier } from '../lib/types';
import { LEVEL_LABEL, ROLE_LABEL, SQUADS } from '../lib/types';
import { isManager, useCurrentMember, useStore, uid } from '../store';

export default function Team() {
  const { data, upsertMember, removeMember, exportJson, importJson, resetSeed, notify, setRuleConfig } = useStore();
  const me = useCurrentMember();
  const manager = isManager(me);
  const [editing, setEditing] = useState<Member | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const unmapped = data.members.filter((m) => m.active && m.level === 'unmapped').length;

  const doExport = () => {
    const blob = new Blob([exportJson()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kpi-data-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('已导出 JSON 文件');
  };

  const doImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const err = importJson(String(reader.result));
      notify(err ? `导入失败:${err}` : '导入成功');
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="团队设置"
        actions={
          manager ? (
            <button className={btnPrimary} onClick={() => setShowAdd(true)}>
              <Plus size={15} /> 添加成员
            </button>
          ) : undefined
        }
      />

      {unmapped > 0 && (
        <Warn>
          有 {unmapped} 名成员职级未映射:建议尽快完成全员职级映射并经本人确认,作为后续薪酬/激励的参考口径。
        </Warn>
      )}

      <Card title="成员列表">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
              <th className="py-2 pr-3 font-medium">姓名</th>
              <th className="py-2 pr-3 font-medium">端</th>
              <th className="py-2 pr-3 font-medium">角色</th>
              <th className="py-2 pr-3 font-medium">职级</th>
              <th className="py-2 pr-3 font-medium">入职日期</th>
              <th className="py-2 pr-3 font-medium">状态</th>
              {manager && <th className="w-24 py-2" />}
            </tr>
          </thead>
          <tbody>
            {data.members
              .filter((m) => m.active)
              .map((m) => {
                const newbie = tenureMonths(m.joinDate, todayISO()) < 3;
                return (
                  <tr key={m.id} className="group border-b border-slate-50 transition-colors hover:bg-slate-50/60">
                    <td className="py-2.5 pr-3 font-medium">{m.name}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{m.squad}</td>
                    <td className="py-2.5 pr-3">
                      <Badge>{ROLE_LABEL[m.role]}</Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500">{LEVEL_LABEL[m.level]}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{m.joinDate}</td>
                    <td className="py-2.5 pr-3">{newbie && <Badge color="green">保护期(10.2)</Badge>}</td>
                    {manager && (
                      <td className="py-2.5 text-right whitespace-nowrap">
                        <div className="opacity-0 transition-opacity group-hover:opacity-100">
                          <button className="mr-3 text-xs font-medium text-indigo-600 hover:underline" onClick={() => setEditing(m)}>
                            编辑
                          </button>
                          <button className="text-xs text-red-500 hover:underline" onClick={() => setConfirmRemove(m)}>
                            移除
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Card>

      {manager && (
        <RuleSettings
          config={normalizeKpiConfig(data.config)}
          onChange={setRuleConfig}
          onReset={() => {
            setRuleConfig(DEFAULT_KPI_CONFIG);
            notify('已恢复默认规则配置');
          }}
        />
      )}

      <Card title="数据管理">
        <Info>
          当前数据保存在本机浏览器(localStorage);后端上线前,可用导出/导入 JSON 在成员间同步。导出文件含薪酬敏感信息,请勿外传。
        </Info>
        <div className="mt-3 flex gap-2">
          <button className={btnGhost} onClick={doExport}>
            导出 JSON
          </button>
          <button className={btnGhost} onClick={() => fileRef.current?.click()}>
            导入 JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && doImport(e.target.files[0])}
          />
          {manager && (
            <button className={btnDanger} onClick={() => setConfirmReset(true)}>
              重置为演示数据
            </button>
          )}
        </div>
      </Card>

      {(showAdd || editing) && (
        <MemberModal
          member={editing ?? undefined}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
          onSave={(m) => {
            upsertMember(m);
            notify(editing ? '已保存修改' : `已添加成员 ${m.name}`);
            setShowAdd(false);
            setEditing(null);
          }}
        />
      )}

      {confirmRemove && (
        <ConfirmDialog
          title={`移除 ${confirmRemove.name}?`}
          message="成员将不再出现在列表与统计中,但历史台账记录会完整保留。"
          confirmLabel="移除"
          danger
          onConfirm={() => {
            removeMember(confirmRemove.id);
            notify(`已移除 ${confirmRemove.name}`);
          }}
          onClose={() => setConfirmRemove(null)}
        />
      )}
      {confirmReset && (
        <ConfirmDialog
          title="重置为演示数据?"
          message="当前全部成员、台账与归档数据将被覆盖,且无法恢复。建议先导出 JSON 备份。"
          confirmLabel="重置"
          danger
          onConfirm={() => {
            void resetSeed();
            notify('已重置为演示数据');
          }}
          onClose={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}

const TIER_KEYS: Tier[] = ['small', 'medium', 'large', 'xlarge', 'online', 'ops'];
const INCIDENT_KEYS: IncidentLevel[] = ['asset', 'P0', 'P1', 'P2', 'minor'];
const LIABILITY_KEYS: Liability[] = ['primary', 'secondary', 'none'];
const REPORTING_KEYS: Reporting[] = ['proactive', 'passive', 'late', 'concealed'];

function RuleSettings({
  config,
  onChange,
  onReset,
}: {
  config: KpiRuleConfig;
  onChange: (config: KpiRuleConfig) => void;
  onReset: () => void;
}) {
  const update = (fn: (next: KpiRuleConfig) => void) => {
    const next = structuredClone(config);
    fn(next);
    onChange(normalizeKpiConfig(next));
  };
  const numInput = (value: number, onValue: (n: number) => void, className = 'w-20', step = 1) => (
    <input
      type="number"
      step={step}
      className={`${inputBase} ${className}`}
      value={value}
      onChange={(e) => onValue(Number(e.target.value))}
    />
  );

  return (
    <Card
      title="规则设置"
      extra={
        <button className={btnGhost} onClick={onReset}>
          恢复默认
        </button>
      }
    >
      <Info>这些数值会立即影响表单校验、实时预览、月度/年度看板与导出 JSON。档位名称固定,这里只调整数值。</Info>

      <div className="mt-4 space-y-5">
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-500">档位区间与默认分</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                  <th className="py-2 pr-3 font-medium">档位</th>
                  <th className="py-2 pr-3 font-medium">下限</th>
                  <th className="py-2 pr-3 font-medium">上限</th>
                  <th className="py-2 pr-3 font-medium">默认</th>
                </tr>
              </thead>
              <tbody>
                {TIER_KEYS.map((tier) => (
                  <tr key={tier} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-medium">{TIER_LABEL[tier]}</td>
                    <td className="py-2 pr-3">
                      {numInput(config.tiers[tier].min, (n) => update((next) => (next.tiers[tier].min = n)))}
                    </td>
                    <td className="py-2 pr-3">
                      {numInput(config.tiers[tier].max, (n) => update((next) => (next.tiers[tier].max = n)))}
                    </td>
                    <td className="py-2 pr-3">
                      {numInput(config.tiers[tier].defaultPoints, (n) => update((next) => (next.tiers[tier].defaultPoints = n)))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">交付与 Leader</div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
              <Field label="延期惩罚系数">
                {numInput(config.delivery.delayPenalty, (n) => update((next) => (next.delivery.delayPenalty = n)), 'w-full', 0.1)}
              </Field>
              <Field label="公式启用工期">
                {numInput(config.delivery.formulaMinPlannedDays, (n) => update((next) => (next.delivery.formulaMinPlannedDays = n)), 'w-full')}
              </Field>
              <Field label="管理加成比例">
                {numInput(config.leader.bonusRate, (n) => update((next) => (next.leader.bonusRate = n)), 'w-full', 0.01)}
              </Field>
              <Field label="管理加成月封顶">
                {numInput(config.leader.monthlyCap, (n) => update((next) => (next.leader.monthlyCap = n)), 'w-full')}
              </Field>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">封顶与新人保护</div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
              <Field label="扣分封顶比例">
                {numInput(config.incidents.capRatio, (n) => update((next) => (next.incidents.capRatio = n)), 'w-full', 0.01)}
              </Field>
              <Field label="封顶绝对上限">
                {numInput(config.incidents.capAbsolute, (n) => update((next) => (next.incidents.capAbsolute = n)), 'w-full')}
              </Field>
              <Field label="新人减半月数">
                {numInput(config.incidents.newbieHalfMonths, (n) => update((next) => (next.incidents.newbieHalfMonths = n)), 'w-full')}
              </Field>
              <Field label="Lead 连带比例">
                {numInput(config.incidents.leadDeductionRate, (n) => update((next) => (next.incidents.leadDeductionRate = n)), 'w-full', 0.01)}
              </Field>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">事故基础扣分</div>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3">
              {INCIDENT_KEYS.map((level) => (
                <Field key={level} label={INCIDENT_LABEL[level]}>
                  {numInput(config.incidents.base[level], (n) => update((next) => (next.incidents.base[level] = n)), 'w-full')}
                </Field>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">资损参考线</div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3">
              <Field label="观察上限">
                {numInput(config.assetLoss.observeMax, (n) => update((next) => (next.assetLoss.observeMax = n)), 'w-full')}
              </Field>
              <Field label="P2 上限">
                {numInput(config.assetLoss.p2Max, (n) => update((next) => (next.assetLoss.p2Max = n)), 'w-full')}
              </Field>
              <Field label="P1 上限">
                {numInput(config.assetLoss.p1Max, (n) => update((next) => (next.assetLoss.p1Max = n)), 'w-full')}
              </Field>
              <Field label="币种">
                <input
                  className={inputCls}
                  value={config.assetLoss.currency}
                  onChange={(e) => update((next) => (next.assetLoss.currency = e.target.value))}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">责任系数</div>
            <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3">
              {LIABILITY_KEYS.map((key) => (
                <Field key={key} label={LIABILITY_LABEL[key]}>
                  {numInput(config.incidents.liabilityFactor[key], (n) => update((next) => (next.incidents.liabilityFactor[key] = n)), 'w-full', 0.1)}
                </Field>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">报告系数</div>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3">
              {REPORTING_KEYS.map((key) => (
                <Field key={key} label={REPORTING_LABEL[key]}>
                  {numInput(config.incidents.reportingFactor[key], (n) => update((next) => (next.incidents.reportingFactor[key] = n)), 'w-full', 0.1)}
                </Field>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function MemberModal({ member, onClose, onSave }: { member?: Member; onClose: () => void; onSave: (m: Member) => void }) {
  const [name, setName] = useState(member?.name ?? '');
  const [squad, setSquad] = useState<Squad>(member?.squad ?? '前端');
  const [role, setRole] = useState<Role>(member?.role ?? 'member');
  const [level, setLevel] = useState<Level>(member?.level ?? 'unmapped');
  const [joinDate, setJoinDate] = useState(member?.joinDate ?? todayISO());

  const canSave = !!name.trim();

  const save = () => {
    if (!canSave) return;
    onSave({
      id: member?.id ?? uid('m'),
      name: name.trim(),
      squad,
      role,
      level,
      joinDate,
      active: true,
    });
  };

  return (
    <Modal title={member ? '编辑成员' : '添加成员'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="姓名">
          <input className={inputCls} value={name} autoFocus onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="端">
            <select className={inputCls} value={squad} onChange={(e) => setSquad(e.target.value as Squad)}>
              {SQUADS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="角色">
            <select className={inputCls} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="职级(经本人确认后填写)">
            <select className={inputCls} value={level} onChange={(e) => setLevel(e.target.value as Level)}>
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                <option key={l} value={l}>
                  {LEVEL_LABEL[l]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="入职日期">
            <input type="date" className={inputCls} value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>
            取消
          </button>
          <button className={btnPrimary} onClick={save} disabled={!canSave}>
            保存
          </button>
        </div>
      </div>
    </Modal>
  );
}

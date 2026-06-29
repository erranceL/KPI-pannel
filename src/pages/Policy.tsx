import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import policyMd from '../assets/policy.md?raw';
import { PageHeader } from '../components/ui';

const QUICK_CARDS = [
  { n: 1, title: '活按区间定分', text: '小 1–4 / 中 5–9 / 大 10–24 / 特大 25–50;线上问题处理 3–30;Lead 分活时在区间内取整数定分' },
  { n: 2, title: '交付看工期', text: '工期 ≥3 天:实得 = max(0, 1 − 延期天数 ×1.2 / 工期) × 分值;短活只看交付与否;未交付 0 分。延期提前一天预警不算' },
  { n: 3, title: '线上问题处理', text: '及时响应基础 3 分;主动发现、下班/周日支援、给对分析推动解决取高位;自己 bug 不计正分,按严重度分级' },
  { n: 4, title: '事故与资损', text: '扣分 = 档位 × 责任 × 报告;新增资损级 −300,不封顶、不享高危保护、默认红线、CTO 认定' },
  { n: 5, title: 'Leader 管理加成', text: '所带任务实得分的 10% 计入 Lead 正分,每月封顶 15,计入月度/年度与年终奖分子' },
  { n: 6, title: '红线与申诉', text: '私钥、未审批动资产、泄密、隐瞒事故、伪造记录;有异议公示 2 天内找架构师,搞不定升级 CTO' },
];

export default function Policy() {
  const html = useMemo(() => marked.parse(policyMd, { async: false }) as string, []);
  const articleRef = useRef<HTMLElement>(null);
  const [sections, setSections] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState('');

  useEffect(() => {
    const headings = articleRef.current?.querySelectorAll('h2');
    if (!headings?.length) return;
    const secs = [...headings].map((h, i) => {
      h.id = `sec-${i}`;
      return { id: h.id, text: h.textContent ?? '' };
    });
    setSections(secs);
    setActive(secs[0]?.id ?? '');

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
        }
      },
      { rootMargin: '0px 0px -75% 0px' },
    );
    headings.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="研发绩效积分办法 v2.3(试行)" />

      <div className="grid grid-cols-3 gap-3">
        {QUICK_CARDS.map((c) => (
          <div key={c.n} className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
            <div className="mb-1 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
                {c.n}
              </span>
              <span className="text-sm font-semibold text-indigo-900">{c.title}</span>
            </div>
            <p className="text-xs leading-5 text-indigo-800/80">{c.text}</p>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-5">
        <nav className="sticky top-6 w-44 shrink-0 space-y-0.5 rounded-xl border border-slate-200 bg-white p-2">
          {sections.map((s) => (
            <button
              key={s.id}
              className={`block w-full truncate rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
                active === s.id ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            >
              {s.text}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <article
            ref={articleRef}
            className="policy-doc max-w-none text-sm leading-7 text-slate-700"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>
    </div>
  );
}

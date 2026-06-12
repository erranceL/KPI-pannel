import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import policyMd from '../assets/policy.md?raw';
import { PageHeader } from '../components/ui';

const QUICK_CARDS = [
  { n: 1, title: '活有四档', text: '小 5 / 中 10 / 大 25(接近 2 周可记 30,需备注理由)/ 特大 50,Lead 分活时定档' },
  { n: 2, title: '交付三条', text: '按期全额;延期没预警减半;没交付 0 分。要延期,提前一天说清原因、剩余量、新时间;同一件事最多重排 2 次' },
  { n: 3, title: '主动报告减半', text: '出问题主动报告,扣分减半;隐瞒或拖到影响扩大,加半还触红线' },
  { n: 4, title: '高危操作', text: '合约/资金/生产操作:Review + 审批 + 回滚预案 + 双人复核,信息真实,出事最多算次责' },
  { n: 5, title: '五条红线别碰', text: '私钥、未审批动资产、泄密、隐瞒事故、伪造记录' },
  { n: 6, title: '有异议就申诉', text: '公示 2 天内找架构师,搞不定升级 CTO' },
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
      <PageHeader title="研发绩效积分办法 v2.2(试行)" />

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

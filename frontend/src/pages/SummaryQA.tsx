
// src/pages/SummaryQA.tsx
import React, { useMemo, useState } from "react";
import api from "../api";
import { FileText, Sparkles } from "lucide-react";

type Props = { subjectId: number | null };

export default function SummaryQA({ subjectId }: Props) {
  const [topic, setTopic] = useState("전체 요약");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");

  const sections = useMemo(() => tidySections(parseSections(summary)), [summary]);

  async function createSummary() {
    if (!subjectId) { alert("먼저 자료를 업로드하거나 과목을 선택하세요."); return; }
    try {
      setLoading(true);
      const { data } = await api.post("/summaries", { subject_id: subjectId, topic, type: "overall" });
      setSummary(data.summary || "");
    } finally { setLoading(false); }
  }

  return (
    <section className="sa-card sa-card--tight">
      {/* ── 헤더: 아이콘 + 제목 + 컨트롤(한 줄) */}
      <div className="sa-card__header nowrap">
        <div className="sa-card__title">
          <span className="sa-title-badge">
            <FileText />
          </span>
          <span>AI 자동 요약</span>
        </div>

        <div className="sa-actions">
          {/* “전체 요약”  */}
          <label className="sa-input" aria-label="요약 프롬포트 입력">
            <FileText className="sa-input__icon" />
            <input
              className="sa-input__field"
              value={topic}
              onChange={(e)=>setTopic(e.target.value)}
              onKeyDown={(e)=>{ if (e.key === "Enter") createSummary(); }}
              placeholder="전체 요약해줘"
            />
          </label>

          <button
            className="sa-btn sa-btn--gradient"
            disabled={loading || !subjectId}
            onClick={createSummary}
          >
            <Sparkles size={16}/> {loading ? "생성 중…" : "새 요약 생성"}
          </button>
        </div>
      </div>

      {!summary && (
        <p className="sa-card__desc">아직 생성된 요약이 없습니다. 우측의 <b>새 요약 생성</b> 버튼을 눌러 만들어보세요.</p>
      )}

      {summary && (
        <div className="sa-accordion">
          <AccordionSection title="1) 핵심 개념" defaultOpen content={sections.core}/>
          <AccordionSection title="2) 자주 나오는 함정/오개념" content={sections.traps}/>
          <AccordionSection title="3) 주요 개념 영역별 요약"  content={sections.areas}/>
          <AccordionSection title="4) 3줄 최종 요약"          content={sections.lines3}/>
        </div>
      )}
    </section>
  );
}

/* ---------- 섹션 파서/정리 로직 (기존 그대로) ---------- */
function parseSections(raw: string) {
  const norm = (raw || "").replace(/\r\n/g, "\n");
  const find = (n: number) => norm.search(new RegExp(`(^|\\n)\\s*\\**\\s*${n}\\)\\s*`, "i"));
  const i1 = find(1), i2 = find(2), i3 = find(3), i4 = find(4);
  const seg = (start: number, end: number) => {
    if (start < 0) return "";
    const rest = norm.slice(start);
    const after = rest.replace(/^.*?\)\s*/, "");
    return after.slice(0, end >= 0 ? end - start : undefined).trim();
  };
  return { core: seg(i1, i2), traps: seg(i2, i3), areas: seg(i3, i4), lines3: seg(i4, -1) };
}

function tidySections(s: {core:string; traps:string; areas:string; lines3:string}) {
  const tidy = (txt: string, hints: string[]) => cleanBullets(stripBold(stripDupTitle(txt, hints)));
  return {
    core:   tidy(s.core,  ["핵심 개념","핵심개념"]),
    traps:  tidy(s.traps, ["자주 나오는 함정","오개념"]),
    areas:  tidy(s.areas, ["주요 개념 영역별 요약","개념 영역","영역별 요약"]),
    lines3: tidy(s.lines3,["3줄 최종 요약","최종 요약"]),
  };
}
function stripDupTitle(txt: string, hints: string[]) {
  const first = (txt.split("\n")[0] || "").trim();
  const norm  = first.replace(/\*\*/g,"").replace(/[:：]$/,"").replace(/\s+/g,"");
  if (hints.some(h => norm.includes(h.replace(/\s+/g,"")))) return txt.split("\n").slice(1).join("\n").trim();
  return txt;
}
const stripBold     = (t:string)=> t.replace(/\*\*(.*?)\*\*/g,"$1");
const cleanBullets  = (t:string)=> t.replace(/^\s*[-*]\s+/gm, "• ").replace(/^\s{2,}[-*]\s+/gm,"  · ").trim();

/* ---------- UI: 아코디언 ---------- */
function AccordionSection({ title, content, defaultOpen=false }:{
  title:string; content:string; defaultOpen?:boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`sa-acc ${open ? "open" : ""}`}>
      <button className="sa-acc__header" onClick={()=>setOpen(o=>!o)} aria-expanded={open}>
        <span className="sa-acc__title">{title}</span>
        <span className="sa-acc__chev" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="sa-acc__body">
          {content ? <div style={{whiteSpace:"pre-wrap",lineHeight:1.64}}>{content}</div>
                   : <div style={{color:"var(--sub)"}}>해당 섹션 내용이 없습니다.</div>}
        </div>
      )}
    </div>
  );
}

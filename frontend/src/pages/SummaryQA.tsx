// src/pages/SummaryQA.tsx
// 설명: 좌측 요약 패널(절반 영역). 아코디언(접/펼) + 정리 출력(굵게/중복제목 제거)

// import React, { useMemo, useState } from "react";
// import api from "../api";

// type Props = { subjectId: number | null };

// export default function SummaryQA({ subjectId }: Props) {
//   const [topic, setTopic] = useState("전체 요약");
//   const [loading, setLoading] = useState(false);
//   const [summary, setSummary] = useState<string>("");

//   // 서버가 돌려준 요약 문자열을 1~4 섹션으로 쪼개고, 보기 좋게 정리
//   const sections = useMemo(() => tidySections(parseSections(summary)), [summary]);

//   async function createSummary() {
//     if (!subjectId) { alert("먼저 자료를 업로드하거나 과목을 선택하세요."); return; }
//     try {
//       setLoading(true);
//       const { data } = await api.post("/summaries", {
//         subject_id: subjectId,
//         topic,
//         type: "overall",
//       });
//       setSummary(data.summary || "");
//     } finally {
//       setLoading(false);
//     }
//   }

//   return (
//     <section className="sa-card" style={{ padding: 20 }}>
//       {/* 헤더 */}
//       <div className="sa-card__header" style={{ marginBottom: 12 }}>
//         <div className="sa-card__title" style={{ gap: 8 }}>
//           <span className="sa-title-icon" /> AI 자동 요약
//         </div>
//         <div className="sa-actions">
//           <input
//             className="sa-field-input"
//             placeholder="요약 주제(예: 전체 요약 / 1~3장 위주 / 오개념만 등)"
//             value={topic}
//             onChange={(e)=>setTopic(e.target.value)}
//             style={{ border:'1px solid var(--ring)', borderRadius:10, padding:'8px 10px', width: 280 }}
//           />
//           <button className="sa-btn primary" disabled={loading || !subjectId} onClick={createSummary}>
//             {loading ? "생성 중…" : "새 요약 생성"}
//           </button>
//         </div>
//       </div>

//       {/* 초기 빈 상태 */}
//       {!summary && (
//         <div style={{ color: 'var(--sub)' }}>
//           아직 생성된 요약이 없습니다. 상단의 <b>새 요약 생성</b> 버튼을 눌러 요약을 만들어보세요.
//         </div>
//       )}

//       {/* 아코디언: 1)~4) */}
//       {summary && (
//         <div className="sa-accordion">
//           <AccordionSection title="1) 핵심 개념" defaultOpen content={sections.core}/>
//           <AccordionSection title="2) 자주 나오는 함정/오개념" content={sections.traps}/>
//           <AccordionSection title="3) 주요 개념 영역별 요약" content={sections.areas}/>
//           <AccordionSection title="4) 3줄 최종 요약" content={sections.lines3}/>
//         </div>
//       )}
//     </section>
//   );
// }

// /* ---------- 텍스트 파서(섹션 분리) ---------- */
// function parseSections(raw: string) {
//   const norm = (raw || "").replace(/\r\n/g, "\n");

//   // “1)” ~ “4)” 라벨의 시작 인덱스
//   const find = (n: number) => {
//     // **1) 핵심 개념 / 1)핵심개념 / 1)   … 등 허용
//     const re = new RegExp(`(^|\\n)\\s*\\**\\s*${n}\\)\\s*`, "i");
//     return norm.search(re);
//   };

//   const i1 = find(1), i2 = find(2), i3 = find(3), i4 = find(4);
//   const seg = (start: number, end: number) => {
//     if (start < 0) return "";
//     const rest = norm.slice(start);
//     // “n)” 다음부터 자르기
//     const after = rest.replace(/^.*?\)\s*/, "");
//     return after.slice(0, end >= 0 ? end - start : undefined).trim();
//   };

//   return {
//     core:   seg(i1, i2),
//     traps:  seg(i2, i3),
//     areas:  seg(i3, i4),
//     lines3: seg(i4, -1),
//   };
// }

// /* ---------- 보기 좋게 정리(굵게/헤딩/불릿 정돈) ---------- */
// function tidySections(s: {core:string; traps:string; areas:string; lines3:string}) {
//   const tidy = (txt: string, titleHints: string[]) => cleanBullets(stripBold(stripDupTitle(txt, titleHints)));
//   return {
//     core:   tidy(s.core,  ["핵심 개념", "핵심개념"]),
//     traps:  tidy(s.traps, ["자주 나오는 함정", "오개념"]),
//     areas:  tidy(s.areas, ["주요 개념 영역별 요약", "개념 영역", "영역별 요약"]),
//     lines3: tidy(s.lines3,["3줄 최종 요약","최종 요약"]),
//   };
// }

// // 섹션 맨 앞에 같은 제목이 한 번 더 들어간 경우 제거(굵게/콜론/별표 허용)
// function stripDupTitle(txt: string, hints: string[]) {
//   const firstLine = (txt.split("\n")[0] || "").trim();
//   const norm = firstLine.replace(/\*\*/g,"").replace(/[:：]$/,"").replace(/\s+/g,"");
//   if (hints.some(h => norm.includes(h.replace(/\s+/g,"")))) {
//     return txt.split("\n").slice(1).join("\n").trim();
//   }
//   return txt;
// }

// // **bold** → bold (별표 제거)
// function stripBold(txt: string) {
//   return txt.replace(/\*\*(.*?)\*\*/g, "$1");
// }

// // 마크다운 불릿을 단일 스타일로 정리
// function cleanBullets(txt: string) {
//   return txt
//     .replace(/^\s*[-*]\s+/gm, "• ")          // 1단계 불릿
//     .replace(/^\s{2,}[-*]\s+/gm, "  · ")     // 들여쓰기 불릿
//     .trim();
// }

// /* ---------- UI: 아코디언 섹션 ---------- */
// function AccordionSection({
//   title,
//   content,
//   defaultOpen = false,
// }: {
//   title: string;
//   content: string;
//   defaultOpen?: boolean;
// }) {
//   const [open, setOpen] = useState<boolean>(defaultOpen);
//   return (
//     <div className={`sa-acc ${open ? "open" : ""}`}>
//       <button className="sa-acc__header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
//         <span className="sa-acc__title">{title}</span>
//         <span className="sa-acc__chev" aria-hidden>▾</span>
//       </button>
//       {open && (
//         <div className="sa-acc__body">
//           {content ? (
//             <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.64 }}>{content}</div>
//           ) : (
//             <div style={{ color: "var(--sub)" }}>해당 섹션 내용이 없습니다.</div>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// src/pages/SummaryQA.tsx
import React, { useMemo, useState } from "react";
import api from "../api";
import { FileText, Sparkles, ChevronDown } from "lucide-react";

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
          {/* “전체 요약” 필(Pill) + 드롭 힌트 아이콘 */}
          <div className="sa-pill">
            <FileText className="sa-pill__icon" />
            <input
              className="sa-pill__input"
              value={topic}
              onChange={(e)=>setTopic(e.target.value)}
              placeholder="전체 요약"
            />
            <ChevronDown className="sa-pill__chev" />
          </div>

          <button className="sa-btn sa-btn--gradient" disabled={loading || !subjectId} onClick={createSummary}>
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

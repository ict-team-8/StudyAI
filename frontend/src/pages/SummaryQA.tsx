
// src/pages/SummaryQA.tsx
// 설명: 좌측 요약 패널(절반 영역). 아코디언(접/펼) + 정리 출력(굵게/중복제목 제거)


import React, { useMemo, useRef, useState, useEffect } from "react";
import api from "../api";

type Props = { subjectId: number | null; auto?: boolean; onNext?: () => void };

export default function SummaryQA({ subjectId, auto=false, onNext }: Props) {
  const [topic, setTopic] = useState("전체 요약"); // auto에서 고정값 사용
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");
  const autoFiredRef = useRef(false); // 중복 실행 방지

  // 서버가 돌려준 요약 문자열을 1~4 섹션으로 쪼개고, 보기 좋게 정리
    // 3) Fallback: 섹션이 전부 비면 원문 그대로 표시
const sections = useMemo(() => tidySections(parseSections(summary)), [summary]);
const gotAny = !!(sections.core || sections.traps || sections.areas || sections.lines3);

  async function createSummary() {
    if (!subjectId) { alert("먼저 자료를 업로드하거나 과목을 선택하세요."); return; }
    try {
      setLoading(true);
      const { data } = await api.post("/summaries", {
        subject_id: subjectId,
        topic,
        type: "overall",
      });
      setSummary(data.summary || "");
    } finally {
      setLoading(false);
    }
  }

  // ✅ 자동요약: subjectId가 생기고 아직 안 돌렸으면 1회 실행
  useEffect(() => {
    if (!auto) return;
    if (!subjectId) return;
    if (autoFiredRef.current) return;
    autoFiredRef.current = true;
    createSummary();
  }, [auto, subjectId]);

  // ✅ 확인 후 다음 단계로
  function goNext() {
    if(!onNext) return;
    const ok = window.confirm("스마트 Q&A 기능을 사용하시겠습니까?");
    if (ok) onNext();
  }


  return (
    <section className="sa-card" style={{ padding: 20 }}>
      {/* 헤더 */}
      <div className="sa-card__header" style={{ marginBottom: 12 }}>
        <div className="sa-card__title" style={{ gap: 8 }}>
          <span className="sa-title-icon" /> AI 자동 요약
        </div>

        {/* ❌ auto 모드에선 입력/버튼 제거, 수동 모드만 표시 */}
        {!auto && (
          <div className="sa-actions">
            <input className="sa-field-input" placeholder="요약 주제"
                   defaultValue={topic} readOnly style={{ border:'1px solid var(--ring)', borderRadius:10, padding:'8px 10px', width: 280 }} />
            <button className="sa-btn primary" disabled={loading || !subjectId} onClick={createSummary}>
              {loading ? "생성 중…" : "새 요약 생성"}
            </button>
          </div>
        )}
      </div>

      {/* 상태 */}
      {!summary && (
        <div style={{ color: 'var(--sub)' }}>
          {auto ? "업로드한 자료로 요약을 자동 생성 중입니다…" : "상단의 새 요약 생성 버튼을 눌러 요약을 만들어보세요."}
        </div>
      )}

      {/* 결과 */}
      {!!summary && (
        gotAny ? (
          <div className="sa-accordion">
            <AccordionSection title="1) 핵심 개념" defaultOpen content={sections.core}/>
            <AccordionSection title="2) 자주 나오는 함정/오개념" content={sections.traps}/>
            <AccordionSection title="3) 주요 개념 영역별 요약"  content={sections.areas}/>
            <AccordionSection title="4) 3줄 최종 요약"          content={sections.lines3}/>
          </div>
        ) : (
          <div className="sa-acc open">
            <div className="sa-acc__body" style={{whiteSpace:'pre-wrap', lineHeight:1.64}}>
              {summary}
            </div>
          </div>
        )
      )}

      {/* ✅ 다음 단계: Q&A로 이동 */}
      <div className="sa-card__footer" style={{ justifyContent:'flex-end' }}>
        <button className="sa-btn primary" onClick={goNext} disabled={!summary || loading}>
          다음 단계
        </button>
      </div>
    </section>
  );
}

/* ---------- 텍스트 파서(섹션 분리) ---------- */
// 1) 섹션 파서: 헤딩/굵게/여러 라벨 변형 허용
function parseSections(raw: string) {
  const norm = (raw || "").replace(/\r\n/g, "\n");

  // n): "### **1) …", "(1) …", "1. …", "① …" 등 폭넓게 허용
  const mark = (n: number) =>
    new RegExp(
      String.raw`(^|\n)\s*(?:#{1,6}\s*)?(?:\*\*\s*)?(?:\(?\s*${n}\s*\)?|${["①","②","③","④"][n-1]})\s*[\.)]?:?\s*`,
      "i"
    );

  const i1 = norm.search(mark(1));
  const i2 = norm.search(mark(2));
  const i3 = norm.search(mark(3));
  const i4 = norm.search(mark(4));

  const slice = (start: number, end: number) => {
    if (start < 0) return "";
    // 라벨 줄 전체를 날리고 본문만
    const after = norm.slice(start).replace(/^.*?(\n|$)/, "");
    return after.slice(0, end >= 0 ? end - start : undefined).trim();
  };

  return {
    core:   slice(i1, i2),
    traps:  slice(i2, i3),
    areas:  slice(i3, i4),
    lines3: slice(i4, -1),
  };
}
// 2) 보기 좋게 정리(중복 타이틀/굵게/불릿)
function tidySections(s: {core:string; traps:string; areas:string; lines3:string}) {
  const tidy = (txt: string, hints: string[]) =>
    cleanBullets(stripBold(stripDupTitle(txt, hints)));
  return {
    core:   tidy(s.core,  ["핵심 개념","핵심개념"]),
    traps:  tidy(s.traps, ["자주 나오는 함정","오개념"]),
    areas:  tidy(s.areas, ["주요 개념 영역별 요약","개념 영역","영역별 요약"]),
    lines3: tidy(s.lines3,["3줄 최종 요약","최종 요약"]),
  };
}

// 섹션 맨 앞에 같은 제목이 한 번 더 들어간 경우 제거(굵게/콜론/별표 허용)
function stripDupTitle(txt: string, hints: string[]) {
  const first = (txt.split("\n")[0] || "").trim();
  const norm  = first.replace(/\*\*/g,"").replace(/[:：]$/,"").replace(/\s+/g,"");
  if (hints.some(h => norm.includes(h.replace(/\s+/g,""))))
    return txt.split("\n").slice(1).join("\n").trim();
  return txt;
}

// **bold** → bold (별표 제거)
const stripBold    = (t:string)=> t.replace(/\*\*(.*?)\*\*/g,"$1");

// 마크다운 불릿을 단일 스타일로 정리
const cleanBullets = (t:string)=>
  t.replace(/^\s*[-*]\s+/gm, "• ")
   .replace(/^\s{2,}[-*]\s+/gm, " · ")
   .trim();

/* ---------- UI: 아코디언 섹션 ---------- */
function AccordionSection({
  title,
  content,
  defaultOpen = false,
}: {
  title: string;
  content: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<boolean>(defaultOpen);
  return (
    <div className={`sa-acc ${open ? "open" : ""}`}>
      <button className="sa-acc__header" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="sa-acc__title">{title}</span>
        <span className="sa-acc__chev" aria-hidden>▾</span>
      </button>
      {open && (
        <div className="sa-acc__body">
          {content ? (
            <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.64 }}>{content}</div>
          ) : (
            <div style={{ color: "var(--sub)" }}>해당 섹션 내용이 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}

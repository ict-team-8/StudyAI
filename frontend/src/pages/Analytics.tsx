
import React, { useEffect, useMemo, useState } from "react";
import api from "../api";
import { Trophy, Gauge, Clock, BookOpenText, BarChart2 } from "lucide-react";
import SubjectPicker, { type Subject } from "../components/SubjectPicker";

type Props = {
  subjectId: number | null;
  onPickSubject: (id: number | null, name?: string) => void;
};

const DIFF_LABEL: Record<"easy"|"medium"|"hard", string> = {
  easy: "쉬움", medium: "보통", hard: "어려움"
};

// 빈 히스토리 상수
const EMPTY_HIS: SubjectHistoryResponse = {
  summaries: [], qa_sessions: [], quiz_sets: [], quiz_attempts: []
};


/** ---- 서버 응답 타입 (routers/analytics.py와 일치) ---- */
type OverviewCard = {
  overall_accuracy: number; grade: string;
  total_questions_answered: number; weekly_delta_percent: number;
  total_correct: number; total_study_minutes: number;
  streak_days: number; weekly_avg_minutes: number; status: string;
};
type SummaryBrief = { summary_id:number; type:"overall"|"traps"|"concept_areas"|"three_lines"; topic:string; excerpt:string; model?:string|null; created_at:string; };
type QASessionBrief = { chat_session_id:number; title:string; last_question?:string|null; last_answer_preview?:string|null; last_turn_at?:string|null; turn_count:number; };
type QuizSetBrief = { quizset_id:number; requested_count:number; difficulty:"easy"|"medium"|"hard"; types:string[]; created_at:string; };
type QuizAttemptBrief = { attempt_id:number; quizset_id:number; submitted_at?:string|null; correct_count:number; accuracy:number; grade:string; };
type SubjectHistoryResponse = { summaries:SummaryBrief[]; qa_sessions:QASessionBrief[]; quiz_sets:QuizSetBrief[]; quiz_attempts:QuizAttemptBrief[]; };

// const pct = (v:number,d=0)=>`${(v*100).toFixed(d)}%`;
const pct = (v:number, d=0) => `${v.toFixed(d)}%`;   // ← 이미 % 값이 들어옴
const hhmm = (m:number)=>{ const h=Math.floor(m/60), mi=m%60; return h?`${h}시간 ${mi}분`:`${mi}분`; };
const delta = (p:number)=>`${p>0?"+":""}${p.toFixed(0)}%`;

const timeLabel = (m:number, studied:boolean) =>
  m > 0 ? hhmm(m) : (studied ? "1분 미만" : "0분");

export default function Analytics({ subjectId, onPickSubject }: Props){
  const [subject, setSubject] = useState<Subject|null>(null);
  const [ov, setOv] = useState<OverviewCard|null>(null);
  // 변경 : his 초기값을 null -> 빈값
  const [his, setHis] = useState<SubjectHistoryResponse|null>(EMPTY_HIS);
  const [loading, setLoading] = useState(false);

  // 상위 상태와 동기화
  useEffect(()=>{ 
    if(subjectId && (!subject || subject.subject_id!==subjectId)){
      // 이름은 모르므로 표시만 ID 유지
      setSubject({ subject_id: subjectId, name: `#${subjectId}` });
    }
    if(subjectId===null) setSubject(null);
  }, [subjectId]);

  // 데이터 로드 useEffect
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const sid = subject?.subject_id;

        // 1) overview는 과목이 있으면 필터 걸고, 없으면 전체
        const qs = sid ? `?subject_id=${sid}` : "";
        const { data: overview } = await api.get<OverviewCard>(`/analytics/overview${qs}`);
        if (cancelled) return;
        setOv(overview);

        // 2) 과목이 없으면 히스토리는 건너뛰고 빈값 유지
        if (!sid) {
          setHis(EMPTY_HIS);
          return;
        }

        // 3) 과목이 있을 때만 히스토리 호출
        const { data: history } = await api.get<SubjectHistoryResponse>(
          `/analytics/subject/${sid}/history`,
          { params: { limit: 20 } }
        );
        if (cancelled) return;
        setHis(history ?? EMPTY_HIS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [subject?.subject_id]);

  // 과목 선택 콜백: 상위(App)에도 반영
  function handlePick(s: Subject){
    if (!s || !s.subject_id) {
      setSubject(null);
      onPickSubject(null);
      return;
    }
    setSubject(s);
    onPickSubject(s.subject_id, s.name);
  }

  return (
    <section className="sa-card">
      {/* 헤더 */}
      <div className="sa-card__header nowrap">
        <div className="sa-card__title">
          <span className="sa-title-badge"><BarChart2/></span>
          학습 분석
        </div>
        <SubjectPicker subject={subject} onPick={handlePick} />
      </div>

      <p className="sa-card__desc">
        상단은 전체 메트릭, 하단은 선택한 과목의 요약/QA/문제/풀이 이력입니다.
      </p>

      {/* 상단 메트릭 4칸 */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        <MetricCard title="전체 정답률" icon={<Trophy/>}
          main={ov?pct(ov.overall_accuracy):"0%"} sub={ov?`등급 ${ov.grade}`:"등급 F"} meter={(ov?.overall_accuracy ?? 0) / 100}/>
        <MetricCard title="총 문제 수" icon={<BookOpenText/>}
          main={ov ? timeLabel(ov.total_study_minutes, ov.total_questions_answered > 0) : "0분"} sub={ov?`이번주 ${delta(ov.weekly_delta_percent)} · 정답 ${ov.total_correct}개`:"이번주 0% · 정답 0개"}/>
        <MetricCard title="총 학습시간" icon={<Clock/>}
          main={ov?hhmm(ov.total_study_minutes):"0분"} sub={ov?`연속 ${ov.streak_days}일 · 주간 평균 ${ov.weekly_avg_minutes}분`:"연속 0일 · 주간 평균 0분"}/>
        <MetricCard title="학습 상태" icon={<Gauge/>}
          main={ov?ov.status:"노력 필요"} sub={ov?`등급 ${ov.grade}`:"등급 F"}/>
      </div>

      {/* 과목별 히스토리 */}
      <div className="sa-card" style={{ marginTop:16 }}>
        <div className="sa-card__title">과목별 히스토리</div>

        {/* 단일 삼항으로 분기 */}
        {!subject ? (
          <p className="sa-card__desc">과목을 선택하면 요약/QA/문제/풀이 이력이 표시됩니다.</p>
        ) : loading ? (
          <p>불러오는 중…</p>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
            <HistoryList
              title="요약(Summaries)"
              items={(his?.summaries ?? []).map(s=>({
                id:s.summary_id,
                title:`${s.type} · ${s.topic}`,
                right:s.model ?? "",
                subtitle:new Date(s.created_at).toLocaleString(),
                body:s.excerpt
              }))}
              empty="아직 요약이 없습니다."
            />
            <HistoryList
              title="스마트 QA 세션"
              items={(his?.qa_sessions ?? []).map(q=>({
                id:q.chat_session_id,
                title:q.title,
                right:`${q.turn_count}턴`,
                subtitle:q.last_turn_at ? new Date(q.last_turn_at).toLocaleString() : "최근 활동 없음",
                body:q.last_answer_preview || q.last_question || ""
              }))}
              empty="아직 QA 기록이 없습니다."
            />
            <HistoryList
              title="문제 세트"
              items={(his?.quiz_sets ?? []).map(z=>({
                id:z.quizset_id,
                title:`#${z.quizset_id} · ${DIFF_LABEL[z.difficulty]} · ${z.types.join(", ")}`,
                right:`${z.requested_count}문항`,
                subtitle:new Date(z.created_at).toLocaleString()
              }))}
              empty="아직 생성된 문제 세트가 없습니다."
            />
            <HistoryList
              title="세트 풀이 결과"
              items={(his?.quiz_attempts ?? []).map(a=>({
                id:a.attempt_id,
                title:`세트 #${a.quizset_id} · ${Math.round(a.accuracy)}% (${a.grade})`,
                right:`정답 ${a.correct_count}개`,
                subtitle:a.submitted_at ? new Date(a.submitted_at).toLocaleString() : "제출시각 없음"
              }))}
              empty="아직 풀이 기록이 없습니다."
            />
          </div>
        )}
</div>
    </section>
  );
}

/* ----- 프레젠테이션 컴포넌트 ----- */
function MetricCard({ title, icon, main, sub, meter }:{
  title:string; icon:React.ReactNode; main:string; sub?:string; meter?:number;
}){
  const w = Math.max(0, Math.min(1, meter ?? 0)) * 100;
  return (
    <div className="sa-card sa-card--tight" style={{ padding:16 }}>
      <div className="sa-card__title" style={{ gap:10 }}>
        <span className="sa-title-badge">{icon}</span><span>{title}</span>
      </div>
      <div style={{ fontWeight:800, fontSize:28, marginTop:8 }}>{main}</div>
      {sub && <div className="sa-card__desc">{sub}</div>}
      {meter!=null && (
        <div style={{ height:8, background:"#eef2ff", borderRadius:999, marginTop:8 }}>
          <div style={{ width:`${w}%`, height:"100%", borderRadius:999, background:"linear-gradient(180deg,#7c6cff,#5f49ff)" }}/>
        </div>
      )}
    </div>
  );
}

function HistoryList({ title, items, empty }:{
  title:string;
  items:{ id:number|string; title:string; right?:string; subtitle?:string; body?:string }[];
  empty:string;
}){
  return (
    <div className="sa-card">
      <div className="sa-card__title">{title}</div>
      {items.length===0 ? <p className="sa-card__desc">{empty}</p> : (
        <ul className="sa-list" style={{ marginTop:10 }}>
          {items.map(it=>(
            <li key={it.id} className="sa-list__item">
              <div style={{ display:"flex", justifyContent:"space-between", gap:12 }}>
                <div style={{ fontWeight:700 }}>{it.title}</div>
                {it.right && <div style={{ color:"#64748b", fontWeight:700 }}>{it.right}</div>}
              </div>
              {it.subtitle && <div style={{ color:"#64748b", fontSize:13, marginTop:4 }}>{it.subtitle}</div>}
              {it.body && <div style={{ marginTop:6, color:"#334155" }}>{it.body}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


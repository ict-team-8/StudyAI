// 탭 네비게이션
// 설명: 상단 라운드 탭바(자료 업로드 활성)
// ===============================
// 탭 이름 타입(필요시 라우팅으로 확장 가능)
export type TabKey = "upload" | "qa" | "gen" | "solve" | "analytics";

export default function Tabs({
  active,            // 현재 활성 탭
  onSelect,          // 탭 클릭 시 상위로 알림
}: {
  active: TabKey;
  onSelect: (key: TabKey) => void;
}) {
  // 공통 렌더러: active 여부에 따라 클래스 토글
  const Item = ({ k, label }: { k: TabKey; label: string }) => (
    <button
      type="button"
      className={`sa-tab ${active === k ? "active" : ""}`}
      onClick={() => onSelect(k)}       // 👉 클릭 시 상위에 선택 이벤트 전달
    >
      {label}
    </button>
  );

  return (
    <nav className="sa-tabs" role="tablist" aria-label="StudyAI Tabs">
      <Item k="upload"    label="📤 자료 업로드" />
      <Item k="qa"        label="🧠 요약 & Q&A" />
      <Item k="gen"       label="❓ 문제 생성" />
      <Item k="solve"     label="📘 문제 풀이" />
      <Item k="analytics" label="📊 학습 분석" />
    </nav>
  );
}

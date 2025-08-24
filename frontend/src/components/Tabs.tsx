import React from "react";
import {
  IconTabUpload, IconTabQA, IconTabGen, IconTabSolve, IconTabAnalytics
} from "./icons";

export type TabKey = "upload" | "qa" | "gen" | "solve" | "analytics";

export default function Tabs({
  active, onSelect,
}: { active: TabKey; onSelect: (key: TabKey) => void; }) {

  const Item = ({ k, label, Icon }:{
    k: TabKey; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  }) => (
    <button
      type="button"
      className={`sa-tab ${active === k ? "active" : ""}`}
      onClick={() => onSelect(k)}
    >
      <Icon className="sa-tab__icon" />
      <span>{label}</span>
    </button>
  );

  return (
    <nav className="sa-tabs" role="tablist" aria-label="StudyAI Tabs">
      <Item k="upload"    label="자료 업로드" Icon={IconTabUpload}/>
      <Item k="qa"        label="요약 & Q&A" Icon={IconTabQA}/>
      <Item k="gen"       label="문제 생성"  Icon={IconTabGen}/>
      <Item k="solve"     label="문제 풀이"  Icon={IconTabSolve}/>
      <Item k="analytics" label="학습 분석"  Icon={IconTabAnalytics}/>
    </nav>
  );
}

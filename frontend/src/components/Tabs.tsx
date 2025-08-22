// 탭 네비게이션
// 설명: 상단 라운드 탭바(자료 업로드 활성)
// ===============================
import React from "react";

export default function Tabs(){
  return (
    <nav className="sa-tabs">
      <a className="sa-tab active">📤 자료 업로드</a>
      <a className="sa-tab">🧠 요약 & Q&A</a>
      <a className="sa-tab">❓ 문제 생성</a>
      <a className="sa-tab">📘 문제 풀이</a>
      <a className="sa-tab">📊 학습 분석</a>
    </nav>
  );
}
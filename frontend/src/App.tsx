// ===============================
// 설명: 페이지 쉘(헤더 + 상단 배경 + UploadPage)
// ===============================
import React from "react";
import Header from "./components/Header";
import UploadPage from "./pages/UploadPage";

export default function App(){
  return (
    <div className="sa-root">
      <div className="sa-top-bg"/>{/* 상단 라디얼 그라데이션 배경 */}
      <Header/>
      <main className="sa-main">
        <UploadPage/>
      </main>
    </div>
  );
}
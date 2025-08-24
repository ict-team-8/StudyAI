// ===============================
// 설명: 헤더(로고/부제목, Beta, 로그인/로그아웃)
// ===============================
import React, { useState } from "react";
import { useAuth } from "../auth";
import LoginModal from "./LoginModal";


export default function Header(){
  const { user, logout } = useAuth();
  const [openLogin, setOpenLogin] = useState(false);
  return (
    <header className="sa-header">
      <div className="sa-header__left">
        {/* 로고(아이콘 + 텍스트) */}
        <div className="sa-logo">
          <div className="sa-logo__icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="12" cy="12" r="10" fill="#6f5bff"/><path d="M8 12l2.2 2.2L16 8.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div className="sa-logo__text">
            <div className="sa-logo__title">StudyAI</div>
            <div className="sa-logo__subtitle">AI 기반 스마트 학습 플랫폼</div>
          </div>
        </div>
      </div>
      <div className="sa-header__right">
        <span className="sa-badge">Beta</span>
        {user ? (
          <div className="sa-user">
            <span className="sa-user__email">{user.email}</span>
            <button className="sa-btn ghost" onClick={logout}>로그아웃</button>
          </div>
        ) : (
          <button className="sa-btn" onClick={()=>setOpenLogin(true)}>로그인</button>
        )}
      </div>
      {/* 로그인 모달 */}
      <LoginModal open={openLogin} onClose={()=>setOpenLogin(false)} />
    </header>
  );
}
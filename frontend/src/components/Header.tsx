// ===============================
// 설명: 헤더(로고/부제목, Beta, 로그인/로그아웃)
// ===============================
import React, { useState } from "react";
import { useAuth } from "../auth";
import LoginModal from "./LoginModal";
import { IconStudyAI } from "./icons";   // ⬅ 추가

export default function Header(){
  const { user, logout } = useAuth();
  const [openLogin, setOpenLogin] = useState(false);
  return (
    <header className="sa-header">
      <div className="sa-header__left">
        <div className="sa-logo">
          <div className="sa-logo__icon--big">
            <IconStudyAI />
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
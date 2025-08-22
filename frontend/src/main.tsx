// ===============================
// 설명: 엔트리 — AuthProvider로 감싸고 전역 CSS 로드
// ===============================
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./auth";
import "./styles.css"; // 레퍼런스 룩앤필 CSS

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <App/>
    </AuthProvider>
  </React.StrictMode>
);

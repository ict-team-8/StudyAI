import { Link } from "react-router-dom";
import { getAuthToken, clearAuthToken } from "./api";

export default function App() {
  const token = getAuthToken();
  return (
    <div style={{padding:24}}>
      <h1>FastAPI + React Quick Tester</h1>
      <ul>
        <li><Link to="/health">/health 확인</Link></li>
        <li><Link to="/auth">회원가입/로그인/JWT</Link></li>
        <li><Link to="/summary">AI 요약/QA</Link></li>
      </ul>
      <div style={{marginTop:12}}>
        현재 토큰: {token ? token.slice(0,24) + "..." : "(없음)"}
        {token && <button style={{marginLeft:8}} onClick={()=>{clearAuthToken(); location.reload()}}>토큰 지우기</button>}
      </div>
    </div>
  )
}

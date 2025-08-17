import { useState } from "react";
import api, { setAuthToken, getAuthToken } from "../api";

export default function AuthPage(){
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState("");

  async function register(){
    const { data } = await api.post("/auth/register", { email, password });
    setResult(JSON.stringify(data, null, 2));
    alert("가입 완료! 로그인 해보세요.");
  }

  async function login(){
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    const { data } = await api.post("/auth/jwt/login", form, {
      headers: {"Content-Type":"application/x-www-form-urlencoded"}
    });
    setAuthToken(data.access_token);
    setResult("로그인 성공. 토큰 저장됨.");
  }

  async function me(){
    const { data } = await api.get("/users/me");
    setResult(JSON.stringify(data, null, 2));
  }

  return (
    <div style={{padding:24, display:"grid", gap:8, maxWidth:480}}>
      <h2>Auth 테스트</h2>
      <input placeholder="email" value={email} onChange={e=>setEmail(e.target.value)}/>
      <input placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)}/>
      <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
        <button onClick={register}>회원가입</button>
        <button onClick={login}>로그인(JWT)</button>
        <button onClick={me} disabled={!getAuthToken()}>/users/me</button>
      </div>
      <pre style={{whiteSpace:"pre-wrap"}}>{result}</pre>
    </div>
  )
}

import { useState } from "react";
import api from "../api";

export default function SummaryPage(){
  const [mode, setMode] = useState<"summary"|"qa">("summary");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File|undefined>();
  const [question, setQuestion] = useState("");
  const [out, setOut] = useState("");

  async function run(){
    const form = new FormData();
    form.append("mode", mode);
    if(text) form.append("text", text);
    if(url) form.append("url", url);
    if(file) form.append("file", file);
    if(mode==="qa") form.append("question", question);

    const { data } = await api.post("/ai/summary", form);
    setOut(data.result);
  }

  return (
    <div style={{padding:24, display:"grid", gap:12}}>
      <h2>AI 요약/QA</h2>
      <div>
        <label><input type="radio" checked={mode==="summary"} onChange={()=>setMode("summary")}/> summary</label>
        <label style={{marginLeft:12}}><input type="radio" checked={mode==="qa"} onChange={()=>setMode("qa")}/> qa</label>
      </div>
      <textarea rows={6} placeholder="텍스트 직접 입력" value={text} onChange={e=>setText(e.target.value)}/>
      <input placeholder="또는 URL" value={url} onChange={e=>setUrl(e.target.value)}/>
      <input type="file" accept="application/pdf" onChange={e=>setFile(e.target.files?.[0])}/>
      {mode==="qa" && <input placeholder="질문(qa 모드)" value={question} onChange={e=>setQuestion(e.target.value)}/>}
      <button onClick={run}>실행</button>
      <pre style={{whiteSpace:"pre-wrap"}}>{out}</pre>
    </div>
  )
}

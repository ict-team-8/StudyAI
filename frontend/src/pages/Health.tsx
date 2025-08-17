import { useState } from "react";
import api from "../api";

export default function Health(){
  const [resp, setResp] = useState<string>("");

  async function ping() {
    const { data } = await api.get("/health");
    setResp(JSON.stringify(data, null, 2));
  }

  return (
    <div style={{padding:24}}>
      <h2>/health</h2>
      <button onClick={ping}>GET /health</button>
      <pre style={{whiteSpace:"pre-wrap", marginTop:12}}>{resp}</pre>
    </div>
  )
}

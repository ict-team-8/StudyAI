// api/quiz.ts
import axios from "axios";

export async function postNextAttempt(data: {
  quiz_attempt_id: number;
  question_bank_id: number;
  user_answer: string;
  time_ms: number;
}) {
  const res = await axios.post("/api/quiz/next", data, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("accessToken")}`, // 토큰 필요시
    },
  });
  return res.data;
}

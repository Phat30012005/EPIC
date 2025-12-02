// supabase/functions/chat-bot/index.ts
// (PHIÊN BẢN V11 - NATIVE DB SEARCH - MẠNH MẼ NHẤT)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Cấu hình cứng Model
const MODEL_NAME = "gemini-1.5-flash";

// 1. Hàm vệ sinh JSON (Vẫn cần thiết)
function cleanJsonOutput(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return text;
}

// 2. Gọi Gemini
async function callGemini(
  apiKey: string,
  prompt: string,
  isJsonMode: boolean = false
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;
  const body: any = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
  if (isJsonMode)
    body.generationConfig = { responseMimeType: "application/json" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.error("Gemini Error:", e);
    return null;
  }
}

// 3. Phân tích Intent
async function parseIntent(apiKey: string, message: string) {
  // Prompt này chỉ tập trung lấy KEYWORD (địa danh/tên) và PRICE
  // Không cần lo về từ "giúp", "với" vì Database FTS sẽ tự xử lý tốt hơn
  const prompt = `
    Extract info from Vietnamese real estate query: "${message}"
    Output JSON: 
    {
      "max_price": number | null (Convert to VND integer),
      "keyword": string | null (Location name, Street, District. Remove filler words like 'tìm', 'giúp', 'muốn'. If generic like 'trọ', return null)
    }
    Example: "tìm trọ dưới 3 triệu giúp" -> {"max_price": 3000000, "keyword": null}
    Example: "trọ ở Ninh Kiều 2tr" -> {"max_price": 2000000, "keyword": "Ninh Kiều"}
  `;

  const raw = await callGemini(apiKey, prompt, true);
  if (!raw) return null;
  try {
    return JSON.parse(cleanJsonOutput(raw));
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Auth failed");

    const { message } = await req.json();

    // === BƯỚC 1: HIỂU ===
    const intent = (await parseIntent(GEMINI_API_KEY!, message)) || {};
    console.log("Intent Parsed:", intent);

    // === BƯỚC 2: TÌM KIẾM BẰNG DB FUNCTION (RPC) ===
    // Gọi hàm SQL chúng ta vừa tạo. Đây là chìa khóa!
    const { data: posts, error } = await supabase.rpc("match_posts_advanced", {
      p_keyword: intent.keyword || null,
      p_max_price: intent.max_price || null,
      p_limit: 5,
    });

    if (error) console.error("RPC Error:", error);

    // === BƯỚC 3: PHẢN HỒI ===
    const foundPosts = posts || [];
    let context = "";

    if (foundPosts.length > 0) {
      context = `Tìm thấy ${foundPosts.length} phòng khớp yêu cầu (${
        intent.max_price ? "< " + intent.max_price : "mọi giá"
      }, từ khóa: "${intent.keyword || "không"}").`;
    } else {
      // Fallback: Lấy tin mới nhất
      const { data: newest } = await supabase
        .from("posts")
        .select("*")
        .limit(3)
        .order("created_at", { ascending: false });
      foundPosts.push(...(newest || []));
      context = `Không tìm thấy phòng khớp chính xác yêu cầu. Đã lấy danh sách phòng mới nhất để gợi ý. Hãy xin lỗi khách.`;
    }

    const listText = foundPosts
      .map(
        (p: any, i: number) =>
          `${i + 1}. ${
            p.motelName || p.title
          } - ${p.price?.toLocaleString()}đ - ${p.ward}`
      )
      .join("\n");

    const replyPrompt = `
      Bạn là Gà Bông 🐣.
      Khách hỏi: "${message}"
      Kết quả hệ thống: ${context}
      Danh sách phòng:
      ${listText}
      
      Yêu cầu: Trả lời ngắn gọn, vui vẻ. Nếu là danh sách gợi ý (không khớp), phải nói rõ.
    `;

    const botReply =
      (await callGemini(GEMINI_API_KEY!, replyPrompt)) ||
      "Gà Bông đang lag nhẹ, bạn hỏi lại nhé 🐣";

    // Log chat
    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, content: botReply, is_bot: true });

    return new Response(JSON.stringify({ success: true, reply: botReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

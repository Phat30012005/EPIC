// supabase/functions/chat-bot/index.ts
// VERSION V13 — THE MASTERPIECE (JSON SCHEMA + ROBUST SANITIZER)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

//
// ---------------------------------------------------------
// 1. CORS & CONFIG
// ---------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

//
// ---------------------------------------------------------
// 2. UTILS
// ---------------------------------------------------------

// Vệ sinh JSON an toàn (Dự phòng cho trường hợp Schema trả về markdown)
function safeJson(txt = "") {
  try {
    txt = txt.replace(/```[\s\S]*?```/g, "").trim(); // Xóa markdown nếu có
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

// [CỰC KỲ QUAN TRỌNG] Bộ lọc từ khóa mạnh mẽ từ V11
// Ngăn chặn AI hiểu nhầm các từ giao tiếp là địa điểm
function sanitizeKeyword(kw: string | null) {
  if (!kw) return null;
  const lower = kw.toLowerCase().trim();

  // Danh sách đen các từ không phải địa điểm
  const blockList = [
    "trọ",
    "phòng",
    "nhà",
    "căn",
    "hộ",
    "chung",
    "cư",
    "ở",
    "tại",
    "khu",
    "vực",
    "quận",
    "huyện",
    "thành",
    "phố",
    "tìm",
    "kiếm",
    "cần",
    "thuê",
    "muốn",
    "giá",
    "giúp",
    "với",
    "mình",
    "nha",
    "nhé",
    "ạ",
    "ơi",
    "ad",
    "admin",
    "gấp",
  ];

  // 1. Loại bỏ ký tự đặc biệt SQL
  let safeKw = lower.replace(/[%_'"();]/g, "");

  // 2. Kiểm tra danh sách đen
  if (blockList.includes(safeKw)) return null;

  // 3. Kiểm tra độ dài (dưới 2 ký tự là vô nghĩa)
  if (safeKw.length < 2) return null;

  return safeKw; // Trả về từ khóa sạch (ví dụ: "ninh kiều", "lê bình")
}

// Fetch an toàn với timeout và retry
async function safeFetch(url, options: any = {}, retries = 1, timeout = 8000) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 500)); // Đợi 0.5s trước khi thử lại
    }
  }
}

//
// ---------------------------------------------------------
// 3. AI LOGIC (GEMINI)
// ---------------------------------------------------------

async function callGemini(apiKey: string, prompt: string, schema: any = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const body: any = { contents: [{ role: "user", parts: [{ text: prompt }] }] };

  if (schema) {
    body.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: schema,
    };
  }

  const data = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

async function parseIntent(apiKey: string, message: string) {
  const schema = {
    type: "object",
    properties: {
      max_price: { type: "integer", nullable: true }, // Gemini 1.5 dùng "nullable"
      keyword: { type: "string", nullable: true },
    },
    required: ["max_price", "keyword"],
  };

  const prompt = `
  Role: AI phân tích tìm kiếm bất động sản Việt Nam.
  Input: "${message}"
  
  Nhiệm vụ: Trích xuất JSON chính xác.
  1. max_price: Đổi về số nguyên VNĐ (ví dụ: "3 triệu" -> 3000000).
  2. keyword: Chỉ lấy tên địa danh (Phường, Đường, Quận). Bỏ qua các từ như "tìm", "giúp", "ở", "tại".
  `;

  const raw = await callGemini(apiKey, prompt, schema);
  const json = safeJson(raw);

  return {
    max_price: json?.max_price || null,
    // Áp dụng bộ lọc sanitizeKeyword ngay tại đây để an toàn tuyệt đối
    keyword: sanitizeKeyword(json?.keyword || null),
  };
}

//
// ---------------------------------------------------------
// 4. MAIN HANDLER
// ---------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
    if (!GEMINI_API_KEY) throw new Error("Missing API Key");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Auth failed");

    const { message } = await req.json();

    // === BƯỚC 1: HIỂU Ý ===
    const intent = await parseIntent(GEMINI_API_KEY, message);
    console.log("Parsed Intent:", intent); // Debug log

    // === BƯỚC 2: TÌM KIẾM (RPC) ===
    // Gọi hàm SQL thông minh trong Database
    const { data: posts } = await supabase.rpc("match_posts_advanced", {
      p_keyword: intent.keyword,
      p_max_price: intent.max_price,
      p_limit: 5,
    });

    // === BƯỚC 3: XỬ LÝ KẾT QUẢ ===
    let finalPosts = posts || [];
    let context = "";
    let isFallback = false;

    if (finalPosts.length === 0) {
      // Fallback: Lấy tin mới nhất
      const { data: newest } = await supabase
        .from("posts")
        .select("*")
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(3);
      finalPosts = newest || [];
      isFallback = true;
      context = `Không tìm thấy phòng khớp yêu cầu (${
        intent.max_price ? "<" + intent.max_price : ""
      }, ${intent.keyword || "tất cả"}). Gợi ý phòng mới nhất:`;
    } else {
      context = `Tìm thấy ${finalPosts.length} phòng phù hợp:`;
    }

    const listText = finalPosts
      .map(
        (p: any, i: number) =>
          `${i + 1}. ${
            p.motelName || p.title
          } — ${p.price?.toLocaleString()}đ — ${p.ward}`
      )
      .join("\n");

    // === BƯỚC 4: TRẢ LỜI ===
    const replyPrompt = `
      Bạn là Gà Bông 🐣.
      User: "${message}"
      Context: ${context}
      Danh sách:
      ${listText}
      
      Yêu cầu:
      - Giọng vui vẻ, ngắn gọn.
      - ${
        isFallback
          ? "Xin lỗi khéo và mời xem phòng gợi ý."
          : "Mời khách xem phòng tìm được."
      }
      - Không bịa thông tin.
    `;

    const botReply =
      (await callGemini(GEMINI_API_KEY, replyPrompt)) ||
      "Gà Bông đang lag xíu, bạn thử lại nha 🐣";

    // Lưu log
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      content: botReply,
      is_bot: true,
    });

    return new Response(JSON.stringify({ success: true, reply: botReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

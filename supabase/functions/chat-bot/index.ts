// supabase/functions/chat-bot/index.ts
// VERSION V17 - NO-RPC (CHẠY TRỰC TIẾP TRÊN CODE - KHÔNG CẦN MIGRATION)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 1. CÁC HÀM XỬ LÝ TỪ KHÓA (GIỮ NGUYÊN VÌ ĐÃ TỐT)
function cleanJson(text: string): string {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

function normalizeKeyword(keyword: string | null) {
  if (!keyword) return null;
  let k = keyword
    .toLowerCase()
    .trim()
    .replace(/[.,;?!]/g, "");

  // Từ khóa cấm (Stopwords)
  const blacklist = [
    "giúp",
    "với",
    "mình",
    "nha",
    "nhé",
    "tìm",
    "trọ",
    "phòng",
    "cần",
    "thuê",
    "ở",
    "tại",
    "giá",
    "dưới",
    "khoảng",
    "tầm",
    "muốn",
    "cho",
    "em",
  ];
  if (blacklist.includes(k)) return null;

  // Map địa phương
  const aliasMap: Record<string, string> = {
    dhct: "Đại học Cần Thơ",
    đhct: "Đại học Cần Thơ",
    ctu: "Đại học Cần Thơ",
    fpt: "FPT",
    "nam cần thơ": "Nam Cần Thơ",
    dhnct: "Nam Cần Thơ",
    "3/2": "3/2",
    "30/4": "30/4",
    "ninh kiều": "Ninh Kiều",
    "cái răng": "Cái Răng",
    "bình thủy": "Bình Thủy",
    "ô môn": "Ô Môn",
  };

  if (aliasMap[k]) return aliasMap[k];
  for (const key in aliasMap) {
    if (k.includes(key)) return aliasMap[key];
  }

  return keyword.replace(/[%_]/g, "").trim();
}

// 2. GỌI GEMINI (JSON)
async function callGeminiJSON(apiKey: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });
    const json = await res.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return rawText ? JSON.parse(cleanJson(rawText)) : null;
  } catch (e) {
    return null;
  }
}

// 3. GỌI GEMINI (TEXT)
async function callGeminiText(apiKey: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// 4. MAIN HANDLER
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Auth failed");

    const { message } = await req.json();

    // === BƯỚC 1: HIỂU Ý ===
    const promptIntent = `
      User: "${message}"
      Task: Extract info.
      Rules:
      - keyword: Location/Name only. Ignore "tìm", "giúp", "trọ".
      - max: Convert "3 triệu" -> 3000000.
      Output Schema: { "keyword": string|null, "max": number|null, "min": number|null }
    `;
    let intent = (await callGeminiJSON(GEMINI_API_KEY, promptIntent)) || {};

    // Chuẩn hóa
    intent.keyword = normalizeKeyword(intent.keyword);
    console.log("Intent:", intent);

    // === BƯỚC 2: TÌM KIẾM (TRỰC TIẾP TRÊN CODE - KHÔNG DÙNG RPC) ===

    // Hàm tạo query cơ bản
    const baseQuery = () =>
      supabase
        .from("posts")
        .select("title, motelName, price, ward, address_detail")
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(6);

    let posts = [];
    let note = "";

    // Tầng 1: Tìm Chính Xác (Nếu có Keyword)
    if (intent.keyword) {
      let query = baseQuery();
      // Tìm keyword trong mọi cột
      const kw = intent.keyword;
      query = query.or(
        `title.ilike.%${kw}%,motelName.ilike.%${kw}%,ward.ilike.%${kw}%,address_detail.ilike.%${kw}%`
      );

      if (intent.max) query = query.lte("price", intent.max);
      if (intent.min) query = query.gte("price", intent.min);

      const { data } = await query;
      if (data && data.length > 0) {
        posts = data;
        note = `Tìm thấy phòng ở "${intent.keyword}" đúng ý bạn:`;
      }
    }

    // Tầng 2: Tìm Theo Giá (Nếu Tầng 1 rỗng, hoặc Keyword là null)
    // Đây là bước giúp xử lý câu "tìm trọ dưới 3 triệu giúp" (keyword bị null do là từ rác)
    if (posts.length === 0 && (intent.max || intent.min)) {
      console.log("Tìm theo giá (bỏ qua keyword)...");
      let query = baseQuery();
      if (intent.max) query = query.lte("price", intent.max);
      if (intent.min) query = query.gte("price", intent.min);

      const { data } = await query;
      if (data && data.length > 0) {
        posts = data;
        note = intent.keyword
          ? `Không thấy phòng ở "${intent.keyword}", nhưng có mấy phòng này giá hợp lý nè:`
          : `Tìm thấy phòng có giá phù hợp nè:`;
      }
    }

    // Tầng 3: Fallback (Mới nhất)
    if (posts.length === 0) {
      const { data } = await baseQuery().limit(3);
      posts = data || [];
      note =
        "Huhu chưa tìm thấy phòng nào khớp yêu cầu. Bạn xem tạm phòng mới nhất nha:";
    }

    // === BƯỚC 3: TRẢ LỜI ===
    const listInfo = posts
      .map(
        (p, i) =>
          `${i + 1}. ${
            p.motelName || p.title
          } - ${p.price?.toLocaleString()}đ - ${p.ward}`
      )
      .join("\n");

    const promptReply = `
      Bạn là Gà Bông 🐣.
      User: "${message}"
      Note: "${note}"
      List:
      ${listInfo}
      
      Yêu cầu: Trả lời ngắn gọn, vui vẻ. Dựa vào Note để phản hồi.
    `;

    const botReply =
      (await callGeminiText(GEMINI_API_KEY, promptReply)) ||
      "Gà Bông đang lag xíu 🐣";

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

// supabase/functions/chat-bot/index.ts
// VERSION V16 - PERFECT LOCALIZATION (KẾT HỢP V6 + V15)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 1. CÁC HÀM XỬ LÝ CHUỖI (CỰC KỲ QUAN TRỌNG)

function cleanJson(text: string): string {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

// Hàm này biến các từ viết tắt thành từ chuẩn trong Database của bạn
function normalizeKeyword(keyword: string | null) {
  if (!keyword) return null;
  let k = keyword
    .toLowerCase()
    .trim()
    .replace(/[.,;?!]/g, ""); // Xóa dấu câu

  // Danh sách từ cấm (Nếu AI lỡ trích xuất ra thì xóa luôn)
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
  ];
  if (blacklist.includes(k)) return null;

  // Bản đồ từ điển địa phương Cần Thơ
  const aliasMap: Record<string, string> = {
    dhct: "Đại học Cần Thơ",
    đhct: "Đại học Cần Thơ",
    ctu: "Đại học Cần Thơ",
    fpt: "FPT",
    "nam cần thơ": "Nam Cần Thơ",
    dhnct: "Nam Cần Thơ",
    "y dược": "Y Dược",
    "3/2": "3/2",
    "3-2": "3/2",
    "30/4": "30/4",
    "30-4": "30/4",
    "ninh kiều": "Ninh Kiều",
    "cái răng": "Cái Răng",
    "bình thủy": "Bình Thủy",
    "ô môn": "Ô Môn",
  };

  // Kiểm tra map chính xác
  if (aliasMap[k]) return aliasMap[k];

  // Kiểm tra map gần đúng (ví dụ: "quận ninh kiều" -> "Ninh Kiều")
  for (const key in aliasMap) {
    if (k.includes(key)) return aliasMap[key];
  }

  // Nếu không map được, trả về từ gốc (để tìm tên đường/hẻm)
  return keyword.replace(/[%_]/g, "").trim();
}

// 2. GỌI GEMINI (2 CHẾ ĐỘ)

async function callGeminiJSON(apiKey: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }, // Bắt buộc JSON
      }),
    });
    const json = await res.json();
    const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return rawText ? JSON.parse(cleanJson(rawText)) : null;
  } catch (e) {
    console.error("Gemini JSON Error:", e);
    return null;
  }
}

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

// 3. MAIN HANDLER

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth Check
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Auth failed");

    const { message } = await req.json();

    // === BƯỚC 1: HIỂU Ý ĐỊNH (AI) ===
    const promptIntent = `
      User: "${message}"
      Task: Extract search criteria into JSON.
      Rules:
      - keyword: Specific location name ONLY (District, Street, Uni). If generic words like "tìm trọ", "giúp", return NULL.
      - max: Convert "3 triệu", "3tr", "3000k" -> 3000000.
      
      Output Schema: { "keyword": string|null, "max": number|null, "min": number|null }
    `;

    let intent = (await callGeminiJSON(GEMINI_API_KEY, promptIntent)) || {};

    // === BƯỚC 2: CHUẨN HÓA TỪ KHÓA (CODE) ===
    const rawKw = intent.keyword;
    intent.keyword = normalizeKeyword(intent.keyword);
    console.log(
      `🔍 Intent: "${rawKw}" -> Normalized: "${intent.keyword}" | Max: ${intent.max}`
    );

    // === BƯỚC 3: TÌM KIẾM PHÂN TẦNG (DB RPC) ===
    let posts: any[] = [];
    let note = "";

    // Tầng 1: Tìm chính xác (Có từ khóa + Giá)
    const { data: exact } = await supabase.rpc("match_posts_smart", {
      p_keyword: intent.keyword,
      p_min_price: intent.min,
      p_max_price: intent.max,
      p_limit: 5,
    });

    if (exact && exact.length > 0) {
      posts = exact;
      note = `Tìm thấy ${posts.length} phòng đúng ý bạn:`;
    }
    // Tầng 2: Nếu Tầng 1 rỗng -> Thử bỏ từ khóa, chỉ tìm theo Giá (Tự sửa lỗi nếu AI nhận diện sai keyword)
    else if ((intent.max || intent.min) && !posts.length) {
      console.log("⚠️ Không thấy theo từ khóa. Tìm rộng theo giá...");
      const { data: priceOnly } = await supabase.rpc("match_posts_smart", {
        p_keyword: null, // Bỏ từ khóa
        p_min_price: intent.min,
        p_max_price: intent.max,
        p_limit: 5,
      });
      if (priceOnly && priceOnly.length > 0) {
        posts = priceOnly;
        note = `Không thấy phòng ở khu vực "${
          intent.keyword || "đó"
        }", nhưng có mấy phòng giá hợp lý nè:`;
      }
    }

    // Tầng 3: Fallback (Mới nhất)
    if (posts.length === 0) {
      const { data: newest } = await supabase
        .from("posts")
        .select("*")
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(3);
      posts = newest || [];
      note =
        "Huhu chưa tìm thấy phòng nào khớp yêu cầu. Bạn xem tạm phòng mới nhất nha:";
    }

    // === BƯỚC 4: TRẢ LỜI ===
    // Tạo text danh sách để AI đọc
    const listInfo = posts
      .map(
        (p, i) =>
          `${i + 1}. ${
            p.motelName || "Trọ"
          } - ${p.price?.toLocaleString()}đ - ${p.ward}`
      )
      .join("\n");

    const promptReply = `
      Bạn là Gà Bông 🐣.
      User: "${message}"
      Note hệ thống: "${note}"
      Danh sách phòng:
      ${listInfo}
      
      Yêu cầu:
      - Trả lời ngắn gọn, thân thiện.
      - Dựa vào "Note hệ thống" để trả lời.
      - KHÔNG bịa ra phòng không có trong danh sách.
    `;

    const botReply =
      (await callGeminiText(GEMINI_API_KEY, promptReply)) ||
      "Gà Bông đang lag xíu 🐣";

    // Lưu Log
    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, content: botReply, is_bot: true });

    return new Response(
      JSON.stringify({ success: true, reply: botReply, data: posts }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

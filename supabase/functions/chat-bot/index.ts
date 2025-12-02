// supabase/functions/chat-bot/index.ts
// VERSION V15 - ULTIMATE STRICT MODE (XỬ LÝ DẤU CÂU & TỪ RÁC TRIỆT ĐỂ)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MODEL_NAME = "gemini-1.5-flash";

// Danh sách từ khóa cấm tuyệt đối (AI hay nhầm lẫn)
const BLACKLIST_KEYWORDS = [
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
  "khoảng",
  "tầm",
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
  "cho",
  "em",
  "anh",
  "chị",
  "bạn",
  "sinh",
  "viên",
  "rẻ",
  "đẹp",
  "yên",
  "tĩnh",
];

// 1. HÀM GỌI GEMINI (CHẾ ĐỘ JSON THUẦN)
async function callGemini(
  apiKey: string,
  prompt: string,
  isJsonMode: boolean = false
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  const body: any = { contents: [{ role: "user", parts: [{ text: prompt }] }] };

  // BẮT BUỘC TRẢ VỀ JSON NẾU LÀ CHẾ ĐỘ PHÂN TÍCH
  if (isJsonMode) {
    body.generationConfig = { responseMimeType: "application/json" };
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Gemini API Error: ${res.statusText}`);

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.error("Gemini Error:", e);
    return null;
  }
}

// 2. VỆ SINH TỪ KHÓA (CHỐNG NGỐ & KÝ TỰ ĐẶC BIỆT)
function sanitizeKeyword(raw: string | null): string | null {
  if (!raw) return null;

  // Xóa dấu chấm, phẩy, chấm than, hỏi chấm...
  let clean = raw
    .toLowerCase()
    .replace(/[.,;!?'"()]/g, "")
    .trim();

  // Nếu sau khi xóa mà rỗng hoặc quá ngắn -> Bỏ
  if (clean.length < 2) return null;

  // Nếu nằm trong danh sách cấm -> Bỏ
  if (BLACKLIST_KEYWORDS.includes(clean)) return null;

  return clean;
}

// 3. PHÂN TÍCH Ý ĐỊNH (PROMPT KHẮC KHE)
async function parseIntent(apiKey: string, message: string) {
  // BƯỚC 1: Xóa ký tự đặc biệt khỏi message gốc trước khi đưa vào AI
  const cleanMessage = message.replace(/[.,;!?"()]/g, " ");

  const prompt = `
    Role: Real Estate Intent Parser.
    Input: "${cleanMessage}"
    
    Task: Extract ONLY specific location/amenity keywords and price.
    
    Rules for 'keyword':
    - MUST be a Proper Noun (e.g., "Ninh Kiều", "3/2", "Cái Răng", "FPT").
    - MUST NOT be generic words (e.g., "trọ", "phòng", "giúp", "với", "mình", "nha").
    - If no specific location is mentioned, return null.
    
    Rules for 'max_price':
    - Convert to VND integer. "3 triệu" -> 3000000.
    
    Output JSON format: {"max_price": number|null, "keyword": string|null}
  `;

  const raw = await callGemini(apiKey, prompt, true);
  if (!raw) return { max_price: null, keyword: null };

  try {
    const json = JSON.parse(raw);
    // CHỐT CHẶN CUỐI CÙNG: Sanitize lại kết quả của AI
    json.keyword = sanitizeKeyword(json.keyword);
    return json;
  } catch {
    return { max_price: null, keyword: null };
  }
}

// 4. MAIN HANDLER (CASCADE SEARCH)
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

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

    // === BƯỚC 1: PHÂN TÍCH ===
    const intent = await parseIntent(GEMINI_API_KEY, message);
    console.log("🎯 Intent Final:", intent);

    let posts: any[] = [];
    let searchType = "exact";

    // === BƯỚC 2: TÌM KIẾM PHÂN TẦNG (CASCADE) ===

    // Tầng 1: Tìm chính xác (Giá + Từ khóa)
    const { data: exactMatches } = await supabase.rpc("match_posts_advanced", {
      p_keyword: intent.keyword,
      p_max_price: intent.max_price,
      p_limit: 5,
    });

    if (exactMatches && exactMatches.length > 0) {
      posts = exactMatches;
      searchType = "exact";
    }
    // Tầng 2: Nếu Tầng 1 thất bại VÀ có từ khóa -> Bỏ từ khóa, chỉ tìm theo Giá (Fix lỗi AI nhận diện sai keyword)
    else if (intent.keyword && intent.max_price) {
      console.log("🔄 Tầng 1 rỗng. Thử tìm rộng theo giá...");
      const { data: broadMatches } = await supabase.rpc(
        "match_posts_advanced",
        {
          p_keyword: null,
          p_max_price: intent.max_price,
          p_limit: 5,
        }
      );

      if (broadMatches && broadMatches.length > 0) {
        posts = broadMatches;
        searchType = "broad";
      }
    }

    // Tầng 3: Nếu vẫn rỗng -> Lấy tin mới nhất
    if (posts.length === 0) {
      console.log("⚠️ Không tìm thấy gì. Fallback tin mới nhất.");
      const { data: newest } = await supabase
        .from("posts")
        .select("*")
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(3);
      posts = newest || [];
      searchType = "newest";
    }

    // === BƯỚC 3: PHẢN HỒI ===
    const listText = posts
      .map(
        (p, i) =>
          `${i + 1}. ${
            p.motelName || "Trọ"
          } - ${p.price?.toLocaleString()}đ - ${p.ward}`
      )
      .join("\n");

    let contextNote = "";
    if (searchType === "exact") {
      contextNote = `✅ Đã tìm thấy phòng đúng ý bạn.`;
    } else if (searchType === "broad") {
      contextNote = `⚠️ Không thấy phòng ở "${
        intent.keyword
      }" với giá này. Nhưng có mấy phòng khác giá tốt (dưới ${intent.max_price?.toLocaleString()}đ) nè:`;
    } else {
      contextNote = `❌ Chưa tìm thấy phòng khớp yêu cầu. Bạn tham khảo phòng mới nhất nha:`;
    }

    const replyPrompt = `
      Bạn là Gà Bông 🐣.
      Khách chat: "${message}"
      Kết quả hệ thống: ${contextNote}
      Danh sách:
      ${listText}
      
      Yêu cầu: Trả lời ngắn gọn, vui vẻ. Dựa vào "Kết quả hệ thống" để phản hồi đúng tình huống.
    `;

    const botReply =
      (await callGemini(GEMINI_API_KEY, replyPrompt)) ||
      "Gà Bông đang lag xíu, bạn thử lại nha 🐣";

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

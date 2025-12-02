// supabase/functions/chat-bot/index.ts
// (PHIÊN BẢN V10 - HYBRID: CẤU TRÚC V9 + PROMPT V8 + AN TOÀN TUYỆT ĐỐI)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Cấu hình cứng để tăng tốc độ (Bỏ qua bước fetch model)
const MODEL_NAME = "gemini-1.5-flash";

// 1. Hàm vệ sinh JSON (Chống lỗi Markdown từ AI)
function cleanJsonOutput(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return text;
}

// 2. Hàm gọi Gemini chung (Clean Code)
async function callGemini(
  apiKey: string,
  prompt: string,
  isJsonMode: boolean = false
) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  if (isJsonMode) {
    body.generationConfig = { responseMimeType: "application/json" };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    console.error(`Gemini API Error: ${response.statusText}`);
    return null;
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// 3. Phân tích ý định (Dùng Prompt Tiếng Việt của V8 để hiểu từ lóng tốt hơn)
async function parseQueryWithGemini(apiKey: string, userMessage: string) {
  const prompt = `
    Role: Chuyên gia phân tích dữ liệu bất động sản Việt Nam.
    Task: Trích xuất thông tin tìm kiếm từ câu nói: "${userMessage}"
    
    Yêu cầu xử lý:
    1. "price_max": Chuyển đổi tất cả về số nguyên VNĐ. 
       - "3 triệu", "3tr", "3 củ" -> 3000000
       - "300k", "300 nghìn" -> 300000
    2. "location": Trích xuất tên Phường, Quận, Đường. Bỏ qua các hư từ như "ở", "tại", "khu vực", "gần". Nếu không có -> null.
    
    Output Format (JSON):
    {"price_max": number|null, "location": string|null}
  `;

  try {
    const rawText = await callGemini(apiKey, prompt, true);
    if (!rawText) return null;

    // Vệ sinh JSON trước khi parse
    const cleanText = cleanJsonOutput(rawText);
    console.log("Parsed Intent:", cleanText); // Log để debug
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Parse Query Error:", e);
    return null;
  }
}

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Auth failed");

    const { message } = await req.json();

    // === BƯỚC 1: HIỂU Ý ĐỊNH ===
    const searchIntent = await parseQueryWithGemini(GEMINI_API_KEY, message);

    // === BƯỚC 2: BUILD QUERY (Kết hợp độ an toàn của V9 và độ phủ của V8) ===
    let query = supabase
      .from("posts")
      .select("title, motelName, price, ward, address_detail, description")
      .eq("status", "APPROVED");

    if (searchIntent) {
      // Lọc giá
      if (searchIntent.price_max && searchIntent.price_max > 0) {
        query = query.lte("price", searchIntent.price_max);
      }

      // Lọc địa điểm (Có xử lý an toàn safeLoc của V9)
      if (searchIntent.location) {
        // Loại bỏ ký tự đặc biệt nguy hiểm cho câu lệnh SQL
        const safeLoc = searchIntent.location.replace(/[,()]/g, " ").trim();

        if (safeLoc.length > 0) {
          // Tìm trong cả Ward, Address VÀ Description (để tìm tiện ích)
          query = query.or(
            `ward.ilike.%${safeLoc}%,address_detail.ilike.%${safeLoc}%,motelName.ilike.%${safeLoc}%,description.ilike.%${safeLoc}%`
          );
        }
      }
    }

    // Limit và Order
    query = query.limit(5).order("created_at", { ascending: false });

    const { data: searchResults, error: dbError } = await query;
    if (dbError) console.error("DB Error:", dbError);

    // === BƯỚC 3: PHẢN HỒI (Gà Bông) ===
    let contextData = "";
    let postsData = searchResults || [];

    // Nếu không tìm thấy, lấy 3 tin mới nhất làm gợi ý (Fallback)
    if (postsData.length === 0) {
      const { data: fallbackPosts } = await supabase
        .from("posts")
        .select("title, motelName, price, ward, address_detail")
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(3);

      postsData = fallbackPosts || [];
      contextData = `User tìm: "${message}". KẾT QUẢ: KHÔNG TÌM THẤY. (Intent: ${JSON.stringify(
        searchIntent
      )}). Gợi ý user xem các phòng mới nhất dưới đây. Hãy xin lỗi user thật khéo léo và dễ thương.`;
    } else {
      contextData = `User tìm: "${message}". KẾT QUẢ: Tìm thấy ${postsData.length} phòng phù hợp.`;
    }

    const listText = postsData
      .map(
        (p, index) =>
          `${index + 1}. ${p.motelName || p.title}: ${p.price?.toLocaleString(
            "vi-VN"
          )}đ - Đ/c: ${p.address_detail}, ${p.ward}`
      )
      .join("\n");

    const SYSTEM_PROMPT = `
      Bạn là "Gà Bông" 🐣, trợ lý tìm trọ của Chicky.stu.
      
      DỮ LIỆU TỪ HỆ THỐNG:
      ${contextData}
      
      DANH SÁCH PHÒNG:
      ${listText}

      YÊU CẦU TRẢ LỜI:
      - Ngắn gọn, thân thiện, dùng emoji (🐣, 🏡, ✨).
      - Nếu có kết quả đúng ý: Mời khách tham khảo danh sách.
      - Nếu là kết quả gợi ý (fallback): Phải nói rõ là "chưa tìm thấy đúng ý nhưng có mấy phòng mới này".
      - TUYỆT ĐỐI KHÔNG BỊA RA PHÒNG KHÔNG CÓ TRONG DANH SÁCH TRÊN.
    `;

    // Gọi AI trả lời (Không cần JSON mode ở đây, cần text tự nhiên)
    const botReply =
      (await callGemini(GEMINI_API_KEY, SYSTEM_PROMPT, false)) ||
      "Gà Bông đang bị nghẽn mạng xíu, bạn hỏi lại nha 🐣";

    // Lưu Log
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      content: botReply,
      is_bot: true,
    });

    return new Response(JSON.stringify({ success: true, reply: botReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("ChatBot Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

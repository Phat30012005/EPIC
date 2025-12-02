// supabase/functions/chat-bot/index.ts
// (PHIÊN BẢN V6 - FIX LOGIC TÌM KIẾM & TỐI ƯU STOPWORDS)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 1. Hàm dò tìm Model (Giữ nguyên)
async function getAvailableModel(apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`,
      { method: "GET" }
    );
    if (!response.ok) return "gemini-1.5-flash-latest";
    const data = await response.json();
    const models = data.models || [];

    const stableFlash = models.find(
      (m: any) => m.name === "models/gemini-1.5-flash"
    );
    if (stableFlash) return "gemini-1.5-flash";

    const anyFlash = models.find(
      (m: any) =>
        m.name.includes("flash") &&
        m.supportedGenerationMethods?.includes("generateContent")
    );
    if (anyFlash) return anyFlash.name.replace("models/", "");

    return "gemini-1.5-flash-latest";
  } catch (e) {
    return "gemini-1.5-flash-latest";
  }
}

// 2. Hàm trích xuất giá tiền (Giữ nguyên)
function extractPrice(text: string): number | null {
  const cleanText = text.toLowerCase().replace(/\./g, "").replace(/,/g, "");

  // Regex bắt số tiền (triệu/tr/m)
  const millionMatch = cleanText.match(/(\d+(?:[\.,]\d+)?)\s*(triệu|tr|m)/);
  if (millionMatch) {
    return parseFloat(millionMatch[1].replace(",", ".")) * 1000000;
  }

  // Regex bắt số trăm nghìn (k/nghìn)
  const thousandMatch = cleanText.match(/(\d+)\s*(k|nghìn|ngàn)/);
  if (thousandMatch) {
    return parseFloat(thousandMatch[1]) * 1000;
  }

  // Regex bắt số thuần túy lớn (nếu user nhập 2000000)
  const rawNumberMatch = cleanText.match(/\d{6,}/);
  if (rawNumberMatch) {
    return parseFloat(rawNumberMatch[0]);
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
    if (!GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth Check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user)
      return new Response(JSON.stringify({ error: "Auth failed" }), {
        status: 401,
        headers: corsHeaders,
      });

    const { message } = await req.json();
    const userMessage = message.toLowerCase();

    // === LOGIC TÌM KIẾM THÔNG MINH (V6 - UPDATED) ===

    // A. Xử lý giá tiền
    const detectedPrice = extractPrice(userMessage);

    // B. Xử lý từ khóa (QUAN TRỌNG: CẬP NHẬT DANH SÁCH TỪ RÁC)
    const removeWords = [
      "tìm",
      "kiếm",
      "phòng",
      "trọ",
      "ở",
      "tại",
      "khu",
      "vực",
      "thuê",
      "cần",
      "giá",
      "dưới",
      "khoảng",
      "triệu",
      "tr",
      "k",
      "vnđ",
      "đồng",
      "mức",
      // Thêm các từ giao tiếp xã giao để tránh nhận diện nhầm là địa điểm
      "giúp",
      "với",
      "mình",
      "em",
      "anh",
      "chị",
      "bạn",
      "ad",
      "admin",
      "ơi",
      "nhé",
      "nào",
      "đâu",
      "là",
      "có",
      "không",
      "gấp",
    ];

    let searchTerms = userMessage
      .split(" ")
      .filter((w) => !removeWords.includes(w) && isNaN(Number(w)));

    // Nếu từ khóa quá ngắn (dưới 2 ký tự) thì cũng bỏ qua luôn
    const queryText = searchTerms
      .filter((w) => w.length > 1)
      .join(" ")
      .trim();

    console.log(
      `[ChatBot Log] Search: "${queryText}", MaxPrice: ${detectedPrice}`
    );

    // C. Xây dựng Query Supabase
    let query = supabase
      .from("posts")
      .select("title, motelName, price, ward, address_detail, description")
      .eq("status", "APPROVED");

    // Filter Giá
    if (detectedPrice) {
      query = query.lte("price", detectedPrice);
    }

    // Filter Text (CHỈ ÁP DỤNG NẾU CÒN TỪ KHÓA SAU KHI LỌC)
    // Nếu queryText rỗng (ví dụ: chỉ hỏi "tìm phòng 3 triệu"), ta chỉ lọc theo giá
    // Điều này giúp tìm ra kết quả chính xác hơn và nhanh hơn (bỏ qua ILIKE chậm chạp)
    if (queryText.length > 0) {
      query = query.or(
        `title.ilike.%${queryText}%,motelName.ilike.%${queryText}%,ward.ilike.%${queryText}%,address_detail.ilike.%${queryText}%,description.ilike.%${queryText}%`
      );
    }

    // Giới hạn kết quả
    query = query.limit(5);

    const { data: searchResults, error: dbError } = await query;

    // D. Xử lý kết quả & Fallback
    let postsData = searchResults || [];
    let noteToAI = "";

    if (dbError) {
      console.error("DB Search Error:", dbError);
    }

    // Fallback: Nếu không tìm thấy, lấy top 5 phòng mới nhất
    if (postsData.length === 0) {
      console.log("[ChatBot Log] No results found. Fetching fallback.");
      const { data: fallbackPosts } = await supabase
        .from("posts")
        .select("title, motelName, price, ward, address_detail")
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(5);

      if (fallbackPosts) {
        postsData = fallbackPosts;
        noteToAI = `(Hệ thống không tìm thấy phòng khớp chính xác với yêu cầu "${message}". Dưới đây là danh sách phòng MỚI NHẤT để gợi ý thay thế)`;
      }
    } else {
      noteToAI = `(Hệ thống tìm thấy ${postsData.length} phòng khớp với yêu cầu)`;
    }

    // E. Chuẩn bị Prompt
    const listText = postsData
      .map(
        (p) =>
          `- ${p.motelName || p.title}: Giá ${p.price.toLocaleString(
            "vi-VN"
          )}đ. Địa chỉ: ${p.address_detail}, ${p.ward}.`
      )
      .join("\n");

    const SYSTEM_PROMPT = `
    Bạn là "Gà Bông" 🐣 - Trợ lý của Chicky.stu.
    
    YÊU CẦU CỦA KHÁCH: "${message}"
    
    DỮ LIỆU TỪ DATABASE:
    ${noteToAI}
    ${listText}

    NHIỆM VỤ:
    1. Trả lời thân thiện, ngắn gọn, dùng emoji.
    2. Nếu dữ liệu khớp: Mời khách xem các phòng bên trên.
    3. Nếu dữ liệu là gợi ý (không khớp): Xin lỗi khéo và mời xem phòng mới nhất.
    4. TUYỆT ĐỐI KHÔNG BỊA RA PHÒNG KHÔNG CÓ TRONG DANH SÁCH.
    `;

    // F. Gọi AI
    let modelName = await getAvailableModel(GEMINI_API_KEY);
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }],
      }),
    });

    const aiData = await aiResponse.json();
    let botReply = "";

    if (!aiResponse.ok || aiData.error) {
      console.error("AI Error:", JSON.stringify(aiData.error));
      botReply = `Gà Bông đang bị lỗi kết nối AI 🤧.\n\nNhưng mình tìm được thông tin này trong hệ thống:\n${listText}`;
    } else {
      botReply =
        aiData.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Gà Bông chưa hiểu ý bạn 🐣";
    }

    // G. Lưu & Trả về
    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, content: botReply, is_bot: true });

    return new Response(JSON.stringify({ success: true, reply: botReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

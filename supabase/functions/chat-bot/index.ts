// supabase/functions/chat-bot/index.ts
// (PHIÊN BẢN V7 - AI PARSER - THÔNG MINH HƠN, KHÔNG CẦN TỪ KHÓA RÁC)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 1. Hàm tìm Model (Giữ nguyên)
async function getAvailableModel(apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`,
      { method: "GET" }
    );
    if (!response.ok) return "gemini-1.5-flash";
    const data = await response.json();
    const models = data.models || [];
    const flashModel = models.find((m: any) => m.name.includes("flash"));
    return flashModel
      ? flashModel.name.replace("models/", "")
      : "gemini-1.5-flash";
  } catch {
    return "gemini-1.5-flash";
  }
}

// 2. [QUAN TRỌNG] Hàm nhờ AI phân tích ý định tìm kiếm
async function parseQueryWithGemini(apiKey: string, userMessage: string) {
  const prompt = `
    Bạn là một trình phân tích tìm kiếm phòng trọ. 
    Nhiệm vụ: Trích xuất thông tin từ câu nói tự nhiên của người dùng tiếng Việt thành JSON.
    
    Câu người dùng: "${userMessage}"
    
    Yêu cầu Output (CHỈ TRẢ VỀ JSON THUẦN, KHÔNG MARKDOWN):
    {
      "price_max": number | null, (Nếu tìm dưới X tiền, hoặc khoảng X tiền. Đổi về đơn vị VNĐ. Ví dụ 3 triệu -> 3000000)
      "location": string | null, (Tên Quận/Huyện hoặc Phường hoặc Đường. Bỏ qua các từ như "ở", "tại", "khu vực")
      "is_seeking_roommate": boolean (True nếu tìm người ở ghép, False nếu tìm thuê phòng)
    }
    
    Ví dụ: 
    - "tìm phòng dưới 3 triệu giúp mình" -> {"price_max": 3000000, "location": null, "is_seeking_roommate": false}
    - "tìm trọ ở Ninh Kiều giá rẻ" -> {"price_max": null, "location": "Ninh Kiều", "is_seeking_roommate": false}
  `;

  try {
    const model = await getAvailableModel(apiKey);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }, // Ép kiểu JSON
      }),
    });

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) return null;
    return JSON.parse(rawText);
  } catch (e) {
    console.error("Lỗi Parse Query:", e);
    return null; // Fallback nếu AI lỗi
  }
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

    // === BƯỚC 1: DÙNG AI ĐỂ HIỂU Ý ĐỊNH (THAY VÌ DÙNG REGEX THỦ CÔNG) ===
    console.log("Đang phân tích ý định:", message);
    const searchIntent = await parseQueryWithGemini(GEMINI_API_KEY, message);
    console.log("Kết quả phân tích JSON:", searchIntent);

    // === BƯỚC 2: BUILD QUERY SUPABASE DỰA TRÊN JSON ===
    let query = supabase
      .from("posts")
      .select("title, motelName, price, ward, address_detail, description")
      .eq("status", "APPROVED");

    // Áp dụng bộ lọc từ AI (Chính xác hơn nhiều)
    if (searchIntent) {
      if (searchIntent.price_max) {
        query = query.lte("price", searchIntent.price_max);
      }

      if (searchIntent.location) {
        // Tìm địa điểm trong cả 3 trường quan trọng
        const loc = searchIntent.location;
        query = query.or(
          `ward.ilike.%${loc}%,address_detail.ilike.%${loc}%,motelName.ilike.%${loc}%`
        );
      }
    }

    // Giới hạn kết quả
    query = query.limit(5).order("created_at", { ascending: false });

    const { data: searchResults, error: dbError } = await query;

    // === BƯỚC 3: XỬ LÝ KẾT QUẢ & PHẢN HỒI ===
    let postsData = searchResults || [];
    let noteToAI = "";

    if (dbError) console.error("DB Error:", dbError);

    // Nếu không tìm thấy, lấy top 5 phòng mới nhất (Fallback)
    if (postsData.length === 0) {
      const { data: fallbackPosts } = await supabase
        .from("posts")
        .select("title, motelName, price, ward, address_detail")
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(5);

      if (fallbackPosts) {
        postsData = fallbackPosts;
        noteToAI = `(Không tìm thấy phòng khớp chính xác tiêu chí: ${JSON.stringify(
          searchIntent
        )}. Dưới đây là danh sách phòng MỚI NHẤT)`;
      }
    } else {
      noteToAI = `(Đã tìm thấy ${postsData.length} phòng khớp tiêu chí)`;
    }

    const listText = postsData
      .map(
        (p) =>
          `- ${p.motelName || p.title}: Giá ${p.price.toLocaleString(
            "vi-VN"
          )}đ. Đ/c: ${p.address_detail}, ${p.ward}.`
      )
      .join("\n");

    // === BƯỚC 4: SINH CÂU TRẢ LỜI ===
    const SYSTEM_PROMPT = `
    Bạn là "Gà Bông" 🐣 - Trợ lý tìm trọ.
    Khách hỏi: "${message}"
    
    Dữ liệu hệ thống tìm được:
    ${noteToAI}
    ${listText}

    Nhiệm vụ:
    1. Trả lời ngắn gọn, thân thiện, dùng emoji.
    2. Nếu có phòng khớp, hãy liệt kê ra.
    3. Nếu không khớp (đang hiển thị phòng mới nhất), hãy nói khéo là chưa tìm thấy đúng yêu cầu nhưng mời xem tham khảo mấy phòng này.
    `;

    const modelName = await getAvailableModel(GEMINI_API_KEY);
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }],
      }),
    });

    const aiData = await aiResponse.json();
    const botReply =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Gà Bông đang bị nghẽn mạng xíu 🐣";

    // Lưu log chat
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

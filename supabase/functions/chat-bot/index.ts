// supabase/functions/chat-bot/index.ts
// (PHIÊN BẢN V8 - JSON SANITIZER - CHỐNG LỖI PARSE TỪ AI)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "[https://esm.sh/@supabase/supabase-js@2](https://esm.sh/@supabase/supabase-js@2)";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 1. Hàm vệ sinh JSON (FIX LỖI QUAN TRỌNG NHẤT)
function cleanJsonOutput(text: string): string {
  // Tìm vị trí bắt đầu của dấu { và vị trí kết thúc của dấu }
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1) {
    // Chỉ lấy phần nội dung nằm trong {}
    return text.substring(firstBrace, lastBrace + 1);
  }
  return text; // Trả về nguyên gốc nếu không tìm thấy (để try/catch xử lý)
}

// 2. Hàm tìm Model
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

// 3. Phân tích ý định bằng AI
async function parseQueryWithGemini(apiKey: string, userMessage: string) {
  const prompt = `
    Role: Chuyên gia phân tích dữ liệu bất động sản Việt Nam.
    Task: Trích xuất thông tin tìm kiếm từ câu nói của user thành JSON.
    
    Input: "${userMessage}"
    
    Rules:
    1. "price_max": Chuyển đổi tất cả về số nguyên VNĐ. 
       - "3 triệu" -> 3000000
       - "3tr" -> 3000000
       - "300k" -> 300000
    2. "location": Trích xuất tên Phường, Quận, Đường. Bỏ qua các từ "ở", "tại", "khu vực". Nếu không có -> null.
    3. "is_roommate": true nếu tìm người ở ghép, false nếu tìm thuê phòng.

    Output Format (JSON Only):
    {"price_max": number|null, "location": string|null, "is_roommate": boolean}
  `;

  try {
    const model = await getAvailableModel(apiKey);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    });

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) return null;

    // === BƯỚC QUAN TRỌNG: VỆ SINH DỮ LIỆU ===
    // Loại bỏ Markdown (```json ... ```) mà AI thường thêm vào
    const cleanText = cleanJsonOutput(rawText);

    console.log("AI Parsed Raw:", rawText); // Log để debug
    console.log("AI Parsed Clean:", cleanText); // Log để debug

    return JSON.parse(cleanText);
  } catch (e) {
    console.error("Lỗi Parse Query:", e);
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
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) throw new Error("Auth failed");

    const { message } = await req.json();

    // === BƯỚC 1: HIỂU Ý ĐỊNH ===
    const searchIntent = await parseQueryWithGemini(GEMINI_API_KEY, message);

    // === BƯỚC 2: BUILD QUERY ===
    let query = supabase
      .from("posts")
      .select("title, motelName, price, ward, address_detail, description")
      .eq("status", "APPROVED");

    let isFilterApplied = false;

    if (searchIntent) {
      // Lọc giá
      if (searchIntent.price_max && searchIntent.price_max > 0) {
        query = query.lte("price", searchIntent.price_max);
        isFilterApplied = true;
      }
      // Lọc địa điểm
      if (searchIntent.location) {
        const loc = searchIntent.location;
        query = query.or(
          `ward.ilike.%${loc}%,address_detail.ilike.%${loc}%,motelName.ilike.%${loc}%,description.ilike.%${loc}%`
        );
        isFilterApplied = true;
      }
    }

    // Nếu AI không lọc được gì (searchIntent null hoặc rỗng), thử tìm text search cơ bản
    if (!isFilterApplied) {
      // Fallback nhẹ: tìm xem trong message có từ khóa nào khớp description không
      // (Tránh trường hợp trả về toàn bộ database)
      // query = query.textSearch(...) -> Tạm thời bỏ qua để đơn giản hóa
    }

    query = query.limit(5).order("created_at", { ascending: false });

    const { data: searchResults, error: dbError } = await query;

    // === BƯỚC 3: PHẢN HỒI ===
    let postsData = searchResults || [];
    let systemPromptData = "";

    if (postsData.length === 0) {
      // Fallback: Lấy tin mới nhất nếu không tìm thấy
      const { data: fallbackPosts } = await supabase
        .from("posts")
        .select("title, motelName, price, ward, address_detail")
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(3);

      postsData = fallbackPosts || [];
      systemPromptData = `KHÔNG tìm thấy phòng nào khớp với: ${JSON.stringify(
        searchIntent
      )}. Dưới đây là danh sách phòng MỚI NHẤT để gợi ý. Hãy xin lỗi khách.`;
    } else {
      systemPromptData = `Tìm thấy ${
        postsData.length
      } phòng khớp yêu cầu: ${JSON.stringify(searchIntent)}.`;
    }

    const listText = postsData
      .map(
        (p) =>
          `- ${p.motelName || p.title}: ${p.price.toLocaleString(
            "vi-VN"
          )}đ. Đ/c: ${p.ward}.`
      )
      .join("\n");

    const SYSTEM_PROMPT = `
    Bạn là "Gà Bông" 🐣.
    Input User: "${message}"
    
    Context từ Database:
    ${systemPromptData}
    ${listText}

    Nhiệm vụ:
    Trả lời ngắn gọn (dưới 3 câu), thân thiện.
    Nếu có phòng khớp: "Gà Bông tìm được mấy phòng nè: ..."
    Nếu không khớp: "Huhu không thấy phòng nào [tiêu chí] rồi, xem tạm mấy phòng mới này nha..."
    `;

    // Gọi AI trả lời
    const modelName = await getAvailableModel(GEMINI_API_KEY);
    const replyRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: SYSTEM_PROMPT }] }],
        }),
      }
    );

    const replyData = await replyRes.json();
    const botReply =
      replyData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Gà Bông đang lúng túng, bạn hỏi lại nha 🐣";

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

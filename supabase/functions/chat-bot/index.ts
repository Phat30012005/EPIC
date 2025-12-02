// supabase/functions/chat-bot/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Hàm dò tìm model (Giữ nguyên từ bản trước vì đã hoạt động tốt)
async function getAvailableModel(apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`,
      { method: "GET" }
    );
    if (!response.ok) return null;
    const data = await response.json();
    const models = data.models || [];

    // Ưu tiên Flash 1.5
    const stableFlash = models.find(
      (m: any) => m.name === "models/gemini-1.5-flash"
    );
    if (stableFlash) return "gemini-1.5-flash";

    // Tìm bất kỳ bản Flash nào
    const anyFlash = models.find(
      (m: any) =>
        m.name.includes("flash") &&
        m.supportedGenerationMethods?.includes("generateContent")
    );
    if (anyFlash) return anyFlash.name.replace("models/", "");

    return "gemini-1.5-flash-latest"; // Fallback an toàn
  } catch (e) {
    return null;
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

    // 1. Auth Check
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

    // 2. [LOGIC MỚI] XỬ LÝ TỪ KHÓA TÌM KIẾM THÔNG MINH
    // Loại bỏ các từ nối vô nghĩa để tìm kiếm chính xác hơn
    const stopWords = [
      "tìm",
      "kiếm",
      "phòng",
      "trọ",
      "ở",
      "tại",
      "khu",
      "vực",
      "giá",
      "khoảng",
      "dưới",
      "trên",
      "cho",
      "thuê",
      "cần",
    ];
    const keywords = message
      .split(" ")
      .filter(
        (w: string) => !stopWords.includes(w.toLowerCase()) && w.length > 1
      )
      .join(" "); // Ví dụ: "Tìm trọ ở Bình Thủy" -> "Bình Thủy"

    // 3. [LOGIC MỚI] TÌM KIẾM LINH HOẠT (Flexible Search)
    // Thay vì dùng RPC cứng nhắc, ta dùng ILIKE để tìm gần đúng trên nhiều cột
    let postsData: any[] = [];
    let searchNote = "";

    // A. Thử tìm theo từ khóa (Nếu có từ khóa)
    if (keywords.length > 0) {
      const { data } = await supabase
        .from("posts")
        .select("title, motelName, price, ward, address_detail, description")
        .eq("status", "APPROVED") // Chỉ lấy tin đã duyệt
        .or(
          `title.ilike.%${keywords}%,motelName.ilike.%${keywords}%,ward.ilike.%${keywords}%,address_detail.ilike.%${keywords}%`
        )
        .limit(5); // Lấy 5 kết quả khớp nhất

      if (data && data.length > 0) {
        postsData = data;
        searchNote = "Tìm thấy phòng khớp với từ khóa:";
      }
    }

    // B. [QUAN TRỌNG] Fallback: Nếu không tìm thấy gì, lấy 5 phòng MỚI NHẤT
    // Giúp Bot không bao giờ bị "bí", luôn có gì đó để giới thiệu
    if (postsData.length === 0) {
      const { data: latestPosts } = await supabase
        .from("posts")
        .select("title, motelName, price, ward, address_detail")
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(5);

      if (latestPosts) {
        postsData = latestPosts;
        searchNote =
          "Hệ thống không tìm thấy phòng khớp chính xác yêu cầu, nhưng đây là các phòng MỚI NHẤT vừa đăng:";
      }
    }

    // 4. Chuẩn bị dữ liệu cho AI
    const listText = postsData
      .map(
        (p) =>
          `- ${p.motelName || p.title}: Giá ${p.price} VNĐ. Địa chỉ: ${
            p.address_detail
          }, ${p.ward}.`
      )
      .join("\n");

    const contextInfo = `${searchNote}\n${listText}`;

    // 5. Prompt cho AI (Đã tối ưu để Bot tự nhiên hơn)
    const SYSTEM_PROMPT = `
    Bạn là "Gà Bông" 🐣 - Trợ lý tìm trọ của Chicky.stu.
    
    DỮ LIỆU TỪ HỆ THỐNG:
    ${contextInfo}

    NHIỆM VỤ:
    1. Nếu khách chào hỏi xã giao (hi, hello, chào...), hãy chào lại thân thiện và hỏi khách muốn tìm phòng khu vực nào.
    2. Nếu Dữ liệu có phòng phù hợp, hãy giới thiệu ngắn gọn (Tên, Giá, Khu vực).
    3. Nếu Dữ liệu là "phòng mới nhất" (không khớp yêu cầu), hãy khéo léo bảo khách là chưa tìm thấy đúng ý, nhưng có thể tham khảo mấy phòng mới này.
    4. Luôn dùng emoji 🐣, giọng văn vui vẻ.
    `;

    // 6. Gọi Gemini (Logic V4 ổn định)
    let modelName = await getAvailableModel(GEMINI_API_KEY);
    if (!modelName) modelName = "gemini-1.5-flash";

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: SYSTEM_PROMPT + "\n\nKhách: " + message }],
          },
        ],
      }),
    });

    const aiData = await aiResponse.json();
    let botReply = "";

    if (!aiResponse.ok || aiData.error) {
      // Nếu AI lỗi, Bot vẫn trả về danh sách phòng (Fallback thủ công)
      console.error("AI Error:", JSON.stringify(aiData.error));
      botReply = `Gà Bông đang bị nghẹt mũi (Lỗi kết nối AI) 🤧.\n\nNhưng mình tìm thấy mấy phòng này nè:\n${listText}`;
    } else {
      botReply =
        aiData.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Gà Bông chưa hiểu ý bạn 🐣";
    }

    // 7. Lưu & Trả về
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

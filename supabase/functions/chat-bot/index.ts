// supabase/functions/chat-bot/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Hàm dò tìm thông minh (Đã tinh chỉnh để Ưu tiên Flash)
async function getAvailableModel(apiKey: string) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`,
      { method: "GET" }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const models = data.models || [];

    // === CHIẾN THUẬT CHỌN MODEL MỚI ===

    // 1. Ưu tiên tuyệt đối: Flash 1.5 (Bản ổn định nhất)
    // Tìm chính xác tên chuẩn trước
    const stableFlash = models.find(
      (m: any) => m.name === "models/gemini-1.5-flash"
    );
    if (stableFlash) return "gemini-1.5-flash";

    // 2. Nếu không có, tìm bất kỳ bản Flash nào (Flash-001, Flash-002...)
    const anyFlash = models.find(
      (m: any) =>
        m.name.includes("flash") &&
        !m.name.includes("8b") && // Tránh bản 8b nếu chưa ổn định
        m.supportedGenerationMethods?.includes("generateContent")
    );
    if (anyFlash) return anyFlash.name.replace("models/", "");

    // 3. Nếu vẫn không có Flash, mới đành dùng Pro (Dễ dính lỗi Quota)
    const anyPro = models.find(
      (m: any) =>
        m.name.includes("gemini-1.5-pro") &&
        m.supportedGenerationMethods?.includes("generateContent")
    );
    if (anyPro) return anyPro.name.replace("models/", "");

    // 4. Đường cùng: Gemin-Pro cũ
    return "gemini-pro";
  } catch (e) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // 1. SETUP & AUTH
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
    if (!GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // 2. CHỌN MODEL (QUAN TRỌNG)
    let modelName = await getAvailableModel(GEMINI_API_KEY);

    // Fallback cứng nếu hàm dò tìm thất bại hoàn toàn
    if (!modelName) modelName = "gemini-1.5-flash";

    // 3. RAG LOGIC
    let contextInfo = "Không tìm thấy phòng phù hợp.";
    try {
      const { data: searchResults } = await supabase.rpc("search_posts_v2", {
        search_term: message,
      });
      if (searchResults && searchResults.length > 0) {
        contextInfo = searchResults
          .slice(0, 3)
          .map(
            (p: any) =>
              `- ${p.motelName || p.title}: ${p.price}đ, tại ${p.ward}.`
          )
          .join("\n");
      }
    } catch {}

    const SYSTEM_PROMPT = `Bạn là Gà Bông (Chicky.stu). Dữ liệu: ${contextInfo}. Trả lời ngắn gọn.`;

    // 4. GỌI API GOOGLE
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: SYSTEM_PROMPT + "\nUser: " + message }],
          },
        ],
      }),
    });

    const aiData = await aiResponse.json();

    // 5. XỬ LÝ LỖI CHI TIẾT (Để bạn biết đường sửa Key)
    if (!aiResponse.ok || aiData.error) {
      const errMessage = aiData.error?.message || "Lỗi không xác định";
      console.error(`Gemini Error (${modelName}):`, errMessage);

      // Nếu lỗi là Quota (429), báo rõ cho user
      let userMsg = `Gà Bông đang bị ốm (${modelName}).`;
      if (errMessage.includes("quota") || aiResponse.status === 429) {
        userMsg =
          "Hệ thống đang quá tải (Hết quota miễn phí). Vui lòng thử lại vào ngày mai!";
      }

      // Vẫn lưu tin nhắn lỗi vào DB để Chatbox không bị treo
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        content: `⚠️ ${userMsg}`,
        is_bot: true,
      });

      return new Response(JSON.stringify({ success: true, reply: userMsg }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const botReply =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Gà Bông không hiểu ý bạn.";

    await supabase.from("chat_messages").insert({
      user_id: user.id,
      content: botReply,
      is_bot: true,
    });

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

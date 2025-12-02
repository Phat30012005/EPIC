// supabase/functions/chat-bot/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Hàm phụ trợ: Lấy danh sách model mà Key này ĐƯỢC PHÉP dùng
async function getAvailableModel(apiKey: string) {
  try {
    // Gọi API list_models để xem tài khoản này có gì
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=50`,
      { method: "GET" }
    );

    if (!response.ok) return null; // Nếu lỗi key hoặc quyền, trả về null

    const data = await response.json();
    const models = data.models || [];

    // Ưu tiên 1: Tìm bản Flash 1.5 (Nhanh, rẻ)
    const flash15 = models.find(
      (m: any) =>
        m.name.includes("gemini-1.5-flash") &&
        m.supportedGenerationMethods?.includes("generateContent")
    );
    if (flash15) return flash15.name.replace("models/", "");

    // Ưu tiên 2: Tìm bản Pro 1.5
    const pro15 = models.find(
      (m: any) =>
        m.name.includes("gemini-1.5-pro") &&
        m.supportedGenerationMethods?.includes("generateContent")
    );
    if (pro15) return pro15.name.replace("models/", "");

    // Ưu tiên 3: Tìm bản Pro 1.0 (Cũ nhưng ổn định)
    const pro10 = models.find(
      (m: any) =>
        m.name.includes("gemini-1.0-pro") &&
        m.supportedGenerationMethods?.includes("generateContent")
    );
    if (pro10) return pro10.name.replace("models/", "");

    // Ưu tiên 4: Lấy bất kỳ cái nào có thể tạo nội dung
    const anyGen = models.find((m: any) =>
      m.supportedGenerationMethods?.includes("generateContent")
    );
    if (anyGen) return anyGen.name.replace("models/", "");

    return null;
  } catch (e) {
    console.error("Error finding models:", e);
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

    // 1. Auth Check (Giữ nguyên)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Auth failed" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { message } = await req.json();

    // 2. [DEEP FIX] TỰ ĐỘNG CHỌN MODEL THAY VÌ HARDCODE
    // Code sẽ tự tìm xem Key của bạn chạy được model nào
    let modelName = await getAvailableModel(GEMINI_API_KEY);

    // Nếu không tìm thấy model nào -> Key này bị lỗi permission ở phía Google Project
    if (!modelName) {
      console.error(
        "CRITICAL: API Key valid but NO generateContent models found via API list."
      );
      // Fallback cuối cùng: thử model cũ nhất
      modelName = "gemini-pro";
    }

    console.log(`[ChatBot] Selected Model: ${modelName}`); // Log để bạn kiểm tra

    // 3. RAG Logic (Giữ nguyên)
    let contextInfo = "Chưa tìm thấy phòng phù hợp.";
    try {
      const { data: searchResults } = await supabase.rpc("search_posts_v2", {
        search_term: message,
      });
      if (searchResults?.length > 0) {
        contextInfo = searchResults
          .slice(0, 3)
          .map(
            (p: any) => `- ${p.motelName || p.title}: ${p.price}đ, ${p.ward}.`
          )
          .join("\n");
      }
    } catch {}

    const SYSTEM_PROMPT = `Bạn là Gà Bông (Chicky.stu). Dữ liệu: ${contextInfo}. Trả lời ngắn gọn, thân thiện.`;

    // 4. Gọi API với model đã được dò tìm (Dùng v1beta)
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

    if (!aiResponse.ok || aiData.error) {
      const err = aiData.error;
      console.error("Gemini API Error:", JSON.stringify(err));

      // Phản hồi chi tiết để bạn biết lỗi gì trên giao diện
      const debugMsg = err?.message || "Unknown error";
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        content: `⚠️ Lỗi AI (${modelName}): ${debugMsg}. Hãy kiểm tra API Key Settings.`,
        is_bot: true,
      });

      return new Response(
        JSON.stringify({ success: false, reply: "Lỗi kết nối AI." }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200, // Trả về 200 để frontend không crash, nhưng hiển thị lỗi
        }
      );
    }

    const botReply =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Gà Bông đang bối rối 🐣";

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

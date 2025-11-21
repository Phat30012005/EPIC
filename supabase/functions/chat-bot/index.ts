// supabase/functions/chat-bot/index.ts
// (PHIÊN BẢN AI - KẾT NỐI GOOGLE GEMINI)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --- CẤU HÌNH BOT (SYSTEM PROMPT) ---
// Đây là nơi bạn "dạy" Bot biết nó là ai và nhiệm vụ là gì.
const SYSTEM_PROMPT = `
Bạn là trợ lý ảo thông minh của hệ thống Chicky.stu - Website tìm kiếm phòng trọ và tìm người ở ghép tại Cần Thơ.
Nhiệm vụ của bạn:
1. Hỗ trợ người dùng tìm phòng trọ (khu vực Ninh Kiều, Cái Răng, Bình Thủy...).
2. Hướng dẫn đăng tin (Chỉ người cho thuê mới đăng tin phòng, chỉ người thuê mới đăng tin tìm ở ghép).
3. Giải đáp thắc mắc về chính sách và cách sử dụng web.
4. Trả lời ngắn gọn, thân thiện, dùng emoji phù hợp.
5. Nếu không biết câu trả lời, hãy khuyên người dùng liên hệ hotline 0355746973.

Tuyệt đối không trả lời các vấn đề không liên quan đến thuê trọ, bất động sản hoặc đời sống sinh viên Cần Thơ.
`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("Chưa cấu hình GEMINI_API_KEY");

    // 1. Setup Supabase Client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Check Auth
    const authHeader = req.headers.get("Authorization")!;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    // 3. Lấy tin nhắn user
    const { message } = await req.json();
    if (!message)
      return new Response(JSON.stringify({ error: "Empty message" }), {
        status: 400,
        headers: corsHeaders,
      });

    // 4. Lưu tin nhắn User vào DB
    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, content: message, is_bot: false });

    // 5. GỌI GEMINI API (REST API)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const aiPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT + "\n\nUser question: " + message }],
        },
      ],
    };

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiPayload),
    });

    const aiData = await aiResponse.json();

    // Lấy text trả lời từ cấu trúc JSON của Gemini
    let botReply = "Xin lỗi, hiện tại tôi đang bận. Vui lòng thử lại sau.";
    if (aiData.candidates && aiData.candidates[0]?.content?.parts[0]?.text) {
      botReply = aiData.candidates[0].content.parts[0].text;
    }

    // 6. Lưu tin nhắn Bot vào DB
    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, content: botReply, is_bot: true });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Bot Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// supabase/functions/chat-bot/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    // 1. Kiểm tra API Key có tồn tại không
    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({
          success: true,
          reply: "LỖI: Chưa tìm thấy GEMINI_API_KEY trong Secrets!",
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No Auth Header" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { message } = await req.json();

    // 2. Tìm kiếm dữ liệu (Giữ nguyên)
    let contextInfo = "Không có dữ liệu phòng.";
    try {
      const { data: searchResults } = await supabase.rpc("search_posts_v2", {
        search_term: message,
      });
      if (searchResults && searchResults.length > 0) {
        const listText = searchResults
          .slice(0, 3)
          .map(
            (p: any) => `- ${p.motelName || p.title}: ${p.price} VNĐ, ${p.ward}`
          )
          .join("\n");
        contextInfo = listText;
      }
    } catch (err) {
      console.error("Search Error:", err);
    }

    const SYSTEM_PROMPT = `
    Bạn là trợ lý ảo Chicky.stu.
    Dữ liệu phòng: ${contextInfo}
    `;

    // 3. Gửi sang Google (CÓ LOG ERROR)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
    let botReply = "";

    // --- PHẦN QUAN TRỌNG: BẮT LỖI CỦA GOOGLE ---
    if (aiData.error) {
      // Nếu Google báo lỗi (ví dụ: Key sai, Hết hạn mức...)
      botReply = `🚨 LỖI TỪ GOOGLE:\nCode: ${aiData.error.code}\nMessage: ${aiData.error.message}`;
    } else if (
      aiData.candidates &&
      aiData.candidates[0]?.content?.parts[0]?.text
    ) {
      // Nếu thành công
      botReply = aiData.candidates[0].content.parts[0].text;
    } else {
      // Nếu cấu trúc lạ (bị chặn nội dung, safety settings...)
      botReply = `⚠️ LỖI LẠ (JSON):\n${JSON.stringify(aiData)}`;
    }

    // Lưu và trả về
    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, content: botReply, is_bot: true });

    return new Response(JSON.stringify({ success: true, reply: botReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    // Bắt lỗi sập code (Crash)
    return new Response(
      JSON.stringify({
        success: true,
        reply: `💥 LỖI SYSTEM: ${error.message}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});

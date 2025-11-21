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
    // 1. Tạo client Supabase (Dùng Service Role để Bot có quyền ghi DB)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Lấy thông tin User từ Token (đảm bảo bảo mật)
    const authHeader = req.headers.get("Authorization")!;
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

    // 3. Lấy tin nhắn từ Client
    const { message } = await req.json();
    if (!message || !message.trim()) {
      return new Response(JSON.stringify({ error: "Message empty" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 4. Lưu tin nhắn CỦA USER vào DB
    const { error: insertError } = await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, content: message, is_bot: false });

    if (insertError) throw insertError;

    // 5. LOGIC BOT TRẢ LỜI (MÔ PHỎNG AI)
    // Sau này chỗ này sẽ gọi Gemini/OpenAI
    let botReply = "Cảm ơn bạn đã nhắn tin! Tôi là Bot tự động.";

    if (message.toLowerCase().includes("giá")) {
      botReply =
        "Bạn muốn tìm phòng giá khoảng bao nhiêu? Hãy thử dùng bộ lọc nhé!";
    } else if (message.toLowerCase().includes("xin chào")) {
      botReply = "Chào bạn! Chicky.stu có thể giúp gì cho bạn hôm nay?";
    }

    // 6. Lưu tin nhắn CỦA BOT vào DB
    // (Realtime sẽ tự đẩy tin này về Client)
    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, content: botReply, is_bot: true });

    return new Response(JSON.stringify({ success: true }), {
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

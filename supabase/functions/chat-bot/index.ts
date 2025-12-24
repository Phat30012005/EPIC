// supabase/functions/chat-bot/index.ts
// VERSION: V2.0 - RULE BASED ENGINE (KỊCH BẢN CỐ ĐỊNH)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BOT_SCRIPT } from "./script.ts"; // Import kịch bản vừa tạo ở Bước 1

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 1. Handle CORS (Cho phép trình duyệt gọi API)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Kết nối Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Kiểm tra Auth (User phải đăng nhập mới chat được)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    // 4. Lấy Step ID từ Frontend gửi lên
    // Payload mong đợi: { step_id: "guide_post" }
    // Nếu không có step_id, mặc định là "start"
    const { step_id } = await req.json();
    const currentStepId = step_id || "start";

    // 5. Tra cứu kịch bản (Logic cốt lõi)
    const stepData = BOT_SCRIPT[currentStepId];

    if (!stepData) {
      // Trường hợp gửi ID bậy bạ không có trong kịch bản
      throw new Error(`Step not found: ${currentStepId}`);
    }

    // 6. Lưu tin nhắn của Bot vào Database (Để hiện lịch sử chat)
    const { error: dbError } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      content: stepData.message, // Nội dung lời thoại của bot
      is_bot: true,
      // Lưu thêm metadata nếu cần sau này mở rộng (optional)
      // metadata: { options: stepData.options }
    });

    if (dbError) {
      console.error("DB Error:", dbError);
      throw new Error("Failed to save bot message");
    }

    // 7. Trả về phản hồi cho Frontend (Lời thoại + Nút bấm)
    return new Response(
      JSON.stringify({
        success: true,
        reply: stepData.message, // Lời thoại để hiển thị
        options: stepData.options, // Danh sách nút bấm để render
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("Bot Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

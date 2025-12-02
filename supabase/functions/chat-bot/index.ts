// supabase/functions/chat-bot/index.ts

// 1. Khai báo thư viện (Giữ nguyên)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// 2. Cấu hình CORS để Web gọi được API
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Xử lý pre-flight request
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // 3. Lấy API Key và kiểm tra
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("Chưa cấu hình GEMINI_API_KEY trong Supabase Secrets!");
    }

    // 4. Kết nối Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 5. Kiểm tra Auth (Người dùng phải đăng nhập)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Bạn chưa đăng nhập!" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Phiên đăng nhập không hợp lệ" }),
        { status: 401, headers: corsHeaders }
      );
    }

    // 6. Lấy tin nhắn từ Client
    const { message } = await req.json();

    // 7. TÌM KIẾM DỮ LIỆU (RAG)
    let contextInfo =
      "Hiện tại hệ thống chưa tìm thấy phòng trọ nào khớp với mô tả.";
    try {
      const { data: searchResults } = await supabase.rpc("search_posts_v2", {
        search_term: message,
      });
      if (searchResults && searchResults.length > 0) {
        // Lấy tối đa 3 phòng khớp nhất
        const listText = searchResults
          .slice(0, 3)
          .map(
            (p: any) =>
              `- Phòng trọ: ${p.motelName || p.title}. Giá: ${
                p.price
              } VNĐ. Khu vực: ${p.ward}. Địa chỉ: ${p.address_detail}`
          )
          .join("\n");
        contextInfo = `Hệ thống tìm thấy các phòng sau trong cơ sở dữ liệu:\n${listText}`;
      }
    } catch (err) {
      console.error("Lỗi tìm kiếm DB:", err);
      // Không throw error ở đây để bot vẫn trả lời được dù DB lỗi nhẹ
    }

    // 8. Tạo Prompt cho AI
    const SYSTEM_PROMPT = `
    Bạn là "Gà Bông" - Trợ lý ảo của website tìm trọ Chicky.stu tại Cần Thơ.
    Phong cách: Thân thiện, ngắn gọn, dùng emoji 🐣.
    
    Nhiệm vụ:
    1. Trả lời câu hỏi của khách dựa trên THÔNG TIN ĐƯỢC CUNG CẤP bên dưới.
    2. Nếu có phòng phù hợp trong thông tin cung cấp, hãy giới thiệu tên, giá và địa chỉ.
    3. Nếu thông tin cung cấp không có phòng nào phù hợp, hãy khuyên khách tìm kiếm trên thanh công cụ hoặc gọi hotline 0355746973.
    4. Tuyệt đối không tự bịa ra thông tin phòng trọ không có trong dữ liệu.

    === THÔNG TIN CUNG CẤP TỪ DATABASE ===
    ${contextInfo}
    ======================================
    `;

    // 9. Gửi sang Google Gemini (SỬA LỖI URL Ở ĐÂY)
    // Dùng phiên bản 'gemini-1.5-flash' chuẩn, bỏ chữ 'latest' để tránh lỗi 404
    // Dùng dấu backtick (`) để bao quanh URL
    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
      GEMINI_API_KEY;

    const aiPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT + "\n\nKhách hỏi: " + message }],
        },
      ],
    };

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(aiPayload),
    });

    const aiData = await aiResponse.json();
    let botReply = "";

    // 10. Xử lý phản hồi từ Google
    if (aiData.error) {
      console.error("Gemini API Error:", aiData.error);
      botReply = `Xin lỗi, Gà Bông đang gặp chút sự cố kết nối (Mã lỗi: ${aiData.error.code}). Bạn thử lại sau nhé!`;
    } else if (
      aiData.candidates &&
      aiData.candidates[0]?.content?.parts[0]?.text
    ) {
      botReply = aiData.candidates[0].content.parts[0].text;
    } else {
      botReply =
        "Gà Bông chưa hiểu ý bạn lắm, bạn hỏi lại rõ hơn được không? 🐣";
    }

    // 11. Lưu tin nhắn Bot vào Database
    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, content: botReply, is_bot: true });

    return new Response(JSON.stringify({ success: true, reply: botReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("System Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        reply: `Lỗi hệ thống: ${error.message}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  }
});

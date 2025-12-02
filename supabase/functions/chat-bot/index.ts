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
    // 1. LẤY VÀ LÀM SẠCH API KEY (FIX LỖI 404 QUAN TRỌNG)
    // .trim() sẽ loại bỏ dấu xuống dòng hoặc khoảng trắng vô tình copy phải
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();

    if (!GEMINI_API_KEY) {
      throw new Error("Chưa cấu hình GEMINI_API_KEY trong Supabase Secrets!");
    }

    // 2. Setup Client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Auth Check
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
        JSON.stringify({ error: "Phiên đăng nhập hết hạn" }),
        {
          status: 401,
          headers: corsHeaders,
        }
      );
    }

    // 4. Lấy tin nhắn
    const { message } = await req.json();

    // 5. RAG: Tìm kiếm dữ liệu liên quan
    let contextInfo =
      "Hiện tại chưa tìm thấy phòng trọ nào khớp yêu cầu trong hệ thống.";
    try {
      const { data: searchResults } = await supabase.rpc("search_posts_v2", {
        search_term: message,
      });

      if (searchResults && searchResults.length > 0) {
        const listText = searchResults
          .slice(0, 3) // Lấy 3 kết quả tốt nhất
          .map(
            (p: any) =>
              `- Phòng: ${p.motelName || p.title}. Giá: ${p.price}đ. Đ/c: ${
                p.address_detail
              }, ${p.ward}.`
          )
          .join("\n");
        contextInfo = `Dữ liệu phòng trọ tìm được:\n${listText}`;
      }
    } catch (err) {
      console.error("Lỗi Search DB:", err);
    }

    // 6. Prompt
    const SYSTEM_PROMPT = `
    Bạn là "Gà Bông" - Trợ lý ảo của Chicky.stu (Web tìm trọ Cần Thơ).
    Phong cách: Thân thiện, ngắn gọn, dùng emoji 🐣.
    
    Thông tin ngữ cảnh từ database:
    ${contextInfo}

    Yêu cầu:
    - Trả lời dựa trên thông tin ngữ cảnh trên.
    - Nếu có phòng phù hợp, hãy liệt kê Tên, Giá và Địa chỉ.
    - Nếu không có thông tin trong ngữ cảnh, hãy khuyên khách dùng thanh tìm kiếm hoặc gọi 0355746973.
    `;

    // 7. GỌI GEMINI API (Cấu hình chuẩn)
    // Dùng gemini-1.5-flash là bản ổn định, nhanh và rẻ nhất cho chatbot
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const aiPayload = {
      contents: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT + "\n\nUser: " + message }],
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

    // 8. Xử lý kết quả & Lỗi từ Google
    if (!aiResponse.ok || aiData.error) {
      const errCode = aiData.error?.code || aiResponse.status;
      const errMsg = aiData.error?.message || aiResponse.statusText;
      console.error(`Gemini Error (${errCode}):`, errMsg); // Log để check trên Dashboard

      botReply = `Xin lỗi, Gà Bông đang bị mất kết nối tới não bộ (Lỗi ${errCode}). Bạn chờ xíu rồi thử lại nhé! 🐣`;
    } else if (aiData.candidates?.[0]?.content?.parts?.[0]?.text) {
      botReply = aiData.candidates[0].content.parts[0].text;
    } else {
      botReply = "Gà Bông chưa hiểu câu hỏi, bạn nói rõ hơn được không? 🐣";
    }

    // 9. Lưu lịch sử chat
    await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, content: botReply, is_bot: true });

    return new Response(JSON.stringify({ success: true, reply: botReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Tiêu chuẩn CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 1. Xử lý preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Lấy ID từ query param của URL
    // Ví dụ: .../get-post-detail?id=abc-123
    const url = new URL(req.url);
    const postId = url.searchParams.get("id");

    // 3. Kiểm tra xem có ID không
    if (!postId) {
      return new Response(
        JSON.stringify({ error: 'Thiếu tham số "id" của bài đăng' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400, // Bad Request
        }
      );
    }

    // 4. Khởi tạo Admin Client (để vượt qua RLS nếu cần)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 5. Query CSDL (Logic chính)
    // Đây là logic quan trọng y hệt như trong chitiet.js:
    // Lấy 'posts' và JOIN 'profiles' nơi có user_id khớp
    const { data, error } = await supabaseAdmin
      .from("posts")
      .select("*, profiles(*)") // JOIN với bảng profiles
      .eq("id", postId) // Lọc theo ID
      .single(); // Chỉ lấy 1 kết quả

    if (error) {
      console.error("Lỗi query CSDL:", error.message);
      // Thường lỗi này là 500, hoặc 404 nếu .single() không tìm thấy gì
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500, // Internal Server Error
      });
    }

    // 6. Xử lý trường hợp không tìm thấy bài đăng (data là null)
    if (!data) {
      return new Response(
        JSON.stringify({ error: "Không tìm thấy bài đăng" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 404, // Not Found
        }
      );
    }

    // 7. Trả về thành công
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Lỗi server nội bộ:", err);
    // Trả về lỗi 500 (Internal Server Error)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

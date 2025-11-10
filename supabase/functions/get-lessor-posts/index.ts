// supabase/functions/get-lessor-posts/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hàm tạo phản hồi lỗi chuẩn
function createErrorResponse(message: string, status: number) {
  console.error(`[get-lessor-posts] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("[get-lessor-posts] Function đã sẵn sàng.");

Deno.serve(async (req, context) => {
  // 1. Xử lý preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Lấy user ID từ token (Bảo mật)
  // Vì verify_jwt = true, chúng ta có thể tin tưởng context.auth
  const {
    data: { user },
    error: authError,
  } = await context.auth.getUser();

  if (authError) {
    return createErrorResponse(`Xác thực thất bại: ${authError.message}`, 401);
  }
  if (!user) {
    return createErrorResponse(
      "Không tìm thấy user (token không hợp lệ?)",
      401
    );
  }

  // 3. Khởi tạo Admin Client
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // 4. Logic chính: Lấy các bài đăng CỦA user này
  try {
    const { data: posts, error: postsError } = await supabaseAdmin
      .from("posts")
      .select("*") // Lấy tất cả các cột
      .eq("user_id", user.id) // CHỈ lấy các bài có user_id khớp
      .order("created_at", { ascending: false }); // Sắp xếp tin mới nhất lên đầu

    if (postsError) {
      throw new Error(`Lỗi query CSDL: ${postsError.message}`);
    }

    // 5. Trả về thành công (trả về mảng bài đăng)
    console.log(
      `[get-lessor-posts] Lấy ${posts.length} bài đăng cho user ${user.email}.`
    );
    return new Response(JSON.stringify({ data: posts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return createErrorResponse(err.message || "Lỗi không xác định", 500);
  }
});

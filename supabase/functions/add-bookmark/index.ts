// supabase/functions/add-bookmark/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function createErrorResponse(message: string, status: number) {
  console.error(`[add-bookmark] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

console.log("[add-bookmark] Function đã sẵn sàng.");

Deno.serve(async (req, context) => {
  // 1. Xử lý preflight (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Lấy user (Bắt buộc, vì verify_jwt = true)
    const {
      data: { user },
      error: authError,
    } = await context.auth.getUser();

    if (authError) return createErrorResponse(authError.message, 401);
    if (!user) return createErrorResponse("Không tìm thấy user", 401);

    // 3. Lấy post_id từ body
    const body = await req.json();
    const postId = body.post_id;
    if (!postId) {
      return createErrorResponse("Thiếu 'post_id'", 400);
    }

    // 4. Khởi tạo Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 5. Logic chính: Thêm vào bảng 'bookmarks'
    const { data, error } = await supabaseAdmin
      .from("bookmarks")
      .insert({
        user_id: user.id, // ID của user đã đăng nhập
        post_id: postId, // ID của bài đăng muốn lưu
      })
      .select() // Trả về hàng vừa tạo
      .single();

    if (error) {
      // Xử lý lỗi (ví dụ: đã bookmark rồi)
      if (error.code === "23505") {
        // Lỗi "unique_violation"
        return createErrorResponse("Bạn đã lưu tin này rồi.", 409); // 409 = Conflict
      }
      throw new Error(`Lỗi CSDL: ${error.message}`);
    }

    // 6. Trả về thành công
    console.log(`[add-bookmark] User ${user.email} đã lưu post ${postId}`);
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return createErrorResponse(err.message, 500);
  }
});

// supabase/functions/remove-bookmark/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // Rất quan trọng: Thêm 'DELETE' vào danh sách method
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function createErrorResponse(message: string, status: number) {
  console.error(`[remove-bookmark] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

console.log("[remove-bookmark] Function đã sẵn sàng.");

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

    // 3. Lấy post_id từ query param (KHÁC VỚI ADD)
    // ví dụ: .../remove-bookmark?post_id=abc-123
    const url = new URL(req.url);
    const postId = url.searchParams.get("post_id");
    if (!postId) {
      return createErrorResponse("Thiếu 'post_id' trong query params", 400);
    }

    // 4. Khởi tạo Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 5. Logic chính: Xóa khỏi bảng 'bookmarks'
    const { error } = await supabaseAdmin
      .from("bookmarks")
      .delete()
      .match({
        user_id: user.id, // Phải khớp user
        post_id: postId,  // Phải khớp post
      });

    if (error) {
      throw new Error(`Lỗi CSDL khi xóa: ${error.message}`);
    }

    // 6. Trả về thành công
    console.log(`[remove-bookmark] User ${user.email} đã XÓA lưu post ${postId}`);
    return new Response(JSON.stringify({ data: { status: "deleted" } }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
    
  } catch (err) {
    return createErrorResponse(err.message, 500);
  }
});......corsHeaders.
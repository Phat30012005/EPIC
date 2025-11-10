// supabase/functions/get-user-bookmarks/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function createErrorResponse(message: string, status: number) {
  console.error(`[get-user-bookmarks] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

console.log("[get-user-bookmarks] Function đã sẵn sàng.");

Deno.serve(async (req, context) => {
  // 1. Xử lý preflight (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Lấy user (Bắt buộc)
    const {
      data: { user },
      error: authError,
    } = await context.auth.getUser();

    if (authError) return createErrorResponse(authError.message, 401);
    if (!user) return createErrorResponse("Không tìm thấy user", 401);

    // 3. Khởi tạo Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. Logic chính: Lấy bookmarks VÀ JOIN với bảng 'posts'
    // RLS của bảng 'bookmarks' đã bảo mật (chỉ user thấy của mình),
    // nhưng chúng ta dùng Admin Client để JOIN hiệu quả hơn.
    const { data, error } = await supabaseAdmin
      .from("bookmarks")
      .select(
        `
        id, 
        created_at,
        posts(*)  
      `
      )
      // posts(*) là cú pháp JOIN
      // Nó sẽ tự động lấy tất cả thông tin từ bảng 'posts'
      // nơi mà 'bookmarks.post_id' == 'posts.id'
      .eq("user_id", user.id) // Chỉ lấy của user này
      .order("created_at", { ascending: false }); // Sắp xếp tin mới lưu lên đầu

    if (error) {
      throw new Error(`Lỗi CSDL khi lấy bookmarks: ${error.message}`);
    }

    // 5. Trả về thành công
    console.log(
      `[get-user-bookmarks] User ${user.email} đã lấy ${data.length} bookmarks.`
    );
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return createErrorResponse(err.message, 500);
  }
});

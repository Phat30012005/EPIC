// supabase/functions/get-reviews-for-post/index.ts
// (Task 2.2 - Ngày 7)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function createErrorResponse(message: string, status: number) {
  console.error(`[get-reviews-for-post] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

console.log("[get-reviews-for-post] Function đã sẵn sàng.");

Deno.serve(async (req) => {
  // 1. Xử lý preflight (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Lấy post_id từ query param (KHÔNG cần đăng nhập)
    // (Vì function này là public, ai cũng xem được đánh giá)
    const url = new URL(req.url);
    const postId = url.searchParams.get("post_id");
    if (!postId) {
      return createErrorResponse("Thiếu 'post_id' trong query params", 400);
    }

    // 3. Khởi tạo Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. Logic chính: Lấy reviews VÀ JOIN với bảng 'profiles'
    // RLS của bảng 'reviews' đã cho phép public read (SELECT),
    // nên chúng ta có thể dùng client_anon cũng được,
    // nhưng dùng admin client để JOIN với 'profiles' (bảng private) sẽ dễ hơn.
    const { data, error } = await supabaseAdmin
      .from("reviews")
      .select(
        `
        id, 
        created_at,
        rating,
        comment,
        profiles ( contactName, email )  
      `
      )
      // profiles(...) là cú pháp JOIN
      // Nó sẽ tự động lấy thông tin từ bảng 'profiles'
      // nơi mà 'reviews.user_id' == 'profiles.id'
      .eq("post_id", postId) // Chỉ lấy review của bài đăng này
      .order("created_at", { ascending: false }); // Sắp xếp đánh giá mới nhất lên đầu

    if (error) {
      throw new Error(`Lỗi CSDL khi lấy reviews: ${error.message}`);
    }

    // 5. Trả về thành công
    console.log(
      `[get-reviews-for-post] Lấy ${data.length} reviews cho post ${postId}.`
    );
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return createErrorResponse(err.message, 500);
  }
});

// supabase/functions/add-review/index.ts
// (Task 2.1 - Ngày 7)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function createErrorResponse(message: string, status: number) {
  console.error(`[add-review] Lỗi ${status}:`, message);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

console.log("[add-review] Function đã sẵn sàng.");

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

    // 3. Lấy dữ liệu (post_id, rating, comment) từ body
    const body = await req.json();
    const { post_id, rating, comment } = body;

    // 4. Validate dữ liệu
    if (!post_id || !rating || !comment) {
      return createErrorResponse("Thiếu post_id, rating, hoặc comment", 400);
    }
    const numericRating = Number(rating);
    if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
      return createErrorResponse("Rating phải là một số từ 1 đến 5", 400);
    }
    if (comment.trim().length === 0) {
      return createErrorResponse("Comment không được để trống", 400);
    }

    // 5. Khởi tạo Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 6. Logic chính: Thêm vào bảng 'reviews'
    // (Bảng 'reviews' đã có RLS, nhưng chúng ta dùng Admin Client
    // để ghi đè RLS nếu cần, và để xử lý lỗi tốt hơn)
    const { data, error } = await supabaseAdmin
      .from("reviews")
      .insert({
        user_id: user.id, // ID của user đã đăng nhập
        post_id: post_id,
        rating: numericRating,
        comment: comment.trim(),
      })
      .select()
      .single();

    if (error) {
      // Xử lý lỗi (Rất quan trọng: Lỗi đã review rồi)
      if (error.code === "23505") {
        // Lỗi "unique_violation"
        return createErrorResponse("Bạn đã đánh giá tin này rồi.", 409); // 409 = Conflict
      }
      throw new Error(`Lỗi CSDL: ${error.message}`);
    }

    // 7. Trả về thành công
    console.log(`[add-review] User ${user.email} đã review post ${post_id}`);
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return createErrorResponse(err.message, 500);
  }
});

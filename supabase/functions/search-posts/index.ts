// supabase/functions/search-posts/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function createErrorResponse(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

console.log("[search-posts] Function đã sẵn sàng.");

Deno.serve(async (req) => {
  // 1. Xử lý preflight (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Lấy từ khóa tìm kiếm (query) từ URL
    // ví dụ: .../search-posts?q=phòng+trọ+ninh+kiều
    const url = new URL(req.url);
    const searchQuery = url.searchParams.get("q");

    if (!searchQuery) {
      return createErrorResponse("Thiếu tham số 'q' (query)", 400);
    }

    // 3. Khởi tạo Admin Client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. Chuyển đổi từ khóa tìm kiếm sang định dạng 'tsquery'
    // 'plainto_tsquery' tốt cho input của người dùng
    // 'websearch_to_tsquery' (mới hơn) thậm chí còn tốt hơn
    // Chúng ta dùng 'plainto_tsquery' cho tiếng Việt
    const tsQuery = `plainto_tsquery('vietnamese', '${searchQuery}')`;

    // 5. Thực thi RPC (Remote Procedure Call)
    // Thay vì dùng .select(), chúng ta dùng .rpc() để gọi hàm
    // hoặc query trực tiếp bằng FTS

    // Logic: Tìm các bài đăng 'posts' MÀ 'fts' (cột tsvector)
    // khớp (@@) với 'tsQuery' (từ khóa)
    const { data, error } = await supabaseAdmin
      .from("posts")
      .select("*") // Lấy tất cả các cột
      .filter("fts", "@@", tsQuery); // Đây là cú pháp FTS

    if (error) {
      return createErrorResponse(error.message, 500);
    }

    // 6. Trả về thành công
    console.log(
      `[search-posts] Tìm thấy ${data.length} kết quả cho: ${searchQuery}`
    );
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return createErrorResponse(err.message, 500);
  }
});

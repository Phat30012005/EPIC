// supabase/functions/get-post-detail/index.ts
// PHIÊN BẢN V2 (Sửa lỗi 500, lỗi select CSDL V4, và lỗi logic GET/POST)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function getPostDetail(postId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // (SỬA LỖI: Bỏ 'districts', 'wards'. Chỉ select cột có thật trong CSDL V4)
  const { data, error } = await supabase
    .from("posts")
    .select(
      `
      *,
      profiles:user_id (full_name, phone_number, email)
    `
    )
    .eq("post_id", postId) // 'post_id' ở đây là đúng (vì đây là lệnh WHERE)
    .single();

  if (error) {
    throw error;
  }
  return data;
}

Deno.serve(async (req) => {
  // Xử lý CORS (Giữ nguyên)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS", // Chỉ cho phép GET
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // (SỬA LỖI: Đọc 'id' từ URL (GET) thay vì req.json() (POST))
    const url = new URL(req.url);
    const postId = url.searchParams.get("id"); // 'id' khớp với 'chitiet.js' gửi

    if (!postId) {
      throw new Error("Missing post 'id' parameter");
    }

    const data = await getPostDetail(postId);

    // Trả về thành công
    return new Response(JSON.stringify({ data: data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Lỗi trong function get-post-detail:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

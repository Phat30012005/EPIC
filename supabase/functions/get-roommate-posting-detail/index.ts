// supabase/functions/get-roommate-posting-detail/index.ts
// (Clone từ get-post-detail và sửa lại)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function getRoommatePostDetail(postId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // (SỬA) Truy vấn bảng 'roommate_postings'
  // (SỬA) JOIN với 'profiles' để lấy TẤT CẢ thông tin liên hệ
  const { data, error } = await supabase
    .from("roommate_postings")
    .select(
      `
      *,
      profiles:user_id (full_name, phone_number, email)
    `
    )
    .eq("posting_id", postId) // Dùng 'posting_id'
    .single();

  if (error) {
    throw error;
  }
  return data;
}

Deno.serve(async (req) => {
  // 1. Xử lý CORS (Giữ nguyên)
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
    // 2. (SỬA) Lấy 'id' từ URL (Frontend sẽ gửi ?id=...)
    // (Giống hệt get-post-detail)
    const url = new URL(req.url);
    const postId = url.searchParams.get("id"); // 'id' khớp với 'chitiet.js'

    if (!postId) {
      throw new Error("Missing post 'id' parameter");
    }

    // 3. Gọi hàm logic ở trên
    const data = await getRoommatePostDetail(postId);

    // 4. Trả về thành công
    // (Giống hệt get-post-detail, api-client sẽ unpack 'data' này)
    return new Response(JSON.stringify({ data: data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });
  } catch (error) {
    console.error(
      "Lỗi trong function get-roommate-posting-detail:",
      error.message
    );
    const status = error.message.includes("PGRST116") ? 404 : 500; // 404 nếu không tìm thấy
    return new Response(JSON.stringify({ error: error.message }), {
      status: status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

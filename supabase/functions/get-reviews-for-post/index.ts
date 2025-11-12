// supabase/functions/get-reviews-for-post/index.ts

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// SỬA LỖI 1: Xóa cú pháp Markdown [ ](...) khỏi dòng import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function getReviewsForPost(postId) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data, error } = await supabase
    .from("reviews")
    .select(
      `
      *,
      profiles:user_id (full_name, avatar_url)
    `
    )
    .eq("post_id", postId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }
  return data;
}

// [DÁN CODE NÀY VÀO THAY THẾ HÀM Deno.serve CŨ]
Deno.serve(async (req) => {
  // Xử lý CORS
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
    // (SỬA LỖI: Đọc 'post_id' từ URL (GET) thay vì req.json())
    const url = new URL(req.url);
    // 'chitiet.js' gửi 'post_id' qua params
    const postId = url.searchParams.get("post_id");

    if (!postId) {
      throw new Error("Missing 'post_id' parameter");
    }

    // Gọi hàm logic (ở trên)
    const data = await getReviewsForPost(postId);

    // Trả về thành công
    return new Response(JSON.stringify({ data: data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Lỗi trong function get-reviews-for-post:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

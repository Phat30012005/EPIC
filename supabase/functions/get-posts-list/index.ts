// supabase/functions/get-posts-list/index.ts
// PHIÊN BẢN V3 (Sửa lỗi cú pháp 503)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Hàm xử lý logic chính
async function getPosts(filters) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. (SỬA LỖI) Chỉ select các cột CÓ THẬT trong CSDL V3
  let query = supabase.from("posts").select(
    `
      id:post_id,
      post_id,
      title,
      "motelName",
      price,
      area,
      image_urls,
      address_detail,
      ward,
      room_type,
      created_at,
      reviews:reviews ( rating )
    `
  );

  // 2. (SỬA LỖI) Áp dụng filter dựa trên các param từ URL
  if (filters.ward) {
    query = query.eq("ward", filters.ward);
  }
  if (filters.type) {
    query = query.eq("room_type", filters.type);
  }

  // Logic xử lý giá (ví dụ: "1-2" hoặc "tren6")
  if (filters.price) {
    if (filters.price === "tren6") {
      query = query.gte("price", 6000000);
    } else {
      const parts = filters.price.split("-").map(Number);
      if (parts.length === 2) {
        query = query.gte("price", parts[0] * 1000000);
        query = query.lte("price", parts[1] * 1000000);
      }
    }
  }

  // Logic xử lý diện tích (ví dụ: "10-16" hoặc "tren35")
  if (filters.size) {
    if (filters.size === "tren35") {
      query = query.gte("area", 35);
    } else {
      const parts = filters.size.split("-").map(Number);
      if (parts.length === 2) {
        query = query.gte("area", parts[0]);
        query = query.lte("area", parts[1]);
      }
    }
  }

  // Sắp xếp
  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  // 3. Tính toán avg_rating
  const postsWithAvgRating = data.map((post) => {
    let totalRating = 0;
    // Đảm bảo post.reviews là một mảng
    const reviewsCount = Array.isArray(post.reviews) ? post.reviews.length : 0;

    if (reviewsCount > 0) {
      post.reviews.forEach((review) => {
        totalRating += review.rating;
      });
      post.average_rating = (totalRating / reviewsCount).toFixed(1);
    } else {
      post.average_rating = "N/A";
    }
    // Xóa reviews đi để response nhẹ hơn
    delete post.reviews;
    return post;
  });

  return postsWithAvgRating;
}

// Hàm Deno.serve (Entrypoint)
Deno.serve(async (req) => {
  // Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    // Đọc filter từ URL (GET)
    const url = new URL(req.url);
    const filters = {
      ward: url.searchParams.get("ward"),
      type: url.searchParams.get("type"),
      price: url.searchParams.get("price"),
      size: url.searchParams.get("size"),
    };

    // Gọi hàm logic với các filter đã được parse
    const data = await getPosts(filters);

    // Trả về thành công
    return new Response(JSON.stringify({ data: data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Lỗi trong function get-posts-list:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

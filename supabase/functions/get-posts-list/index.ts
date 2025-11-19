// supabase/functions/get-posts-list/index.ts
// PHIÊN BẢN V8 (Fix Lỗi Bộ lọc Khu vực - Dùng ilike thay vì eq)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function getPosts(filters: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let query = supabase.from("posts").select(
    `
      id:post_id,
      post_id,
      title,
      motelName,
      price,
      area,
      image_urls,
      address_detail,
      ward,
      room_type,
      created_at,
      status,
      reviews:reviews ( rating )
    `,
    { count: "exact" }
  );

  // 1. Chỉ lấy tin đã duyệt
  query = query.eq("status", "APPROVED");

  // 2. Xử lý Bộ lọc
  if (filters.ward) {
    // [SỬA LỖI Ở ĐÂY]: Dùng ilike để tìm kiếm tương đối
    // Ví dụ: Tìm "Ninh Kiều" sẽ khớp với "An Cư (Ninh Kiều)"
    query = query.ilike("ward", `%${filters.ward}%`);
  }

  if (filters.type) {
    // Loại phòng (Phòng đơn, Căn hộ...) thì vẫn dùng eq (chính xác)
    query = query.eq("room_type", filters.type);
  }

  if (filters.price) {
    if (filters.price === "tren6") {
      query = query.gte("price", 6000000);
    } else {
      const parts = filters.price.split("-").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        query = query.gte("price", parts[0] * 1000000);
        query = query.lte("price", parts[1] * 1000000);
      }
    }
  }

  if (filters.size) {
    if (filters.size === "tren35") {
      query = query.gte("area", 35);
    } else {
      const parts = filters.size.split("-").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        query = query.gte("area", parts[0]);
        query = query.lte("area", parts[1]);
      }
    }
  }

  // 3. Sắp xếp & Phân trang
  query = query.order("created_at", { ascending: false });

  const page = filters.page ? parseInt(filters.page) : 1;
  const limit = filters.limit ? parseInt(filters.limit) : 12;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  // 4. Thực thi
  const { data, error, count } = await query;
  if (error) throw error;

  const postsWithAvgRating = data?.map((post: any) => {
    let totalRating = 0;
    const reviewsCount = Array.isArray(post.reviews) ? post.reviews.length : 0;

    if (reviewsCount > 0) {
      post.reviews.forEach((review: any) => {
        totalRating += review.rating;
      });
      post.average_rating = (totalRating / reviewsCount).toFixed(1);
    } else {
      post.average_rating = "N/A";
    }
    delete post.reviews;
    return post;
  });

  return {
    data: postsWithAvgRating,
    pagination: {
      page: page,
      limit: limit,
      total_records: count,
      total_pages: count ? Math.ceil(count / limit) : 0,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const filters = {
      ward: url.searchParams.get("ward"),
      type: url.searchParams.get("type"),
      price: url.searchParams.get("price"),
      size: url.searchParams.get("size"),
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
    };

    const result = await getPosts(filters);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Lỗi get-posts-list:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

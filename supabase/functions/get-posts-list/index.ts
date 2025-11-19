// supabase/functions/get-posts-list/index.ts
// PHIÊN BẢN V4 (Thêm Phân trang & Lọc trạng thái APPROVED)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cấu hình CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Hàm xử lý logic chính
async function getPosts(filters: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Xây dựng query cơ bản
  // [QUAN TRỌNG]: Chỉ lấy cột cần thiết để tối ưu tốc độ
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
    { count: "exact" } // Lấy tổng số lượng tin để tính số trang
  );

  // 2. [MỚI] BẮT BUỘC: Chỉ lấy tin đã được duyệt
  // Tránh lỗi hiển thị tin rác/tin xấu
  query = query.eq("status", "APPROVED");

  // 3. Áp dụng các bộ lọc từ Frontend (Giữ nguyên logic cũ)
  if (filters.ward) query = query.eq("ward", filters.ward);
  if (filters.type) query = query.eq("room_type", filters.type);

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

  // 4. Sắp xếp: Tin mới nhất lên đầu
  query = query.order("created_at", { ascending: false });

  // 5. [MỚI] Xử lý Phân trang (Pagination)
  const page = filters.page ? parseInt(filters.page) : 1;
  const limit = filters.limit ? parseInt(filters.limit) : 12; // Mặc định 12 tin/trang
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  // Áp dụng range vào query
  query = query.range(from, to);

  // 6. Thực thi truy vấn
  const { data, error, count } = await query;
  if (error) throw error;

  // 7. Tính toán avg_rating (Giữ nguyên logic cũ)
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
    // Xóa reviews raw để giảm dung lượng response
    delete post.reviews;
    return post;
  });

  // 8. Trả về dữ liệu kèm thông tin phân trang
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

// Entrypoint
Deno.serve(async (req) => {
  // Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Đọc filter từ URL (GET)
    const url = new URL(req.url);
    const filters = {
      ward: url.searchParams.get("ward"),
      type: url.searchParams.get("type"),
      price: url.searchParams.get("price"),
      size: url.searchParams.get("size"),
      // [MỚI] Nhận tham số phân trang
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
    };

    const result = await getPosts(filters);

    // Trả về cấu trúc mới: { data: [...], pagination: {...} }
    // Frontend cũ đang đọc `response.data`, nên ta cần trả về `result` (chứa data bên trong)
    // Tuy nhiên, để tương thích ngược tạm thời, ta trả về cấu trúc:
    // { data: result.data, pagination: result.pagination }
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

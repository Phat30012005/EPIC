// supabase/functions/get-roommate-postings/index.ts
// PHIÊN BẢN V3 (ĐỒNG BỘ HÓA TOÀN DIỆN: ILIKE + PAGINATION)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function getRoommatePostings(filters: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Xây dựng query
  let query = supabase.from("roommate_postings").select(
    `
      *,
      profiles:user_id ( full_name, avatar_url )
    `,
    { count: "exact" }
  );

  // 2. Lọc trạng thái (Mặc định bảng này dùng status='OPEN')
  query = query.eq("status", "OPEN");

  // 3. Xử lý Bộ lọc (QUAN TRỌNG: Dùng ilike cho Ward)
  if (filters.ward) {
    // FIX LỖI: Dùng ilike để "Ninh Kiều" khớp với "An Cư (Ninh Kiều)"
    query = query.ilike("ward", `%${filters.ward}%`);
  }

  if (filters.posting_type) {
    query = query.eq("posting_type", filters.posting_type);
  }

  if (filters.gender_preference && filters.gender_preference !== "Tất cả") {
    // Chỉ lọc nếu không phải là "Tất cả" hoặc "Không yêu cầu" tùy logic frontend
    // Nhưng an toàn nhất là so sánh chính xác nếu FE gửi đúng value
    query = query.eq("gender_preference", filters.gender_preference);
  }

  // 4. Xử lý lọc giá (Đồng bộ logic với get-posts-list)
  if (filters.price) {
    if (filters.price === "tren3") {
      query = query.gte("price", 3000000);
    } else {
      const parts = filters.price.split("-").map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        query = query.gte("price", parts[0] * 1000000);
        query = query.lte("price", parts[1] * 1000000);
      }
    }
  }

  // 5. Sắp xếp & Phân trang
  query = query.order("created_at", { ascending: false });

  const page = filters.page ? parseInt(filters.page) : 1;
  const limit = filters.limit ? parseInt(filters.limit) : 12;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  // 6. Thực thi
  const { data, error, count } = await query;
  if (error) throw error;

  return {
    data: data,
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
      posting_type: url.searchParams.get("posting_type"),
      gender_preference: url.searchParams.get("gender_preference"),
      price: url.searchParams.get("price"),
      page: url.searchParams.get("page"),
      limit: url.searchParams.get("limit"),
    };

    const result = await getRoommatePostings(filters);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Lỗi get-roommate-postings:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// supabase/functions/get-roommate-postings/index.ts
// (PHIÊN BẢN V2 - SỬA LỖI 503 CRASH)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  // 1. Xử lý CORS
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Đọc filter từ URL (GET)
    const url = new URL(req.url);
    const filters = {
      ward: url.searchParams.get("ward"),
      posting_type: url.searchParams.get("posting_type"),
      gender_preference: url.searchParams.get("gender_preference"),
      price: url.searchParams.get("price"),
    };

    // 3. Xây dựng query (Giữ nguyên)
    let query = supabaseAdmin
      .from("roommate_postings")
      .select(
        `
        *, 
        profiles:user_id ( full_name, avatar_url )
      `
      )
      .eq("status", "OPEN");

    // 4. Áp dụng filter (Giữ nguyên)
    if (filters.ward) {
      query = query.eq("ward", filters.ward);
    }
    if (filters.posting_type) {
      query = query.eq("posting_type", filters.posting_type);
    }
    if (filters.gender_preference) {
      query = query.eq("gender_preference", filters.gender_preference);
    }

    // 5. (SỬA LỖI 503) Logic xử lý giá (chặt chẽ hơn)
    if (filters.price) {
      if (filters.price === "tren3") {
        // Xử lý 'Trên 3 triệu' (value="tren3")
        query = query.gte("price", 3000000);
      } else {
        // Xử lý '0-2' hoặc '2-3'
        const parts = filters.price.split("-").map(Number);
        // Kiểm tra an toàn
        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          query = query.gte("price", parts[0] * 1000000);
          query = query.lte("price", parts[1] * 1000000);
        }
      }
    }

    // 6. Sắp xếp (Giữ nguyên)
    query = query.order("created_at", { ascending: false });

    // 7. Thực thi
    const { data, error } = await query;
    if (error) throw error;

    // 8. Trả về thành công
    return new Response(JSON.stringify({ data: data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });
  } catch (error) {
    console.error("Lỗi trong function get-roommate-postings:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, // Lỗi 500 (Internal Server Error) thay vì 503
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

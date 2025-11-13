/ supabase/cfinnostu / get - roommate - postings / index.ts;
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
      price: url.searchParams.get("price"), // vd: "1-2" hoặc "tren3"
    };

    // 3. Xây dựng query
    // KIỂM TRA DOMINO: JOIN với profiles để lấy tên/avatar người đăng
    let query = supabaseAdmin
      .from("roommate_postings")
      .select(
        `
        *, 
        profiles:user_id ( full_name, avatar_url )
      `
      )
      .eq("status", "OPEN"); // Chỉ lấy tin đang mở

    // 4. Áp dụng filter (giống hệt get-posts-list)
    if (filters.ward) {
      query = query.eq("ward", filters.ward);
    }
    if (filters.posting_type) {
      query = query.eq("posting_type", filters.posting_type);
    }
    if (filters.gender_preference) {
      query = query.eq("gender_preference", filters.gender_preference);
    }

    // Logic xử lý giá (copy từ get-posts-list)
    if (filters.price) {
      // Ví dụ: "tren3" (trên 3 triệu)
      if (filters.price.startsWith("tren")) {
        const amount = Number(filters.price.replace("tren", "")) * 1000000;
        query = query.gte("price", amount);
      } else {
        // Ví dụ: "1-2" (1-2 triệu)
        const parts = filters.price.split("-").map(Number);
        if (parts.length === 2) {
          query = query.gte("price", parts[0] * 1000000);
          query = query.lte("price", parts[1] * 1000000);
        }
      }
    }

    // 5. Sắp xếp
    query = query.order("created_at", { ascending: false });

    // 6. Thực thi
    const { data, error } = await query;
    if (error) throw error;

    // 7. Trả về thành công
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
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

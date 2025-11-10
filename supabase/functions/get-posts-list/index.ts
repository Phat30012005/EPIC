// supabase/functions/get-posts-list/index.ts
// Function này thay thế logic filter trong danhSach.js

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 1. Xử lý preflight (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Khởi tạo Admin Client (dùng để query)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 3. === PHẦN LOGIC (VIỆC CỦA MAI - SẼ LÀM Ở BƯỚC SAU) ===
    // Lấy các tham số filter từ URL
    // ví dụ: .../get-posts-list?type=Phòng%20đơn&price=1-2
    const url = new URL(req.url);
    const roomType = url.searchParams.get("type");
    const priceRange = url.searchParams.get("price");
    const sizeRange = url.searchParams.get("size");
    const ward = url.searchParams.get("ward");

    // Bắt đầu query
    let query = supabaseAdmin.from("posts").select("*");

    // --- (TODO: Thêm logic filter động dựa trên các biến ở trên) ---
    // Ví dụ:
    // if (roomType) {
    //   query = query.eq("room_type", roomType);
    // }
    // if (priceRange === "1-2") {
    //   query = query.gte("price", 1000000).lte("price", 2000000);
    // }
    // ...

    // Tạm thời lấy tất cả bài đăng
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Lỗi hệ thống (catch):", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

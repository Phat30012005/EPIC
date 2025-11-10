// supabase/functions/get-posts-list/index.ts
// (ĐÃ HOÀN THIỆN LOGIC - VAI TRÒ CỦA MAI)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Hàm trợ giúp xử lý lỗi (tương tự create-post)
function createErrorResponse(message: string, status: number) {
  console.error(`LỖI: ${message}`);
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: status,
  });
}

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

    // 3. === LOGIC FILTER ĐỘNG (CỐT LÕI CỦA MAI) ===

    // Lấy các tham số filter từ URL
    // ví dụ: .../get-posts-list?type=Phòng%20đơn&price=1-2
    const url = new URL(req.url);
    const roomType = url.searchParams.get("type");
    const priceRange = url.searchParams.get("price");

    // ĐỔI TÊN: Đổi 'roomsize-desktop' thành 'size' cho ngắn gọn phía API
    const sizeRange = url.searchParams.get("size");
    // ĐỔI TÊN: Đổi 'local-desktop' thành 'ward'
    const ward = url.searchParams.get("ward");

    console.log(
      `[get-posts-list] Đang lọc với: type=${roomType}, price=${priceRange}, size=${sizeRange}, ward=${ward}`
    );

    // 4. Xây dựng query động
    // RẤT QUAN TRỌNG: Khai báo 'let query' để có thể sửa đổi nó
    let query = supabaseAdmin.from("posts").select("*");

    // Lọc theo Loại phòng (nếu có)
    if (roomType) {
      query = query.eq("room_type", roomType);
    }

    // Lọc theo Khu vực (nếu có)
    // Dùng 'ilike' để tìm kiếm không phân biệt hoa/thường
    // và '%${ward}%' để tìm trong chuỗi (ví dụ: "Ninh Kiều" sẽ khớp với "An Cư (Ninh Kiều)")
    if (ward) {
      // **LƯU Ý QUAN TRỌNG**: Tên cột trong CSDL của bạn là 'ward'
      query = query.ilike("ward", `%${ward}%`);
    }

    // Lọc theo Giá (nếu có)
    if (priceRange) {
      // **LƯU Ý QUAN TRỌNG**: Tên cột trong CSDL của bạn là 'price'
      if (priceRange === "1-2") {
        query = query.gte("price", 1000000).lte("price", 2000000);
      } else if (priceRange === "3-4") {
        query = query.gte("price", 3000000).lte("price", 4000000);
      } else if (priceRange === "5-6") {
        query = query.gte("price", 5000000).lte("price", 6000000);
      } else if (priceRange === "tren6") {
        query = query.gte("price", 6000000); // gte = 'greater than or equal'
      }
    }

    // Lọc theo Diện tích (nếu có)
    if (sizeRange) {
      // **LƯU Ý QUAN TRỌNG**: Tên cột trong CSDL của bạn là 'area'
      if (sizeRange === "10-16") {
        query = query.gte("area", 10).lte("area", 16);
      } else if (sizeRange === "17-25") {
        query = query.gte("area", 17).lte("area", 25);
      } else if (sizeRange === "26-35") {
        query = query.gte("area", 26).lte("area", 35);
      } else if (sizeRange === "tren35") {
        query = query.gte("area", 35);
      }
    }

    // 5. Thực thi query
    // Luôn sắp xếp tin mới nhất lên đầu
    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) {
      // Lỗi CSDL (ví dụ: gõ sai tên cột)
      return createErrorResponse(error.message, 500);
    }

    // 6. Trả về thành công
    console.log(`[get-posts-list] Tìm thấy ${data.length} kết quả.`);
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    // Lỗi chung
    return createErrorResponse(err.message, 500);
  }
});

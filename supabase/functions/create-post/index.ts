// supabase/functions/create-post/index.ts
// Đây là function PHỨC TẠP NHẤT, thay thế dangtin.js
// Nhiệm vụ của Phát là thiết lập sườn bảo mật cho nó.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req, context) => {
  // 1. Xử lý preflight (CORS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. === PHẦN BẢO MẬT (VIỆC CỦA PHÁT) ===
    // Vì 'verify_jwt = true', Supabase *tự động* kiểm tra token.
    // Chúng ta chỉ cần lấy thông tin user đã được xác thực.
    // 'context.auth.getUser()' sẽ LỖI nếu token không hợp lệ hoặc thiếu.
    const {
      data: { user },
      error: authError,
    } = await context.auth.getUser();

    if (authError) {
      console.error("Lỗi xác thực:", authError.message);
      return new Response(
        JSON.stringify({ error: "Chưa xác thực hoặc token không hợp lệ" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401, // Unauthorized
        }
      );
    }

    // Ghi log để biết ai đang gọi
    console.log(`[create-post] Được gọi bởi user: ${user.email}`);

    // 3. Khởi tạo Admin Client (để upload/insert)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. === PHẦN LOGIC (VIỆC CỦA VY - SẼ LÀM Ở BƯỚC SAU) ===
    // Function này sẽ nhận FormData (chứ không phải JSON)
    // vì nó chứa cả text và file ảnh.
    const formData = await req.formData();

    // Lấy thử một trường text để test
    const title = formData.get("title") as string;
    console.log("Tiêu đề từ FormData:", title);

    // --- (TODO: Logic upload nhiều file ảnh lên Storage) ---
    // --- (TODO: Lấy mảng URL ảnh) ---
    // --- (TODO: Lấy các trường text khác từ formData) ---
    // --- (TODO: Insert vào CSDL) ---

    // Tạm thời trả về thành công để test
    return new Response(
      JSON.stringify({
        success: true,
        userEmail: user.email,
        receivedTitle: title,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Lỗi hệ thống (catch):", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

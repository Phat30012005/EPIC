// supabase/functions/user-signup/index.ts
// (PHIÊN BẢN ĐÃ VÁ LỖI BẢO MẬT ROLE)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

console.log("Function user-signup ĐÃ SẴN SÀNG!");

Deno.serve(async (req) => {
  // 1. Xử lý preflight request (OPTIONS) cho CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Lấy dữ liệu từ body
    const { email, password, contactName, phone, role } = await req.json();

    // --- [BẢO MẬT] KIỂM TRA ROLE (MỚI THÊM) ---
    // Chỉ cho phép 2 vai trò này. Nếu gửi 'ADMIN' hay bất kỳ gì khác -> Ép về 'RENTER'
    const validRoles = ["LESSOR", "RENTER"];
    let safeRole = role;

    if (!validRoles.includes(role)) {
      console.warn(
        `[user-signup] Cảnh báo: Role không hợp lệ '${role}'. Đang ép về 'RENTER'.`
      );
      safeRole = "RENTER";
    }
    // -------------------------------------------

    // 3. Tạo Admin Client (an toàn ở backend)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(
      `[user-signup] Đang xử lý đăng ký cho: ${email} với vai trò: ${safeRole}`
    );

    // 4. Thực hiện logic signUp với safeRole
    const { data, error } = await supabaseAdmin.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          contactName: contactName,
          phone: phone,
          role: safeRole, // Sử dụng biến đã được kiểm duyệt
        },
      },
    });

    if (error) {
      console.error("[user-signup] Lỗi từ Supabase Auth:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 5. Trả về dữ liệu
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    console.error("[user-signup] Lỗi hệ thống (catch):", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

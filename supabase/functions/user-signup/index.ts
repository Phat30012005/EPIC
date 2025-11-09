// supabase/functions/user-signup/index.ts

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// (Hàm này dùng để xử lý lỗi CORS khi gọi từ trình duyệt)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Cho phép mọi domain (cho local dev)
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
    // 2. Lấy (email, password, metadata) từ body
    const { email, password, contactName, phone, role } = await req.json();

    // 3. Tạo Admin Client (an toàn ở backend)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log(`[user-signup] Đang xử lý đăng ký cho: ${email}`);

    // 4. Thực hiện logic signUp
    const { data, error } = await supabaseAdmin.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          contactName: contactName,
          phone: phone,
          role: role,
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

    // 5. Trả về dữ liệu (user, session...)
    console.log("[user-signup] Đăng ký thành công cho:", data?.user?.email);
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("[user-signup] Lỗi hệ thống (catch):", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

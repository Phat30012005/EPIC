// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// Tiêu chuẩn CORS
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // 1. Xử lý preflight request (OPTIONS)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Lấy email và password từ body
    const { email, password } = await req.json();

    // 3. Khởi tạo Admin Client
    // Cần dùng service_role để gọi API auth
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 4. Gọi hàm signInWithPassword (Logic chính)
    // KHÁC BIỆT: Dùng signInWithPassword
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error("Lỗi khi đăng nhập:", error.message);
      // Trả về lỗi 400 (Bad Request), thường là sai pass hoặc email
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // 5. Trả về thành công (data chứa session)
    return new Response(JSON.stringify({ data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    console.error("Lỗi server nội bộ:", err);
    // Trả về lỗi 500 (Internal Server Error)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

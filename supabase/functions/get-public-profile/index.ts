// supabase/functions/get-public-profile/index.ts
// (PHIÊN BẢN FIX LỖI CỘT DỮ LIỆU)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing user_id param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lấy thông tin public
    // Lưu ý: Bảng profiles phải có đủ các cột này
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, avatar_url, phone_number, email, role, created_at"
      )
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Database Error:", error);

      // Phân loại lỗi
      // PGRST116: Trả về 0 dòng (User không tồn tại)
      if (error.code === "PGRST116") {
        return new Response(JSON.stringify({ error: "User not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Các lỗi khác (Ví dụ: Thiếu cột, RLS, Server...)
      return new Response(
        JSON.stringify({ error: "Database Error: " + error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ data }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

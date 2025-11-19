// supabase/functions/admin-get-posts/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req, context) => {
  // 1. Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 2. Xác thực User (Bắt buộc)
    let userId: string;
    try {
      if (context && context.auth) {
        const {
          data: { user },
          error,
        } = await context.auth.getUser();
        if (error || !user) throw new Error("User not found");
        userId = user.id;
      } else {
        userId = await getUserIdFromToken(req);
      }
    } catch (e) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: " + e.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Kiểm tra quyền ADMIN (QUAN TRỌNG)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError || profile?.role !== "ADMIN") {
      return new Response(
        JSON.stringify({ error: "Forbidden: You are not an Admin" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Lấy tham số lọc từ URL (Ví dụ: ?status=PENDING)
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status"); // Có thể là 'PENDING', 'APPROVED', 'REJECTED' hoặc null (lấy hết)

    // 5. Query dữ liệu
    let query = supabase
      .from("posts")
      .select(
        `
        id:post_id,
        post_id,
        title,
        price,
        created_at,
        status,
        profiles:user_id ( email, full_name )
      `
      )
      .order("created_at", { ascending: false });

    // Nếu có filter status thì áp dụng
    if (statusFilter && statusFilter !== "ALL") {
      query = query.eq("status", statusFilter);
    }

    const { data, error } = await query;

    if (error) throw error;

    return new Response(JSON.stringify({ data: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

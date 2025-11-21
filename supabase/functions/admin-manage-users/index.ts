// supabase/functions/admin-manage-users/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req, context) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. XÁC THỰC & KIỂM TRA QUYỀN ADMIN
    let currentUserId: string;
    try {
      if (context && context.auth) {
        const {
          data: { user },
        } = await context.auth.getUser();
        currentUserId = user?.id || "";
      } else {
        currentUserId = await getUserIdFromToken(req);
      }
    } catch (e: any) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { data: adminProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", currentUserId)
      .single();

    if (adminProfile?.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden: Admins only" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // 2. XỬ LÝ GET (Lấy danh sách User)
    if (req.method === "GET") {
      // Lấy tất cả profiles, sắp xếp theo ngày tạo mới nhất
      const { data: users, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ data: users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. XỬ LÝ PATCH (Cấm / Mở cấm User)
    if (req.method === "PATCH") {
      const { user_id, is_banned } = await req.json();

      if (!user_id || typeof is_banned !== "boolean") {
        return new Response(JSON.stringify({ error: "Invalid params" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Không cho phép Admin tự ban chính mình
      if (user_id === currentUserId) {
        return new Response(JSON.stringify({ error: "Cannot ban yourself" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const { data, error } = await supabase
        .from("profiles")
        .update({ is_banned: is_banned })
        .eq("id", user_id)
        .select()
        .single();

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response("Method Not Allowed", {
      status: 405,
      headers: corsHeaders,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

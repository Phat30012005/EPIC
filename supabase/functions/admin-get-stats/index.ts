// supabase/functions/admin-get-stats/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

    // 1. CHECK QUYỀN ADMIN
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
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // 2. ĐẾM DỮ LIỆU (Chạy song song cho nhanh)
    // Dùng { count: 'exact', head: true } để chỉ đếm số lượng, không lấy data -> Siêu nhanh
    const [
      { count: totalUsers },
      { count: totalPosts },
      { count: pendingPosts },
      { count: totalRoommates },
      { count: totalReviews },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase
        .from("posts")
        .select("*", { count: "exact", head: true })
        .eq("status", "PENDING"),
      supabase
        .from("roommate_postings")
        .select("*", { count: "exact", head: true }),
      supabase.from("reviews").select("*", { count: "exact", head: true }),
    ]);

    const stats = {
      users: totalUsers || 0,
      posts: totalPosts || 0,
      pending_posts: pendingPosts || 0,
      roommates: totalRoommates || 0,
      reviews: totalReviews || 0,
    };

    return new Response(JSON.stringify(stats), {
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

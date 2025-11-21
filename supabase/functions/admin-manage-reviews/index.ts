// supabase/functions/admin-manage-reviews/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, DELETE, OPTIONS",
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

    // 1. XÁC THỰC & CHECK QUYỀN ADMIN
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

    // 2. GET: Lấy danh sách đánh giá (Kèm thông tin người review & tên bài đăng)
    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("reviews")
        .select(
          `
          review_id,
          rating,
          comment,
          created_at,
          profiles:user_id ( full_name, email ),
          posts:post_id ( title )
        `
        )
        .order("created_at", { ascending: false })
        .limit(100); // Giới hạn 100 đánh giá mới nhất để đỡ lag

      if (error) throw error;

      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // 3. DELETE: Xóa đánh giá vi phạm
    if (req.method === "DELETE") {
      const url = new URL(req.url);
      const reviewId = url.searchParams.get("id");

      if (!reviewId) {
        return new Response(JSON.stringify({ error: "Missing id param" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const { error } = await supabase
        .from("reviews")
        .delete()
        .eq("review_id", reviewId);

      if (error) throw error;

      return new Response(JSON.stringify({ message: "Deleted successfully" }), {
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

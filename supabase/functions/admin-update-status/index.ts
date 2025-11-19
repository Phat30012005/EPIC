// supabase/functions/admin-update-status/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Xác thực (Giống bên trên)
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 2. Check quyền Admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();
    if (profile?.role !== "ADMIN") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    // 3. Lấy dữ liệu từ Body
    const { post_id, new_status } = await req.json();

    if (!post_id || !["APPROVED", "REJECTED", "PENDING"].includes(new_status)) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    // 4. Cập nhật Database
    const { error } = await supabase
      .from("posts")
      .update({ status: new_status })
      .eq("post_id", post_id);

    if (error) throw error;

    return new Response(
      JSON.stringify({ message: "Success", status: new_status }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

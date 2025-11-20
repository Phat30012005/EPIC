// supabase/functions/create-conversation/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req, context) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // Auth
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
      return new Response(JSON.stringify({ error: e.message }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { target_user_id } = await req.json();
    if (!target_user_id) throw new Error("Missing target_user_id");
    if (currentUserId === target_user_id)
      throw new Error("Cannot chat with yourself");

    // Sắp xếp ID để đảm bảo tính duy nhất (A-B giống B-A)
    const user1 =
      currentUserId < target_user_id ? currentUserId : target_user_id;
    const user2 =
      currentUserId < target_user_id ? target_user_id : currentUserId;

    // 1. Kiểm tra đã có hội thoại chưa
    const { data: existing } = await supabase
      .from("conversations")
      .select("id")
      .eq("user1_id", user1)
      .eq("user2_id", user2)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ id: existing.id, isNew: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Nếu chưa -> Tạo mới
    const { data: newConv, error } = await supabase
      .from("conversations")
      .insert({ user1_id: user1, user2_id: user2 })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ id: newConv.id, isNew: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

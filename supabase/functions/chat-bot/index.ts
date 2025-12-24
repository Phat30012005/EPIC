// supabase/functions/chat-bot/index.ts
// VERSION: V2.1 - RULE BASED ENGINE

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BOT_SCRIPT } from "./script.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError  !user) throw new Error("Unauthorized");

    const { step_id } = await req.json();
    // Mặc định là 'start' nếu không có step_id
    const currentStepId = step_id 
 "start";

    const stepData = BOT_SCRIPT[currentStepId];

    if (!stepData) {
      throw new Error(Step not found: ${currentStepId});
    }

    // Lưu tin nhắn Bot vào DB
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      content: stepData.message,
      is_bot: true,
    });

    return new Response(
      JSON.stringify({
        success: true,
        reply: stepData.message,
        options: stepData.options
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (err: any) {
    console.error("Bot Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
// supabase/functions/chat-bot/index.ts
// VERSION V12 — ONE FILE BUILD (PRODUCTION READY)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

//
// ---------------------------------------------------------
// 1. CORS CONFIG
// ---------------------------------------------------------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

//
// ---------------------------------------------------------
// 2. UTILS
// ---------------------------------------------------------

// Safe JSON cleaner
function safeJson(txt = "") {
  try {
    txt = txt.replace(/```[\s\S]*?```/g, "").trim();
    const match = txt.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const cleaned = match[0].replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");

    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// Remove SQL wildcard injection
function sanitizeKeyword(kw: string | null) {
  if (!kw) return null;
  return kw.replace(/[%_]/g, "").trim();
}

// Fetch with timeout + retry (production-grade)
async function safeFetch(url, options: any = {}, retries = 2, timeout = 9000) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (err) {
      if (i === retries) throw err;
      await new Promise((r) => setTimeout(r, 300 * (i + 1))); // retry backoff
    }
  }
}

//
// ---------------------------------------------------------
// 3. GEMINI WRAPPERS
// ---------------------------------------------------------

// Native Gemini call with optional JSON schema
async function callGemini(apiKey: string, prompt: string, schema: any = null) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  };

  // Bật JSON mode nếu có schema
  if (schema) {
    body.generationConfig = {
      responseMimeType: "application/json",
      responseSchema: schema,
    };
  }

  const data = await safeFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// Extract Intent reliably (100% JSON guaranteed)
async function parseIntent(apiKey: string, message: string) {
  const schema = {
    type: "object",
    properties: {
      max_price: { type: ["integer", "null"] },
      keyword: { type: ["string", "null"] },
    },
    required: ["max_price", "keyword"],
  };

  const prompt = `
  Extract info from Vietnamese query:
  {
    "max_price": integer in VND (convert all forms: "3tr", "3 triệu"),
    "keyword": string or null (location name)
  }
  
  Input: "${message}"
  Return JSON ONLY.
  `;

  const raw = await callGemini(apiKey, prompt, schema);
  return safeJson(raw) || { max_price: null, keyword: null };
}

// Generate final chat reply
async function generateReply(
  apiKey: string,
  userMessage: string,
  context: string,
  listText: string,
  isSuggest: boolean
) {
  const prompt = `
  Bạn là Gà Bông 🐣 — trợ lý tìm phòng trọ.
  Giọng dễ thương, trả lời tối đa 3 câu.

  User hỏi: "${userMessage}"
  ${isSuggest ? "⚠ Không tìm đúng → gợi ý phòng mới nhất." : ""}

  ${context}
  ${listText}

  Không mô tả quy trình. Không nói dài dòng. Trả lời tự nhiên.
  `;

  return (
    (await callGemini(apiKey, prompt)) ||
    "Gà Bông đang hơi lag, bạn hỏi lại nha 🐣"
  );
}

//
// ---------------------------------------------------------
// 4. MAIN HANDLER
// ---------------------------------------------------------

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")?.trim();
    if (!GEMINI_API_KEY) throw new Error("Missing GEMINI_API_KEY");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized");

    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) throw new Error("Auth failed");

    const { message } = await req.json();

    //
    // STEP 1 — AI INTENT PARSING
    //
    const intent = await parseIntent(GEMINI_API_KEY, message);
    intent.keyword = sanitizeKeyword(intent.keyword);
    console.log("Intent:", intent);

    //
    // STEP 2 — DATABASE SEARCH VIA RPC
    //
    const { data: posts } = await supabase.rpc("match_posts_advanced", {
      p_keyword: intent.keyword,
      p_max_price: intent.max_price,
      p_limit: 5,
    });

    let finalPosts = posts || [];
    let context = "";
    let isSuggest = false;

    // No match → fallback
    if (finalPosts.length === 0) {
      const { data: newest } = await supabase
        .from("posts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(3);

      finalPosts = newest || [];
      isSuggest = true;
      context = `Không tìm thấy phòng khớp yêu cầu. Đây là vài phòng mới nhất để bạn tham khảo:`;
    } else {
      context = `Gà Bông tìm được ${finalPosts.length} phòng hợp với yêu cầu nè 🐣:`;
    }

    //
    // STEP 3 — BUILD ROOM LIST TEXT
    //
    const listText = finalPosts
      .map(
        (p: any, i: number) =>
          `${i + 1}. ${p.motelName || p.title} — ${
            p.price?.toLocaleString("vi-VN") || "?"
          }đ — ${p.ward}`
      )
      .join("\n");

    //
    // STEP 4 — GENERATE FINAL BOT REPLY
    //
    const botReply = await generateReply(
      GEMINI_API_KEY,
      message,
      context,
      listText,
      isSuggest
    );

    //
    // STEP 5 — LOG TO DB
    //
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      content: botReply,
      is_bot: true,
    });

    //
    // STEP 6 — RETURN
    //
    return new Response(JSON.stringify({ success: true, reply: botReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("ChatBot Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

// supabase/functions/chat-bot/index.ts
// VERSION V18 - HARDCORE LOGIC (KHÔNG PHỤ THUỘC AI ĐỂ LỌC)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 1. BỘ TỪ ĐIỂN ĐỊA DANH CẦN THƠ (HARDCODED)
// Tự động nhận diện địa điểm mà không cần AI đoán
const LOCATION_MAP: Record<string, string> = {
  "ninh kiều": "Ninh Kiều",
  "ninh kieu": "Ninh Kiều",
  "cái răng": "Cái Răng",
  "cai rang": "Cái Răng",
  "bình thủy": "Bình Thủy",
  "binh thuy": "Bình Thủy",
  "ô môn": "Ô Môn",
  "o mon": "Ô Môn",
  "phong điền": "Phong Điền",
  "phong dien": "Phong Điền",
  "thốt nốt": "Thốt Nốt",
  "thot not": "Thốt Nốt",
  "cờ đỏ": "Cờ Đỏ",
  "co do": "Cờ Đỏ",
  "thới lai": "Thới Lai",
  "thoi lai": "Thới Lai",
  "vĩnh thạnh": "Vĩnh Thạnh",
  "vinh thanh": "Vĩnh Thạnh",
  "xuân khánh": "Xuân Khánh",
  "hưng lợi": "Hưng Lợi",
  "an bình": "An Bình",
  đhct: "Đại học Cần Thơ",
  dhct: "Đại học Cần Thơ",
  ctu: "Đại học Cần Thơ",
  fpt: "FPT",
  "nam cần thơ": "Nam Cần Thơ",
  dhnct: "Nam Cần Thơ",
  "3/2": "3/2",
  "30/4": "30/4",
  "mậu thân": "Mậu Thân",
  "nguyễn văn cừ": "Nguyễn Văn Cừ",
};

// 2. HÀM TRÍCH XUẤT GIÁ & ĐỊA ĐIỂM (LOGIC CỨNG)
function extractCriteria(message: string) {
  const lowerMsg = message.toLowerCase();

  let price = null;
  let keyword = null;

  // --- A. Bắt giá tiền bằng Regex (Chính xác tuyệt đối) ---
  // Hỗ trợ: "3 triệu", "3tr", "3 tr", "3000k", "3.5 triệu"
  const priceRegex = /(\d+([.,]\d+)?)\s*(triệu|tr|m|củ|k|nghìn)/;
  const match = lowerMsg.match(priceRegex);

  if (match) {
    let num = parseFloat(match[1].replace(",", "."));
    const unit = match[3]; // triệu, tr, k...

    if (["triệu", "tr", "m", "củ"].includes(unit)) {
      price = num * 1000000;
    } else if (["k", "nghìn"].includes(unit)) {
      price = num * 1000;
    }
  }

  // --- B. Bắt địa điểm bằng Từ điển (Không lo từ rác) ---
  for (const [key, value] of Object.entries(LOCATION_MAP)) {
    if (lowerMsg.includes(key)) {
      keyword = value;
      break; // Lấy địa điểm đầu tiên tìm thấy
    }
  }

  return { max_price: price, keyword: keyword };
}

// 3. HÀM GỌI GEMINI (CHỈ ĐỂ CHÉM GIÓ CUỐI CÙNG)
async function callGeminiText(apiKey: string, prompt: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      }),
    });
    const json = await res.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

// 4. MAIN HANDLER
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth Check
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) throw new Error("Unauthorized");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (!user) throw new Error("Auth failed");

    const { message } = await req.json();

    // === BƯỚC 1: PHÂN TÍCH BẰNG CODE (KHÔNG DÙNG AI) ===
    const intent = extractCriteria(message);
    console.log("⚙️ Hard Logic Intent:", intent);

    // === BƯỚC 2: TÌM KIẾM (QUERY TRỰC TIẾP) ===
    // Dùng query builder thay vì RPC để tránh lỗi migration chưa chạy
    let query = supabase
      .from("posts")
      .select("title, motelName, price, ward, address_detail")
      .eq("status", "APPROVED")
      .order("created_at", { ascending: false });

    // Áp dụng bộ lọc
    if (intent.max_price) {
      query = query.lte("price", intent.max_price);
    }

    if (intent.keyword) {
      // Nếu bắt được địa điểm, tìm trong ward và address
      const kw = intent.keyword;
      query = query.or(`ward.ilike.%${kw}%,address_detail.ilike.%${kw}%`);
    }

    // Giới hạn
    query = query.limit(5);

    const { data: searchResults, error } = await query;
    if (error) console.error("DB Error:", error);

    // === BƯỚC 3: XỬ LÝ KẾT QUẢ & FALLBACK ===
    let posts = searchResults || [];
    let sysNote = "";

    // Nếu không tìm thấy, lấy tin mới nhất
    if (posts.length === 0) {
      const { data: newest } = await supabase
        .from("posts")
        .select("title, motelName, price, ward, address_detail")
        .eq("status", "APPROVED")
        .order("created_at", { ascending: false })
        .limit(3);
      posts = newest || [];
      sysNote = `Không tìm thấy phòng khớp yêu cầu (Giá < ${intent.max_price}, KV: ${intent.keyword}). Đã lấy 3 phòng mới nhất. Hãy xin lỗi khách.`;
    } else {
      sysNote = `Tìm thấy ${posts.length} phòng khớp yêu cầu.`;
    }

    // === BƯỚC 4: SINH CÂU TRẢ LỜI ===
    const listText = posts
      .map(
        (p, i) =>
          `${i + 1}. ${
            p.motelName || "Trọ"
          } - ${p.price?.toLocaleString()}đ - ${p.ward}`
      )
      .join("\n");

    const replyPrompt = `
      Bạn là Gà Bông 🐣.
      User: "${message}"
      Note: "${sysNote}"
      List:
      ${listText}
      
      Yêu cầu: Trả lời ngắn gọn, vui vẻ. Dựa vào Note để phản hồi.
    `;

    // Chỉ dùng AI ở bước cuối này để tạo lời thoại
    const botReply =
      (await callGeminiText(GEMINI_API_KEY, replyPrompt)) ||
      "Gà Bông tìm được mấy phòng này nè 🐣:\n" + listText;

    // Log
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      content: botReply,
      is_bot: true,
    });

    return new Response(JSON.stringify({ success: true, reply: botReply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

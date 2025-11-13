// supabase/functions/create-roommate-posting/index.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

Deno.serve(async (req, context) => {
  // 1. Xử lý CORS
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  // 2. Block try...catch chính
  try {
    let userId: string;

    // --- BƯỚC A: Block Xác thực CHUẨN (Copy từ các function khác) ---
    try {
      if (context && context.auth) {
        const {
          data: { user },
          error: authError,
        } = await context.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("User not found (from context)");
        userId = user.id;
      } else {
        userId = await getUserIdFromToken(req);
      }
    } catch (authError) {
      console.error("Authentication error:", authError.message);
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (!userId) {
      throw new Error("User not authenticated");
    }

    // --- BƯỚC B: Logic Cốt Lõi ---
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // KIỂM TRA DOMINO: Đảm bảo chỉ RENTER mới được đăng (giống add-review)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single();

    if (profileError) {
      throw new Error(`Profile check failed: ${profileError.message}`);
    }
    if (profile.role !== "RENTER") {
      throw new Error("Only RENTERs can create roommate postings.");
    }

    // Lấy dữ liệu JSON từ frontend gửi lên
    const {
      title,
      description,
      posting_type, // 'OFFERING' hoặc 'SEEKING'
      ward,
      price,
      gender_preference,
    } = await req.json();

    // Validate dữ liệu cơ bản
    if (!title || !posting_type || !ward || !price) {
      throw new Error(
        "Missing required fields: title, posting_type, ward, or price."
      );
    }

    const newPosting = {
      user_id: userId,
      title: title,
      description: description,
      posting_type: posting_type,
      ward: ward,
      price: Number(price),
      gender_preference: gender_preference,
      status: "OPEN", // Mặc định là 'OPEN'
    };

    // Chèn vào CSDL
    const { data, error } = await supabaseAdmin
      .from("roommate_postings")
      .insert(newPosting)
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Trả về thành công
    return new Response(JSON.stringify({ data: data }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });

    // --- BƯỚC C: Block catch ngoài ---
  } catch (error) {
    console.error("Error in create-roommate-posting function:", error);
    let status = 500;
    if (error.message.includes("not authenticated")) status = 401;
    if (error.message.includes("Only RENTERs")) status = 403;
    if (error.message.includes("Missing required fields")) status = 400;

    return new Response(JSON.stringify({ error: error.message }), {
      status: status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});

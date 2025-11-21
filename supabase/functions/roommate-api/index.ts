// supabase/functions/roommate-api/index.ts
// (PHIÊN BẢN BẢO MẬT V3: THÊM GIỚI HẠN MAX VALUE)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const createErrorResponse = (
  message: string,
  status: number,
  originalError?: any
) => {
  if (originalError) {
    console.error(`[roommate-api Error ${status}]:`, originalError);
  }
  const clientMessage =
    status >= 500 ? "Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau." : message;
  return new Response(JSON.stringify({ error: clientMessage }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

const createSuccessResponse = (data: any) => {
  return new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
};

Deno.serve(async (req, context) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const url = new URL(req.url);

    // === 1. GET ===
    if (req.method === "GET") {
      const id = url.searchParams.get("id");

      if (id) {
        if (
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id
          )
        ) {
          return createErrorResponse("ID không hợp lệ.", 400);
        }
        const { data, error } = await supabase
          .from("roommate_postings")
          .select(
            `*, profiles:user_id (full_name, phone_number, email, avatar_url)`
          )
          .eq("posting_id", id)
          .single();

        if (error)
          return createErrorResponse("Không tìm thấy tin.", 404, error);
        return createSuccessResponse(data);
      }

      const filters = {
        ward: url.searchParams.get("ward"),
        posting_type: url.searchParams.get("posting_type"),
        gender_preference: url.searchParams.get("gender_preference"),
        price: url.searchParams.get("price"),
        status: url.searchParams.get("status"),
        page: url.searchParams.get("page"),
        limit: url.searchParams.get("limit"),
        user_id: url.searchParams.get("user_id"),
      };

      let query = supabase
        .from("roommate_postings")
        .select(`*, user_id, profiles:user_id (full_name, avatar_url)`, {
          count: "exact",
        });

      if (filters.status) query = query.eq("status", filters.status);
      else query = query.eq("status", "APPROVED");

      if (filters.user_id) query = query.eq("user_id", filters.user_id);
      if (filters.ward) query = query.ilike("ward", `%${filters.ward}%`);
      if (filters.posting_type)
        query = query.eq("posting_type", filters.posting_type);

      if (
        filters.gender_preference &&
        filters.gender_preference !== "Không yêu cầu"
      ) {
        query = query.eq("gender_preference", filters.gender_preference);
      }

      if (filters.price) {
        if (filters.price === "tren3") query = query.gte("price", 3000000);
        else {
          const parts = filters.price.split("-").map(Number);
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
            query = query
              .gte("price", parts[0] * 1000000)
              .lte("price", parts[1] * 1000000);
        }
      }

      query = query.order("created_at", { ascending: false });
      let page = Math.max(1, parseInt(filters.page || "1"));
      let limit = Math.min(50, Math.max(1, parseInt(filters.limit || "12")));

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return createSuccessResponse({
        data: data,
        pagination: {
          page,
          limit,
          total_records: count || 0,
          total_pages: count ? Math.ceil(count / limit) : 0,
        },
      });
    }

    // === 2. POST ===
    if (req.method === "POST") {
      let userId: string;
      try {
        if (context && context.auth) {
          const {
            data: { user },
          } = await context.auth.getUser();
          userId = user?.id || "";
        } else {
          userId = await getUserIdFromToken(req);
        }
      } catch (e: any) {
        return createErrorResponse("Auth failed", 401, e);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (profile?.role !== "RENTER")
        return createErrorResponse(
          "Chỉ Người Thuê (RENTER) mới được đăng tin này.",
          403
        );

      let body;
      try {
        body = await req.json();
      } catch (e) {
        return createErrorResponse("JSON không hợp lệ.", 400, e);
      }

      if (!body.title || !body.ward || !body.price || !body.posting_type) {
        return createErrorResponse("Thiếu thông tin bắt buộc.", 400);
      }

      if (body.title.length < 5 || body.title.length > 150)
        return createErrorResponse("Tiêu đề 5-150 ký tự.", 400);

      const price = Number(body.price);

      // --- [SỬA LỖI QUAN TRỌNG] THÊM GIỚI HẠN MAX ---
      if (isNaN(price) || price <= 0)
        return createErrorResponse("Giá không hợp lệ.", 400);
      if (price > 50000000)
        return createErrorResponse(
          "Giá ở ghép quá cao (Max 50 triệu/người).",
          400
        ); // Max 50 triệu
      // ---------------------------------------------

      const newPosting = {
        user_id: userId,
        title: body.title.trim(),
        description: (body.description || "").trim(),
        posting_type: body.posting_type,
        ward: body.ward,
        price: price,
        gender_preference: body.gender_preference || "Không yêu cầu",
        status: "PENDING",
      };

      const { data, error } = await supabase
        .from("roommate_postings")
        .insert(newPosting)
        .select()
        .single();
      if (error) return createErrorResponse("Lỗi Database.", 500, error);
      return createSuccessResponse(data);
    }

    // === 3. PATCH ===
    if (req.method === "PATCH") {
      let userId: string;
      try {
        if (context && context.auth) {
          const {
            data: { user },
          } = await context.auth.getUser();
          userId = user?.id || "";
        } else {
          userId = await getUserIdFromToken(req);
        }
      } catch (e: any) {
        return createErrorResponse("Auth failed", 401, e);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (profile?.role !== "ADMIN")
        return createErrorResponse("Forbidden", 403);

      const { id, status } = await req.json();
      if (!id || !status) return createErrorResponse("Missing id/status", 400);

      const { data, error } = await supabase
        .from("roommate_postings")
        .update({ status })
        .eq("posting_id", id)
        .select()
        .single();
      if (error) return createErrorResponse("Update failed", 500, error);
      return createSuccessResponse(data);
    }

    // === 4. DELETE ===
    if (req.method === "DELETE") {
      let userId: string;
      try {
        if (context && context.auth) {
          const {
            data: { user },
          } = await context.auth.getUser();
          userId = user?.id || "";
        } else {
          userId = await getUserIdFromToken(req);
        }
      } catch (e: any) {
        return createErrorResponse("Auth failed", 401, e);
      }

      const postingId = url.searchParams.get("id");
      if (!postingId) return createErrorResponse("Missing id", 400);

      const { data: post, error: pError } = await supabase
        .from("roommate_postings")
        .select("user_id")
        .eq("posting_id", postingId)
        .single();
      if (pError || !post) return createErrorResponse("Post not found", 404);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      const isOwner = post.user_id === userId;
      const isAdmin = profile?.role === "ADMIN";

      if (!isOwner && !isAdmin) return createErrorResponse("Forbidden", 403);

      const { error: dError } = await supabase
        .from("roommate_postings")
        .delete()
        .eq("posting_id", postingId);
      if (dError) return createErrorResponse("Delete failed", 500, dError);
      return createSuccessResponse({ id: postingId, status: "deleted" });
    }

    return createErrorResponse("Method Not Allowed", 405);
  } catch (err: any) {
    return createErrorResponse("Server Error", 500, err);
  }
});

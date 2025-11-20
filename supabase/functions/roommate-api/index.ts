// supabase/functions/roommate-api/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const createErrorResponse = (message: string, status: number) => {
  return new Response(JSON.stringify({ error: message }), {
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
    return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const url = new URL(req.url);

    // ============================================================
    // 1. GET (Danh sách HOẶC Chi tiết)
    // ============================================================
    if (req.method === "GET") {
      const id = url.searchParams.get("id");

      // A. CHI TIẾT
      if (id) {
        const { data, error } = await supabase
          .from("roommate_postings")
          .select(
            `*, profiles:user_id (full_name, phone_number, email, avatar_url)`
          )
          .eq("posting_id", id)
          .single();

        if (error) return createErrorResponse(error.message, 404);
        return createSuccessResponse(data);
      }

      // B. DANH SÁCH
      const filters = {
        ward: url.searchParams.get("ward"),
        posting_type: url.searchParams.get("posting_type"),
        gender_preference: url.searchParams.get("gender_preference"),
        price: url.searchParams.get("price"),
        status: url.searchParams.get("status"), // Cho Admin lọc
        page: url.searchParams.get("page"),
        limit: url.searchParams.get("limit"),
      };

      let query = supabase
        .from("roommate_postings")
        .select(`*, profiles:user_id (full_name, avatar_url)`, {
          count: "exact",
        });

      // Logic Status (Mặc định chỉ lấy APPROVED nếu không phải Admin lọc)
      if (filters.status) {
        query = query.eq("status", filters.status);
      } else {
        query = query.eq("status", "APPROVED");
      }

      // Các bộ lọc khác
      if (filters.ward) query = query.ilike("ward", `%${filters.ward}%`);
      if (filters.posting_type)
        query = query.eq("posting_type", filters.posting_type);

      if (
        filters.gender_preference &&
        filters.gender_preference !== "Không yêu cầu"
      ) {
        // Nếu FE gửi "Nam" hoặc "Nữ" thì lọc chính xác
        query = query.eq("gender_preference", filters.gender_preference);
      }

      if (filters.price) {
        if (filters.price === "tren3") query = query.gte("price", 3000000);
        else {
          const parts = filters.price.split("-").map(Number);
          if (parts.length === 2)
            query = query
              .gte("price", parts[0] * 1000000)
              .lte("price", parts[1] * 1000000);
        }
      }

      // Phân trang
      query = query.order("created_at", { ascending: false });
      const page = filters.page ? parseInt(filters.page) : 1;
      const limit = filters.limit ? parseInt(filters.limit) : 12;
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
          total_records: count,
          total_pages: count ? Math.ceil(count / limit) : 0,
        },
      });
    }

    // ============================================================
    // 2. POST (Đăng tin mới)
    // ============================================================
    if (req.method === "POST") {
      // Auth
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
        return createErrorResponse("Auth failed", 401);
      }

      // Role Check
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (profile?.role !== "RENTER")
        return createErrorResponse("Only RENTERs can post here", 403);

      const body = await req.json();
      // Validate cơ bản
      if (!body.title || !body.ward || !body.price || !body.posting_type) {
        return createErrorResponse("Missing required fields", 400);
      }

      const newPosting = {
        user_id: userId,
        title: body.title,
        description: body.description,
        posting_type: body.posting_type,
        ward: body.ward,
        price: Number(body.price),
        gender_preference: body.gender_preference,
        status: "PENDING", // Mặc định chờ duyệt
      };

      const { data, error } = await supabase
        .from("roommate_postings")
        .insert(newPosting)
        .select()
        .single();
      if (error) return createErrorResponse(error.message, 500);

      return createSuccessResponse(data);
    }

    // ============================================================
    // 3. PATCH (Duyệt tin - Admin)
    // ============================================================
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
        return createErrorResponse("Auth failed", 401);
      }

      // Check Admin
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (profile?.role !== "ADMIN")
        return createErrorResponse("Forbidden", 403);

      const { id, status } = await req.json();
      if (!id || !status)
        return createErrorResponse("Missing id or status", 400);

      const { data, error } = await supabase
        .from("roommate_postings")
        .update({ status: status })
        .eq("posting_id", id)
        .select()
        .single();

      if (error) return createErrorResponse(error.message, 500);
      return createSuccessResponse(data);
    }

    // ============================================================
    // 4. DELETE (Xóa tin)
    // ============================================================
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
        return createErrorResponse("Auth failed", 401);
      }

      const postingId = url.searchParams.get("id");
      if (!postingId) return createErrorResponse("Missing id", 400);

      // Check Owner or Admin
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
      if (dError) return createErrorResponse(dError.message, 500);

      return createSuccessResponse({ id: postingId, status: "deleted" });
    }

    return createErrorResponse("Method Not Allowed", 405);
  } catch (err: any) {
    return createErrorResponse("Server Error: " + err.message, 500);
  }
});

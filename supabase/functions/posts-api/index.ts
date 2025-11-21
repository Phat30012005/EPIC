// supabase/functions/posts-api/index.ts
// (PHIÊN BẢN BẢO MẬT V2: FULL)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getUserIdFromToken } from "../_shared/auth-helper.ts";

const BUCKET_NAME = "post-images";

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
    console.error(`[posts-api Error ${status}]:`, originalError);
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
      try {
        if (id) {
          // Validate UUID
          if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              id
            )
          ) {
            return createErrorResponse("ID bài đăng không hợp lệ.", 400);
          }
          const { data, error } = await supabase
            .from("posts")
            .select(
              `*, profiles:user_id (full_name, phone_number, email, avatar_url)`
            )
            .eq("post_id", id)
            .single();
          if (error)
            return createErrorResponse("Không tìm thấy bài đăng.", 404, error);
          return createSuccessResponse(data);
        }

        const filters = {
          ward: url.searchParams.get("ward"),
          type: url.searchParams.get("type"),
          price: url.searchParams.get("price"),
          size: url.searchParams.get("size"),
          page: url.searchParams.get("page"),
          limit: url.searchParams.get("limit"),
          status: url.searchParams.get("status"),
          user_id: url.searchParams.get("user_id"),
        };

        let query = supabase
          .from("posts")
          .select(
            `id:post_id, post_id, user_id, title, motelName, price, area, image_urls, address_detail, ward, room_type, created_at, status, reviews:reviews(rating), profiles:user_id ( full_name, avatar_url )`,
            { count: "exact" }
          );

        if (filters.status) query = query.eq("status", filters.status);
        else query = query.eq("status", "APPROVED");

        if (filters.user_id) query = query.eq("user_id", filters.user_id);
        if (filters.ward) query = query.ilike("ward", `%${filters.ward}%`);
        if (
          filters.type &&
          filters.type !== "undefined" &&
          filters.type.trim() !== ""
        ) {
          query = query.ilike("room_type", filters.type.trim());
        }

        if (filters.price) {
          if (filters.price === "tren6") query = query.gte("price", 6000000);
          else {
            const parts = filters.price.split("-").map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
              query = query
                .gte("price", parts[0] * 1000000)
                .lte("price", parts[1] * 1000000);
          }
        }
        if (filters.size) {
          if (filters.size === "tren35") query = query.gte("area", 35);
          else {
            const parts = filters.size.split("-").map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]))
              query = query.gte("area", parts[0]).lte("area", parts[1]);
          }
        }

        query = query.order("created_at", { ascending: false });
        let page = parseInt(filters.page || "1");
        let limit = parseInt(filters.limit || "12");
        if (isNaN(page) || page < 1) page = 1;
        if (isNaN(limit) || limit < 1 || limit > 50) limit = 12;

        const from = (page - 1) * limit;
        const to = from + limit - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;
        if (error) throw error;

        const postsWithAvgRating = data?.map((post: any) => {
          let totalRating = 0;
          const reviewsCount = Array.isArray(post.reviews)
            ? post.reviews.length
            : 0;
          if (reviewsCount > 0) {
            post.reviews.forEach((r: any) => (totalRating += r.rating));
            post.average_rating = (totalRating / reviewsCount).toFixed(1);
          } else {
            post.average_rating = "N/A";
          }
          delete post.reviews;
          return post;
        });

        return createSuccessResponse({
          data: postsWithAvgRating,
          pagination: {
            page,
            limit,
            total_records: count || 0,
            total_pages: count ? Math.ceil(count / limit) : 0,
          },
        });
      } catch (err) {
        return createErrorResponse("Lỗi khi tải dữ liệu.", 500, err);
      }
    }

    // === 2. POST ===
    if (req.method === "POST") {
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
      } catch (e: any) {
        return createErrorResponse("Bạn cần đăng nhập.", 401, e);
      }

      let formData;
      try {
        formData = await req.formData();
      } catch (e) {
        return createErrorResponse("Dữ liệu không hợp lệ.", 400, e);
      }

      const title = formData.get("title") as string;
      const priceStr = formData.get("price");
      const areaStr = formData.get("area");
      const roomsStr = formData.get("rooms");
      const motelName = formData.get("motelName") as string;
      const ward = formData.get("ward") as string;

      if (!title || title.trim().length < 5 || title.length > 100)
        return createErrorResponse("Tiêu đề 5-100 ký tự.", 400);
      if (!motelName || !motelName.trim())
        return createErrorResponse("Thiếu tên trọ.", 400);

      const price = Number(priceStr);
      const area = Number(areaStr);
      const rooms = Number(roomsStr);
      if (isNaN(price) || price <= 0)
        return createErrorResponse("Giá sai.", 400);
      if (isNaN(area) || area <= 0)
        return createErrorResponse("Diện tích sai.", 400);

      const images = formData.getAll("images") as File[];
      if (images.length > 10) return createErrorResponse("Tối đa 10 ảnh.", 400);

      const publicImageUrls: string[] = [];
      const publicSupabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

      for (const image of images) {
        if (image.size > 5 * 1024 * 1024)
          return createErrorResponse("Ảnh > 5MB.", 400);
        if (image.size > 0) {
          const timestamp = Date.now();
          const safeName = image.name.replace(/[^a-zA-Z0-9.]/g, "_");
          const imagePath = `public/${userId}/${timestamp}-${safeName}`;
          const { error: upErr } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(imagePath, image, { upsert: false });
          if (!upErr)
            publicImageUrls.push(
              `${publicSupabaseUrl}/storage/v1/object/public/${BUCKET_NAME}/${imagePath}`
            );
        }
      }

      const highlightsString = formData.get("highlights") as string;
      let highlightsArray: string[] = [];
      try {
        if (highlightsString) highlightsArray = JSON.parse(highlightsString);
      } catch {}

      const newPost = {
        user_id: userId,
        title: title.trim(),
        motelName: motelName.trim(),
        price,
        area,
        rooms: isNaN(rooms) ? 1 : rooms,
        ward,
        address_detail: (
          (formData.get("address_detail") as string) || ""
        ).trim(),
        description: ((formData.get("description") as string) || "").trim(),
        room_type: (formData.get("room_type") as string) || "Phòng đơn",
        highlights: highlightsArray,
        image_urls: publicImageUrls,
        status: "PENDING",
      };

      const { data, error } = await supabase
        .from("posts")
        .insert(newPost)
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
            error,
          } = await context.auth.getUser();
          if (error || !user) throw new Error("User not found");
          userId = user.id;
        } else {
          userId = await getUserIdFromToken(req);
        }
      } catch (e: any) {
        return createErrorResponse("Unauthorized", 401, e);
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (profile?.role !== "ADMIN")
        return createErrorResponse("Forbidden", 403);

      const { id, status } = await req.json();
      if (!id || !status) return createErrorResponse("Thiếu id/status", 400);

      const { data, error } = await supabase
        .from("posts")
        .update({ status })
        .eq("post_id", id)
        .select()
        .single();
      if (error) return createErrorResponse("Lỗi update.", 500, error);
      return createSuccessResponse(data);
    }

    // === 4. DELETE ===
    if (req.method === "DELETE") {
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
      } catch (e: any) {
        return createErrorResponse("Unauthorized", 401, e);
      }

      const postId = url.searchParams.get("id");
      if (!postId) return createErrorResponse("Thiếu ID.", 400);

      const { data: post } = await supabase
        .from("posts")
        .select("user_id, image_urls")
        .eq("post_id", postId)
        .single();
      if (!post) return createErrorResponse("Không tìm thấy bài.", 404);

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      if (post.user_id !== userId && profile?.role !== "ADMIN")
        return createErrorResponse("Forbidden", 403);

      if (post.image_urls?.length) {
        const files = post.image_urls
          .map((u: string) => {
            try {
              return new URL(u).pathname.split(`/${BUCKET_NAME}/`)[1] || null;
            } catch {
              return null;
            }
          })
          .filter((p: string | null) => p);
        if (files.length)
          await supabase.storage.from(BUCKET_NAME).remove(files as string[]);
      }
      const { error: dError } = await supabase
        .from("posts")
        .delete()
        .eq("post_id", postId);
      if (dError) return createErrorResponse("Lỗi xóa.", 500, dError);
      return createSuccessResponse({ id: postId, status: "deleted" });
    }

    return createErrorResponse("Method Not Allowed", 405);
  } catch (err: any) {
    return createErrorResponse("Lỗi Server.", 500, err);
  }
});

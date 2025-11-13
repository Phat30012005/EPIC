// supabase/functions/_shared/auth-helper.ts
import { decode } from "https://esm.sh/base64-arraybuffer";

/**
 * Lấy user ID từ AWT token (PHIÊN BẢN CHUẨN).
 * Đây là giải pháp dự phòng cho môi trường local dev khi chạy với --no-verify-jwt.
 * Nó sẽ THROW lỗi nếu token không hợp lệ, để block try...catch bên ngoài bắt.
 */
export async function getUserIdFromToken(req: Request): Promise<string> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    throw new Error("Missing Authorization Header");
  }

  const token = authHeader.replace("Bearer ", "");
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid token format");
  }

  // Dùng logic parse chuẩn (giống 7 function kia)
  const payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  if (!payload.sub) {
    throw new Error("Invalid token payload (missing sub)");
  }

  return payload.sub; // sub is the user ID (UUID)
}

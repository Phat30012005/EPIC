/**
 * Tệp: public/js/api-client.js
 * * Hàm này là "cầu nối" duy nhất giữa Frontend và Backend (Edge Functions)
 * Nó sẽ tự động đính kèm token xác thực của user vào mỗi yêu cầu.
 */

async function callEdgeFunction(
  functionName,
  { method = "POST", body = null } = {}
) {
  console.log(`Đang gọi Edge Function: ${functionName}`);

  // 1. Lấy session (chứa token) hiện tại của user
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Lỗi lấy session khi gọi function:", sessionError);
    return { data: null, error: sessionError };
  }

  if (!session) {
    console.error("Không tìm thấy session, user chưa đăng nhập?");
    return { data: null, error: new Error("Người dùng chưa đăng nhập.") };
  }

  // 2. Lấy URL đầy đủ của Function
  // (Trưởng nhóm (Phát) đã cài đặt supabase CLI,
  // lệnh "npx supabase functions serve" sẽ cung cấp URL này)
  //
  // LƯU Ý: Dòng này có thể cần thay đổi khi deploy,
  // nhưng khi chạy local (develop) nó sẽ hoạt động.
  const functionUrl = `${supabase.functions.url}/${functionName}`;

  // 3. Chuẩn bị các tùy chọn cho Fetch
  const options = {
    method: method,
    headers: {
      "Content-Type": "application/json",
      // Đây là phần quan trọng: Gửi token để xác thực
      Authorization: `Bearer ${session.access_token}`,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  // (Lưu ý: Logic này sẽ cần nâng cấp ở Ngày 3 để xử lý FormData (upload ảnh))

  try {
    // 4. Thực hiện lệnh gọi
    const response = await fetch(functionUrl, options);

    if (!response.ok) {
      // Nếu server trả về lỗi (như 400, 401, 500)
      const errorText = await response.text();
      console.error(`Lỗi từ Function ${functionName}:`, errorText);
      throw new Error(errorText || `Lỗi ${response.status}`);
    }

    // 5. Trả về dữ liệu
    const data = await response.json();
    return { data: data, error: null };
  } catch (error) {
    console.error(`Lỗi khi fetch Edge Function ${functionName}:`, error);
    return { data: null, error: error };
  }
}

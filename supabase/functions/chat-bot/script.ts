// supabase/functions/chat-bot/script.ts

export interface BotStep {
  id: string; // Mã định danh bước
  message: string; // Lời thoại của Bot
  options: {
    // Các lựa chọn cho User
    label: string; // Chữ hiển thị trên nút
    next_step: string; // Mã bước tiếp theo khi chọn nút này
    action?: string; // (Tuỳ chọn) Nếu cần gọi API đặc biệt (vd: reset password)
  }[];
}

// BỘ KỊCH BẢN (Sửa nội dung ở đây thoải mái)
export const BOT_SCRIPT: Record<string, BotStep> = {
  // 1. Mở đầu
  start: {
    id: "start",
    message:
      "Chào bạn! Mình là Gà Bông 🐣. Mình có thể giúp gì cho bạn về CHICKY.STU ?",
    options: [
      { label: "Hướng dẫn Đăng tin 📝", next_step: "guide_post" },
      { label: "Cách tìm phòng trọ 🔍", next_step: "guide_search" },
      { label: "Quản lý tài khoản 👤", next_step: "account_help" },
      { label: "Liên hệ Admin 📞", next_step: "contact_admin" },
    ],
  },

  // 2. Nhánh Hướng dẫn đăng tin
  guide_post: {
    id: "guide_post",
    message:
      "Để đăng tin, bạn cần Đăng ký tài khoản Lessor (Người cho thuê). Sau đó vào mục 'Đăng tin' trên menu. Phí đăng tin hiện tại là MIỄN PHÍ.",
    options: [
      { label: "Xem quy định duyệt tin", next_step: "post_rules" },
      { label: "Quay lại menu chính", next_step: "start" },
    ],
  },
  post_rules: {
    id: "post_rules",
    message:
      "Tin đăng cần có hình ảnh thật, giá chính xác và địa chỉ cụ thể. Tin sẽ được duyệt trong vòng 24h ⏳.",
    options: [
      { label: "Đã hiểu, cảm ơn!", next_step: "end_conversation" },
      { label: "Quay lại", next_step: "guide_post" },
    ],
  },

  // 3. Nhánh Tìm phòng
  guide_search: {
    id: "guide_search",
    message:
      "Bạn có thể dùng thanh tìm kiếm để lọc theo Khu vực (Ninh Kiều, Cái Răng...) hoặc theo Giá tiền. Ngoài ra còn có tính năng Tìm ở ghép nữa đó!",
    options: [
      { label: "Tìm ở ghép là sao?", next_step: "guide_roommate" },
      { label: "Quay lại menu chính", next_step: "start" },
    ],
  },
  guide_roommate: {
    id: "guide_roommate",
    message:
      "Tính năng 'Tìm ở ghép' giúp bạn đăng hồ sơ tìm người cùng thuê phòng để chia sẻ chi phí. Rất phù hợp cho sinh viên!",
    options: [
      { label: "Cảm ơn Gà Bông ^^", next_step: "end_conversation" },
      { label: "Quay lại", next_step: "guide_search" },
    ],
  },

  // 4. Nhánh Tài khoản
  account_help: {
    id: "account_help",
    message: "Về tài khoản, bạn đang gặp vấn đề gì?",
    options: [
      { label: "Quên mật khẩu 🔑", next_step: "forgot_pass" },
      { label: "Cập nhật thông tin", next_step: "update_info" },
      { label: "Quay lại", next_step: "start" },
    ],
  },
  forgot_pass: {
    id: "forgot_pass",
    message:
      "Bạn hãy bấm vào nút 'Đăng nhập', sau đó chọn dòng chữ 'Quên mật khẩu' nhỏ ở dưới cùng để nhận email khôi phục nhé.",
    options: [
      { label: "Cảm ơn Gà Bông", next_step: "end_conversation" },
      { label: "Quay lại", next_step: "account_help" },
    ],
  },
  update_info: {
    id: "update_info",
    message:
      "Bạn vào trang 'Cá nhân' (Avatar góc phải), chọn 'Chỉnh sửa hồ sơ' để đổi tên, sđt hoặc ảnh đại diện.",
    options: [
      { label: "Đã rõ", next_step: "end_conversation" },
      { label: "Quay lại", next_step: "account_help" },
    ],
  },

  // 5. Liên hệ & Kết thúc
  contact_admin: {
    id: "contact_admin",
    message:
      "Nếu gặp lỗi nghiêm trọng, hãy gửi email trực tiếp cho đội kỹ thuật qua: chickiesstudio@gmail.com 📧",
    options: [{ label: "Quay lại menu chính", next_step: "start" }],
  },
  end_conversation: {
    id: "end_conversation",
    message: "Rất vui được hỗ trợ bạn! Chúc bạn một ngày tốt lành 🐣.",
    options: [{ label: "Bắt đầu lại", next_step: "start" }],
  },
};

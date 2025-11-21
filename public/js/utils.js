/* =======================================
   --- FILE: public/js/utils.js ---
   (PHIÊN BẢN UPDATE - CHỨA CONSTANTS)
   ======================================= */

const Utils = {
  // --- DỮ LIỆU DÙNG CHUNG (CONSTANTS) ---
  WARDS: [
    "An Cư (Ninh Kiều)",
    "An Hòa (Ninh Kiều)",
    "An Khánh (Ninh Kiều)",
    "An Lạc (Ninh Kiều)",
    "An Nghiệp (Ninh Kiều)",
    "An Phú (Ninh Kiều)",
    "Cái Khế (Ninh Kiều)",
    "Hưng Lợi (Ninh Kiều)",
    "Tân An (Ninh Kiều)",
    "Thới Bình (Ninh Kiều)",
    "Xuân Khánh (Ninh Kiều)",
    "An Thới (Bình Thủy)",
    "Bình Thủy (Bình Thủy)",
    "Bùi Hữu Nghĩa (Bình Thủy)",
    "Long Hòa (Bình Thủy)",
    "Long Tuyền (Bình Thủy)",
    "Phú Thứ (Cái Răng)",
    "Hưng Phú (Cái Răng)",
    "Hưng Thạnh (Cái Răng)",
    "Lê Bình (Cái Răng)",
    "Thường Thạnh (Cái Răng)",
    "Tân Phú (Cái Răng)",
    "Ba Láng (Cái Răng)",
    "Thốt Nốt (Thốt Nốt)",
    "Thới Thuận (Thốt Nốt)",
    "Trung Kiên (Thốt Nốt)",
    "Thuận An (Thốt Nốt)",
    "Thạnh An (Thốt Nốt)",
    "Trà Nóc (Ô Môn)",
    "Phước Thới (Ô Môn)",
    "Thới An (Ô Môn)",
    "Thới Long (Ô Môn)",
    "Long Hưng (Ô Môn)",
    "Đông Thuận (Ô Môn)",
    "Tân Hưng (Ô Môn)",
    "Trung Hưng (Cờ Đỏ)",
    "Đông Thắng (Cờ Đỏ)",
    "Thạnh Phú (Cờ Đỏ)",
    "Thới Hưng (Cờ Đỏ)",
    "Thới Xuân (Cờ Đỏ)",
    "Thới Lai (Thới Lai)",
    "Xuân Thắng (Thới Lai)",
    "Tân Thạnh (Thới Lai)",
    "Định Môn (Thới Lai)",
    "Trường Lạc (Thới Lai)",
    "Trường Thành (Thới Lai)",
    "Phong Điền (Phong Điền)",
    "Giai Xuân (Phong Điền)",
    "Mỹ Khánh (Phong Điền)",
    "Nhơn Ái (Phong Điền)",
    "Nhơn Nghĩa (Phong Điền)",
  ],

  // --- CÁC HÀM TIỆN ÍCH CŨ ---

  formatCurrency: (amount) => {
    if (!amount && amount !== 0) return "0";
    return Number(amount).toLocaleString("vi-VN");
  },

  formatCurrencyShort: (amount) => {
    if (!amount && amount !== 0) return "0";
    if (amount >= 1000000) {
      return (amount / 1000000).toFixed(1).replace(/\.0$/, "") + " triệu";
    }
    return Utils.formatCurrency(amount) + " đ";
  },

  formatDate: (dateString) => {
    if (!dateString) return "Không rõ";
    const date = new Date(dateString);
    return isNaN(date.getTime())
      ? "Không rõ"
      : date.toLocaleDateString("vi-VN");
  },

  renderStars: (rating, size = "1rem") => {
    let starsHtml = "";
    for (let i = 1; i <= 5; i++) {
      const color = i <= rating ? "#f59e0b" : "#d1d5db";
      starsHtml += `<span style="color: ${color}; font-size: ${size}; margin-right: 2px;">★</span>`;
    }
    return starsHtml;
  },

  getParam: (paramName) => {
    const params = new URLSearchParams(window.location.search);
    return params.get(paramName);
  },

  setText: (elementId, text) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.textContent = text;
    } else {
      console.warn(`[Utils] Không tìm thấy element: ${elementId}`);
    }
  },

  getOptimizedImage: (url, width = 400) => {
    if (!url) return "/assets/logo1.png";
    if (url.includes("/storage/v1/object/public/")) {
      let newUrl = url.replace(
        "/storage/v1/object/public/",
        "/storage/v1/render/image/public/"
      );
      return `${newUrl}?width=${width}&resize=cover&quality=80`;
    }
    return url;
  },
};

console.log("✅ Utils loaded with Constants");

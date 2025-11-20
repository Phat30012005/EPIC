/* =======================================
   --- FILE: js/oghep-dangtin.js ---
   (Clone từ dangtin.js, đã sửa để đăng tin Ở GHÉP)
   ======================================= */

// -----------------------------------------------------------------
// ⚠️ QUAN TRỌNG:
// HÃY MỞ FILE `public/js/dangtin.js` GỐC CỦA BẠN
// VÀ COPY MẢNG 'CAN_THO_WARDS' ĐẦY ĐỦ DÁN VÀO ĐÂY
// -----------------------------------------------------------------
const CAN_THO_WARDS = [
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
  "Phong Điền (Phong Điền)",
  "Giai Xuân (Phong Điền)",
  "Mỹ Khánh (Phong Điền)",
  "Nhơn Ái (Phong Điền)",
  "Nhơn Nghĩa (Phong Điền)",
  "Trường Thành (Thới Lai)",
];
// -----------------------------------------------------------------

/**
 * Thiết lập logic chính cho trang Đăng Tin Ở Ghép
 */
function setupDangTinPage() {
  const postForm = document.getElementById("postForm");
  // (XÓA) imageInput và imagePreviewContainer
  const wardHiddenInput = document.getElementById("ward-hidden");
  const customSelectTrigger = document.getElementById("ward-custom-select");
  const customDropdown = document.getElementById("ward-dropdown");

  if (
    !postForm ||
    !wardHiddenInput ||
    !customSelectTrigger ||
    !customDropdown
  ) {
    console.error(
      "Lỗi: Không tìm thấy các thành phần DOM quan trọng (form, ward select...) trong oghep-dangtin.html."
    );
    return;
  }

  // --- PHẦN LOGIC UI (GIỮ NGUYÊN TỪ dangtin.js) ---

  // 1. Load Wards vào Dropdown
  CAN_THO_WARDS.forEach((ward) => {
    const li = document.createElement("li");
    li.textContent = ward;
    li.setAttribute("data-value", ward);
    customDropdown.appendChild(li);
    li.addEventListener("click", () => {
      wardHiddenInput.value = ward;
      customSelectTrigger.textContent = ward;
      customDropdown.classList.add("hidden");
    });
  });

  // 2. Mở/đóng Dropdown
  customSelectTrigger.addEventListener("click", () =>
    customDropdown.classList.toggle("hidden")
  );

  // 3. Đóng khi click ra ngoài
  document.addEventListener("click", (e) => {
    if (
      !customSelectTrigger.contains(e.target) &&
      !customDropdown.contains(e.target)
    ) {
      customDropdown.classList.add("hidden");
    }
  });

  // 4. (XÓA) Logic xem trước ảnh

  // --- KẾT THÚC LOGIC UI ---

  // 5. Gán sự kiện submit (Trỏ đến hàm 'submitPost' đã REFACTOR)
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitButton = postForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "ĐANG XỬ LÝ...";

    // Gọi hàm submit mới (không cần truyền ward vì hàm sẽ tự lấy)
    await submitPost();

    submitButton.disabled = false;
    submitButton.textContent = "ĐĂNG TIN";
  });
}

/**
 * Xử lý logic submit (ĐÃ CẬP NHẬT DÙNG roommate-api)
 */
async function submitPost() {
  // 1. Thu thập và kiểm tra dữ liệu
  const postingTypeInput = document.querySelector(
    'input[name="posting_type"]:checked'
  );
  const wardValue = document.getElementById("ward-hidden").value;
  const priceValue = document.getElementById("price").value;

  // Kiểm tra các trường bắt buộc
  if (!postingTypeInput) {
    showAlert("Vui lòng chọn bạn 'Cần người' hay 'Tìm phòng'.");
    return;
  }
  if (!wardValue) {
    showAlert("Vui lòng chọn Phường/Xã.");
    return;
  }
  if (!priceValue || Number(priceValue) <= 0) {
    showAlert("Vui lòng nhập giá mong muốn hợp lệ.");
    return;
  }

  // 2. Tạo đối tượng JSON body
  const body = {
    title: document.getElementById("title").value,
    price: Number(priceValue),
    ward: wardValue,
    address_detail: document.getElementById("address").value,
    description: document.getElementById("description").value,
    posting_type: postingTypeInput.value,
    gender_preference: document.getElementById("gender_preference").value,
  };

  console.log("Đang gọi roommate-api (POST)...", body);

  // 3. GỌI API MỚI: roommate-api
  const { data, error } = await callEdgeFunction("roommate-api", {
    method: "POST",
    body: body,
  });

  // 4. Xử lý kết quả
  if (error) {
    console.error("Lỗi đăng tin:", error);
    if (error.message.includes("not authenticated")) {
      showAlert("Bạn cần đăng nhập để đăng tin!");
      window.location.href = "/public/login.html";
    } else if (error.message.includes("Only RENTERs")) {
      showAlert("Lỗi: Chỉ có Người Thuê (RENTER) mới được đăng tin này.");
    } else {
      showAlert("Lỗi đăng tin: " + error.message);
    }
  } else {
    console.log("Đăng tin thành công:", data);
    // Thông báo rõ ràng về quy trình duyệt
    showAlert(
      "Đăng tin thành công! Tin của bạn đang chờ Admin duyệt trước khi hiển thị."
    );
    setTimeout(() => {
      window.location.href = "/public/oghep-danhsach.html";
    }, 2000);
  }
}

// Gọi hàm setup khi DOM đã tải
document.addEventListener("DOMContentLoaded", setupDangTinPage);

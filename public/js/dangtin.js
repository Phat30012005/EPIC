/* =======================================
   --- FILE: js/dangtin.js ---
   (ĐÃ REFACTOR ĐỂ GỌI EDGE FUNCTION 'create-post' - VAI TÂM)
   ======================================= */

// Dữ liệu Phường/Xã Cần Thơ (Giữ nguyên)
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

/**
 * Thiết lập logic chính cho trang Đăng Tin
 */
function setupDangTinPage() {
  const postForm = document.getElementById("postForm");
  const imageInput = document.getElementById("images");
  const imagePreviewContainer = document.getElementById("image-preview");
  const wardHiddenInput = document.getElementById("ward-hidden");
  const customSelectTrigger = document.getElementById("ward-custom-select");
  const customDropdown = document.getElementById("ward-dropdown");

  if (
    !postForm ||
    !imageInput ||
    !imagePreviewContainer ||
    !wardHiddenInput ||
    !customSelectTrigger ||
    !customDropdown
  ) {
    console.warn(
      "Một số thành phần DOM của trang dangtin.html không tìm thấy."
    );
    return;
  }

  // --- PHẦN LOGIC UI (GIỮ NGUYÊN) ---
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
  // 4. Xem trước ảnh
  imageInput.addEventListener("change", () => {
    imagePreviewContainer.innerHTML = ""; // Xóa các ảnh cũ
    if (imageInput.files.length > 10) {
      alert("Bạn chỉ được đăng tối đa 10 ảnh.");
      imageInput.value = "";
      return;
    }
    for (const file of imageInput.files) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB
        alert(`File ${file.name} quá lớn (tối đa 5MB).`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = document.createElement("img");
        img.src = e.target.result;
        img.className = "w-24 h-24 object-cover rounded-md shadow-md";
        imagePreviewContainer.appendChild(img);
      };
      reader.readAsDataURL(file);
    }
  });
  // --- KẾT THÚC LOGIC UI ---

  // 5. Gán sự kiện submit (Trỏ đến hàm 'submitPost' đã REFACTOR)
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitButton = postForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "ĐANG XỬ LÝ...";

    // Gọi hàm submit mới, truyền giá trị ward vào
    await submitPost(wardHiddenInput.value);

    submitButton.disabled = false;
    submitButton.textContent = "ĐĂNG TIN";
  });
}

/**
 * Xử lý logic submit (ĐÃ REFACTOR ĐỂ GỌI EDGE FUNCTION)
 */
async function submitPost(selectedWardValue) {
  // 1. Lấy file ảnh
  const imageInput = document.getElementById("images");
  if (imageInput.files.length === 0) {
    showAlert("Vui lòng chọn ít nhất một ảnh.");
    return;
  }
  if (imageInput.files.length > 10) {
    showAlert("Bạn chỉ được đăng tối đa 10 ảnh.");
    return;
  }
  const files = Array.from(imageInput.files);

  // 2. Thu thập dữ liệu và BẮT ĐẦU TẠO FORMDATA
  // FormData cho phép chúng ta gửi cả text và file
  const formData = new FormData();

  // 3. Thêm TẤT CẢ các trường text vào FormData
  formData.append("title", document.getElementById("title").value);
  formData.append("motelName", document.getElementById("motelName").value);
  formData.append("price", document.getElementById("price").value);
  formData.append("area", document.getElementById("area").value);
  formData.append("rooms", document.getElementById("rooms").value);
  const roomTypeVal = document.getElementById("roomType").value;
  formData.append("room_type", roomTypeVal);
  formData.append("ward", selectedWardValue); // Giá trị từ dropdown
  formData.append("address_detail", document.getElementById("address").value);
  formData.append("description", document.getElementById("description").value);

  // 4. Xử lý trường 'highlights' (mảng)
  // Backend 'create-post' mong đợi một chuỗi JSON
  const highlights = Array.from(
    document.querySelectorAll('input[name="highlight"]:checked')
  ).map((el) => el.value);

  // RẤT QUAN TRỌNG: Chuyển mảng thành chuỗi JSON
  formData.append("highlights", JSON.stringify(highlights));

  // 5. Thêm TẤT CẢ file ảnh vào FormData
  // Dùng .append() lặp lại với CÙNG MỘT TÊN 'images'
  files.forEach((file) => {
    formData.append("images", file); // Tên 'images' phải khớp với backend
  });

  console.log("Đã tạo FormData. Chuẩn bị gọi Edge Function 'create-post'...");

  // 6. GỌI EDGE FUNCTION (đã xóa toàn bộ logic supabase cũ)
  const { data, error } = await callEdgeFunction("posts-api", {
    // Đổi tên function
    method: "POST",
    body: formData,
  });
  // 7. Xử lý kết quả
  if (error) {
    console.error("Lỗi khi gọi create-post:", error);

    // KIỂM TRA LỖI QUAN TRỌNG: Lỗi chưa đăng nhập
    if (error.name === "AuthError") {
      // (Lỗi này do 'api-client.js' trả về)
      showAlert("Bạn cần đăng nhập để đăng tin!");
      window.location.href = "/login.html";
    } else {
      // Các lỗi khác (từ backend 500, 400...)
      showAlert("Lỗi đăng tin: " + error.message);
    }
  } else {
    // 'data' ở đây là { id: ..., title: ... } do function trả về
    console.log("Đăng tin thành công:", data);
    showAlert("Đăng tin thành công!");
    window.location.href = "/danhsach.html";
  }
}

// Gọi hàm setup khi DOM đã tải
document.addEventListener("DOMContentLoaded", setupDangTinPage);

/* =======================================
   --- FILE: js/dangtin.js ---
   (Logic xử lý Form Đăng tin)
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
 * Thiết lập logic chính cho trang Đăng Tin, bao gồm Select Phường/Xã và Image Preview.
 * (Phần này giữ nguyên)
 */
window.setupDangTinPage = function () {
  const postForm = document.getElementById("postForm");
  const imageInput = document.getElementById("images");
  const imagePreviewContainer = document.getElementById("image-preview"); // =========================================== // LOGIC: SELECT BOX TÙY CHỈNH CHO PHƯỜNG/XÃ // ===========================================

  const wardHiddenInput = document.getElementById("ward-hidden");
  const customSelectTrigger = document.getElementById("ward-custom-select");
  const customDropdown = document.getElementById("ward-dropdown"); // Kiểm tra xem các phần tử có tồn tại không

  if (
    !postForm ||
    !imageInput ||
    !imagePreviewContainer ||
    !wardHiddenInput ||
    !customSelectTrigger ||
    !customDropdown
  ) {
    // console.error("Không tìm thấy một số phần tử thiết yếu của trang đăng tin.");
    return;
  } // 1. Load Wards vào Dropdown tùy chỉnh

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
  }); // 2. Xử lý mở/đóng Dropdown

  customSelectTrigger.addEventListener("click", () => {
    customDropdown.classList.toggle("hidden");
  }); // 3. Đóng khi click ra ngoài

  document.addEventListener("click", (e) => {
    if (
      !customSelectTrigger.contains(e.target) &&
      !customDropdown.contains(e.target)
    ) {
      customDropdown.classList.add("hidden");
    }
  }); // Handle image preview (Giữ nguyên)

  imageInput.addEventListener("change", () => {
    imagePreviewContainer.innerHTML = "";
    if (imageInput.files) {
      Array.from(imageInput.files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const img = document.createElement("img");
          img.src = e.target.result;
          img.className = "image-preview-item";
          imagePreviewContainer.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    }
  }); // Thêm event listener cho form submit

  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    await submitPost(wardHiddenInput.value);
  });
};

/**
 * Xử lý logic submit form, kiểm tra validation, và lưu dữ liệu.
 * (HÀM NÀY ĐÃ ĐƯỢC CẬP NHẬT THEO HƯỚNG DẪN)
 */
async function submitPost(selectedWardValue) {
  const form = document.getElementById("postForm");
  const allInputs = form.querySelectorAll("input, select, textarea");
  let isFormValid = true; // Kiểm tra các trường required (validation) - Giữ nguyên

  allInputs.forEach((input) => {
    if (input.id === "ward-hidden") return;

    if (input.hasAttribute("required") && !input.value) {
      isFormValid = false;
    }
  });

  if (!selectedWardValue) {
    isFormValid = false;
  }

  if (!isFormValid) {
    // Sử dụng hàm toàn cục showAlert từ main.js
    showAlert("Vui lòng điền đầy đủ thông tin bắt buộc.");
    return;
  } // ================================================ // --- BẮT ĐẦU LOGIC MỚI TỪ HÌNH ẢNH HƯỚNG DẪN --- // ================================================ // 1. Lấy file ảnh từ input

  const imageInput = document.getElementById("images");
  if (imageInput.files.length === 0) {
    alert("Vui lòng chọn một ảnh đại diện.");
    return; // Dừng lại nếu không có ảnh
  } // Hướng dẫn chỉ upload 1 file, nên ta lấy file đầu tiên
  const file = imageInput.files[0]; // 2. Tạo một đường dẫn (path) duy nhất cho ảnh // Ví dụ: public/1678886400000_ten-anh.jpg

  const filePath = `public/${Date.now()}_${file.name}`;

  console.log("Đang tải ảnh lên...", filePath); // 3. Gọi hàm upload của Supabase Storage // (Giả định 'supabase' client đã được khởi tạo ở file supabase-config.js)

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from("post-images") // Tên Bucket mà Team Lead đã tạo
    .upload(filePath, file);

  if (uploadError) {
    console.error("Lỗi upload ảnh:", uploadError);
    alert("Lỗi khi tải ảnh lên: " + uploadError.message);
    return;
  }

  console.log("Upload ảnh thành công:", uploadData); // 4. Lấy URL công khai (public URL) của ảnh

  const { data: urlData } = supabase.storage
    .from("post-images")
    .getPublicUrl(filePath);

  const publicImageUrl = urlData.publicUrl;
  console.log("URL của ảnh:", publicImageUrl); // --- TẠM DỪNG Ở ĐÂY
  // ... (code upload ảnh và lấy publicImageUrl từ Ngày 3) ...
  console.log("URL của ảnh:", publicImageUrl);

  // --- BẮT ĐẦU CODE MỚI NGÀY 4 ---

  // 5. Lấy thông tin user đang đăng nhập
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // Nếu vì lý do nào đó mà user chưa đăng nhập
    alert("Bạn phải đăng nhập trước khi đăng tin!");
    // Chuyển họ đến trang đăng nhập
    window.location.href = "login.html";
    return;
  }
  console.log("Đăng tin với tư cách user:", user.id);

  // 6. Thu thập TẤT CẢ dữ liệu từ form
  // (Đây là code cũ của bạn, nhưng đã được thêm các trường CSDL)
  const newPostData = {
    title: document.getElementById("title").value,
    motelName: document.getElementById("motelName").value,
    price: Number(document.getElementById("price").value), // Ép kiểu số
    area: Number(document.getElementById("area").value), // Ép kiểu số
    rooms: Number(document.getElementById("rooms").value), // Ép kiểu số
    ward: selectedWardValue, // Lấy từ tham số hàm
    address: document.getElementById("address").value,
    description: document.getElementById("description").value,
    highlights: Array.from(
      document.querySelectorAll('input[name="highlight"]:checked')
    ).map((el) => el.value),

    // --- Các trường MỚI để lưu vào CSDL ---
    room_type: document.getElementById("roomType").value, // Lấy từ bản vá lỗi
    image_url: publicImageUrl, // Lấy URL ảnh đã upload
    user_id: user.id, // Lấy ID người đăng
  };

  // 7. Gọi hàm 'insert' để lưu vào CSDL
  console.log("Đang lưu tin đăng vào CSDL:", newPostData);

  const { error: insertError } = await supabase
    .from("posts") // Tên bảng Team Lead đã tạo
    .insert([newPostData]);

  if (insertError) {
    console.error("Lỗi khi lưu tin đăng:", insertError);
    alert("Lỗi: " + insertError.message);
  } else {
    alert("Đăng tin thành công!");
    // Chuyển hướng về trang danh sách chung để thấy tin của mình
    window.location.href = "/public/danhsach.html";
  }
  // --- KẾT THÚC CODE MỚI NGÀY 4 ---

  // (Xóa toàn bộ code localStorage cũ nếu còn)
} // Dấu } đóng của hàm submitPost

// CHO NGÀY 3 (THEO HÌNH ẢNH) ---

/* // (Ở Ngày 4, chúng ta sẽ lấy user.id và kết hợp URL này để lưu vào CSDL) // (Toàn bộ code cũ bên dưới tạm thời BỎ QUA / VÔ HIỆU HÓA)
  // ================================================
  // --- CODE CŨ (ĐÃ VÔ HIỆU HÓA) ---
  // ================================================

  const imageFiles = imageInput.files;
  const base64Images = [];

  // Chuyển đổi ảnh sang Base64
  if (imageFiles.length > 0) {
    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      const base64 = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });
      base64Images.push(base64);
    }
  } else {
    base64Images.push(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAACoCAMAAABpL3g+AAAAA1BMVEW+v78nB7LFAAAAJUlEQVR4nO3BAQ0AAADCoPdPbQ8H/wwAAAAAAAAAAAAAAAB+gABBAAECBL8nJgAAAABJRU5ErkJggg=="
    );
  }

  // Thu thập dữ liệu
  const newPost = {
    // === SỬA LỖI: Thêm ID duy nhất cho bài đăng ===
    id: Date.now(), 
    title: document.getElementById("title").value,
    motelName: document.getElementById("motelName").value,
    price: document.getElementById("price").value,
    area: document.getElementById("area").value,
    rooms: document.getElementById("rooms").value,
    ward: selectedWardValue,
    address: document.getElementById("address").value,
    description: document.getElementById("description").value,
    contactName: document.getElementById("contactName").value,
    phone: document.getElementById("phone").value,
    email: document.getElementById("email").value,
    highlights: Array.from(
      document.querySelectorAll('input[name="highlight"]:checked')
    ).map((el) => el.value),
images: base64Images,
    date: new Date().toLocaleDateString("vi-VN"),
  };

  // Lưu và chuyển hướng
  const storedPosts = JSON.parse(localStorage.getItem("roomsData")) || [];
  storedPosts.push(newPost);
  localStorage.setItem("roomsData", JSON.stringify(storedPosts));

  showAlert("Tin đã được đăng thành công!");

  setTimeout(() => {
    // === SỬA LỖI: Chuyển hướng về đường dẫn tuyệt đối ===
    window.location.href = "/public/danhsach.html";
  }, 1500);

  */

// === THÊM MỚI: Gọi hàm setup khi DOM đã tải ===
// (Đảm bảo logic chạy ngay cả khi main.js không gọi)
if (document.readyState === "loading") {
  // giữ đoạn này có j thêm vào
  document.addEventListener("DOMContentLoaded", setupDangTinPage);
} else {
  setupDangTinPage();
}

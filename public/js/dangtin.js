// public/js/dangtin.js
// ĐÃ DỌN DẸP, CHỈ GIỮ LOGIC SUPABASE

// Dữ liệu Phường/Xã Cần Thơ
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

// Thiết lập Select Phường/Xã và Image Preview
function setupDangTinPage() {
    const postForm = document.getElementById("postForm");
    const imageInput = document.getElementById("images");
    const imagePreviewContainer = document.getElementById("image-preview");
    const wardHiddenInput = document.getElementById("ward-hidden");
    const customSelectTrigger = document.getElementById("ward-custom-select");
    const customDropdown = document.getElementById("ward-dropdown");

    if (!postForm || !imageInput || !imagePreviewContainer || !wardHiddenInput || !customSelectTrigger || !customDropdown) {
        return;
    }

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
    customSelectTrigger.addEventListener("click", () => customDropdown.classList.toggle("hidden"));

    // 3. Đóng khi click ra ngoài
    document.addEventListener("click", (e) => {
        if (!customSelectTrigger.contains(e.target) && !customDropdown.contains(e.target)) {
            customDropdown.classList.add("hidden");
        }
    });

    // 4. Xem trước ảnh (chỉ hiển thị ảnh đầu tiên)
    imageInput.addEventListener("change", () => {
        imagePreviewContainer.innerHTML = "";
        if (imageInput.files.length > 0) {
            const file = imageInput.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement("img");
                img.src = e.target.result;
                img.className = "image-preview-item"; // Giữ class cũ nếu css cần
                imagePreviewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });

    // 5. Gán sự kiện submit
    postForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitButton = postForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = "ĐANG XỬ LÝ...";
        
        await submitPost(wardHiddenInput.value);
        
        submitButton.disabled = false;
        submitButton.textContent = "ĐĂNG TIN";
    });
}

// Xử lý logic submit
async function submitPost(selectedWardValue) {
    // 1. Kiểm tra đăng nhập
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        alert("Bạn phải đăng nhập trước khi đăng tin!");
        window.location.href = "/public/login.html";
        return;
    }

    // 2. Lấy file ảnh
    const imageInput = document.getElementById("images");
    if (imageInput.files.length === 0) {
        alert("Vui lòng chọn một ảnh đại diện.");
        return;
    }
    const file = imageInput.files[0];
    const filePath = `public/${user.id}/${Date.now()}_${file.name}`;

    // 3. Tải ảnh lên Storage
    console.log("Đang tải ảnh lên...", filePath);
    const { data: uploadData, error: uploadError } = await supabase.storage
        .from("post-images") // Tên Bucket
        .upload(filePath, file);

    if (uploadError) {
        console.error("Lỗi upload ảnh:", uploadError);
        alert("Lỗi khi tải ảnh lên: " + uploadError.message);
        return;
    }
    console.log("Upload ảnh thành công:", uploadData);

    // 4. Lấy URL công khai
    const { data: urlData } = supabase.storage
        .from("post-images")
        .getPublicUrl(filePath);
    const publicImageUrl = urlData.publicUrl;
    console.log("URL của ảnh:", publicImageUrl);

    // 5. Thu thập dữ liệu form
    const newPostData = {
        title: document.getElementById("title").value,
        motelName: document.getElementById("motelName").value,
        price: Number(document.getElementById("price").value),
        area: Number(document.getElementById("area").value),
        rooms: Number(document.getElementById("rooms").value),
        ward: selectedWardValue,
        address: document.getElementById("address").value,
        description: document.getElementById("description").value,
        highlights: Array.from(document.querySelectorAll('input[name="highlight"]:checked')).map((el) => el.value),
        room_type: document.getElementById("roomType").value,
        image_url: publicImageUrl, // URL ảnh đã upload
        user_id: user.id, // ID người đăng
        
        // Lấy thông tin liên hệ từ form
        contactName: document.getElementById("contactName").value,
        phone: document.getElementById("phone").value,
        email: document.getElementById("email").value,
    };

    // 6. Lưu vào CSDL
    console.log("Đang lưu tin đăng vào CSDL:", newPostData);
    const { error: insertError } = await supabase
        .from("posts") // Tên bảng
        .insert([newPostData]);

    if (insertError) {
        console.error("Lỗi khi lưu tin đăng:", insertError);
        alert("Lỗi: " + insertError.message);
    } else {
        alert("Đăng tin thành công!");
        window.location.href = "/public/danhsach.html"; // Chuyển về trang danh sách
    }
}

// Gọi hàm setup khi DOM đã tải
document.addEventListener("DOMContentLoaded", setupDangTinPage);
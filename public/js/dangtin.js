/* =======================================
   --- FILE: js/dangtin.js ---
   (ĐÃ SỬA LỖI UPLOAD NHIỀU ẢNH)
   ======================================= */

// Dữ liệu Phường/Xã Cần Thơ (Giữ nguyên)
const CAN_THO_WARDS = [
  "An Cư (Ninh Kiều)", "An Hòa (Ninh Kiều)", "An Khánh (Ninh Kiều)",
  "An Lạc (Ninh Kiều)", "An Nghiệp (Ninh Kiều)", "An Phú (Ninh Kiều)",
  "Cái Khế (Ninh Kiều)", "Hưng Lợi (Ninh Kiều)", "Tân An (Ninh Kiều)",
  "Thới Bình (Ninh Kiều)", "Xuân Khánh (Ninh Kiều)", "An Thới (Bình Thủy)",
  "Bình Thủy (Bình Thủy)", "Bùi Hữu Nghĩa (Bình Thủy)", "Long Hòa (Bình Thủy)",
  "Long Tuyền (Bình Thủy)", "Phú Thứ (Cái Răng)", "Hưng Phú (Cái Răng)",
  "Hưng Thạnh (Cái Răng)", "Lê Bình (Cái Răng)", "Thường Thạnh (Cái Răng)",
  "Tân Phú (Cái Răng)", "Ba Láng (Cái Răng)", "Thốt Nốt (Thốt Nốt)",
  "Thới Thuận (Thốt Nốt)", "Trung Kiên (Thốt Nốt)", "Thuận An (Thốt Nốt)",
  "Thạnh An (Thốt Nốt)", "Trà Nóc (Ô Môn)", "Phước Thới (Ô Môn)",
  "Thới An (Ô Môn)", "Thới Long (Ô Môn)", "Long Hưng (Ô Môn)",
  "Đông Thuận (Ô Môn)", "Tân Hưng (Ô Môn)", "Trung Hưng (Cờ Đỏ)",
  "Đông Thắng (Cờ Đỏ)", "Thạnh Phú (Cờ Đỏ)", "Thới Hưng (Cờ Đỏ)",
  "Thới Xuân (Cờ Đỏ)", "Thới Lai (Thới Lai)", "Xuân Thắng (Thới Lai)",
  "Tân Thạnh (Thới Lai)", "Định Môn (Thới Lai)", "Trường Lạc (Thới Lai)",
  "Phong Điền (Phong Điền)", "Giai Xuân (Phong Điền)", "Mỹ Khánh (Phong Điền)",
  "Nhơn Ái (Phong Điền)", "Nhơn Nghĩa (Phong Điền)", "Trường Thành (Thới Lai)",
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

    if (!postForm || !imageInput || !imagePreviewContainer || !wardHiddenInput || !customSelectTrigger || !customDropdown) {
        return;
    }

    // 1. Load Wards vào Dropdown (Giữ nguyên)
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

    // 2. Mở/đóng Dropdown (Giữ nguyên)
    customSelectTrigger.addEventListener("click", () => customDropdown.classList.toggle("hidden"));

    // 3. Đóng khi click ra ngoài (Giữ nguyên)
    document.addEventListener("click", (e) => {
        if (!customSelectTrigger.contains(e.target) && !customDropdown.contains(e.target)) {
            customDropdown.classList.add("hidden");
        }
    });

    // 4. Xem trước ảnh (ĐÃ SỬA để hiển thị nhiều ảnh)
    imageInput.addEventListener("change", () => {
        imagePreviewContainer.innerHTML = ""; // Xóa các ảnh cũ

        if (imageInput.files.length > 10) {
            alert("Bạn chỉ được đăng tối đa 10 ảnh.");
            imageInput.value = ""; // Xóa file
            return;
        }

        for (const file of imageInput.files) {
            if (file.size > 5 * 1024 * 1024) { // 5MB
                alert(`File ${file.name} quá lớn (tối đa 5MB).`);
                continue; // Bỏ qua file này
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

    // 5. Gán sự kiện submit
    postForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const submitButton = postForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = "ĐANG XỬ LÝ...";
        
        await submitPost(wardHiddenInput.value); // Gọi hàm submit mới
        
        submitButton.disabled = false;
        submitButton.textContent = "ĐĂNG TIN";
    });
}

/**
 * Xử lý logic submit (ĐÃ SỬA ĐỂ UPLOAD NHIỀU ẢNH)
 */
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
        alert("Vui lòng chọn ít nhất một ảnh.");
        return;
    }
    if (imageInput.files.length > 10) {
        alert("Bạn chỉ được đăng tối đa 10 ảnh.");
        return;
    }

    const files = Array.from(imageInput.files); // Chuyển sang mảng
    
    console.log(`Bắt đầu tải lên ${files.length} ảnh...`);

    // 3. Tải TẤT CẢ ảnh lên Storage (dùng Promise.all để chạy song song)
    const uploadPromises = files.map(file => {
        if (file.size > 5 * 1024 * 1024) {
            console.warn(`Bỏ qua file ${file.name} vì quá lớn.`);
            return Promise.resolve(null); // Trả về null nếu file lỗi
        }
        const filePath = `public/${user.id}/${Date.now()}_${file.name}`;
        
        return supabase.storage
            .from("post-images") 
            .upload(filePath, file)
            .then(({ data: uploadData, error: uploadError }) => {
                if (uploadError) {
                    console.error("Lỗi upload ảnh:", uploadError);
                    return null; // Trả về null nếu upload lỗi
                }
                
                // 4. Lấy URL công khai
                const { data: urlData } = supabase.storage
                    .from("post-images")
                    .getPublicUrl(filePath);
                
                console.log("Upload thành công:", urlData.publicUrl);
                return urlData.publicUrl; // Trả về URL
            });
    });

    // Chờ tất cả các promise upload hoàn thành
    const settledUploads = await Promise.all(uploadPromises);
    // Lọc ra các URL thành công (bỏ qua các giá trị null)
    const successfulUrls = settledUploads.filter(url => url !== null);

    if (successfulUrls.length === 0) {
        alert("Không thể upload bất kỳ ảnh nào. Vui lòng thử lại.");
        return;
    }
     
    console.log("Tất cả các URL ảnh:", successfulUrls);

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
        
        // GÁN MẢNG URL VÀO CỘT 'image_url' (đã có kiểu text[])
        image_url: successfulUrls, 
        
        user_id: user.id, 
        contactName: document.getElementById("contactName").value,
        phone: document.getElementById("phone").value,
        email: document.getElementById("email").value,
    };

    // 6. Lưu vào CSDL
    console.log("Đang lưu tin đăng vào CSDL:", newPostData);
    const { error: insertError } = await supabase
        .from("posts") 
        .insert([newPostData]);

    if (insertError) {
        console.error("Lỗi khi lưu tin đăng:", insertError);
        alert("Lỗi: " + insertError.message);
    } else {
        alert("Đăng tin thành công!");
        window.location.href = "/public/danhsach.html"; 
    }
}

// Gọi hàm setup khi DOM đã tải
document.addEventListener("DOMContentLoaded", setupDangTinPage);
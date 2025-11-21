/* =======================================
   --- FILE: js/dangtin.js ---
   (REFACTORED: DÙNG Utils.WARDS)
   ======================================= */

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

  // --- PHẦN LOGIC UI (ĐÃ CẬP NHẬT) ---
  // 1. Load Wards từ Utils.WARDS (Không khai báo mảng thủ công nữa)
  if (Utils && Utils.WARDS) {
    Utils.WARDS.forEach((ward) => {
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
  } else {
    console.error("Lỗi: Utils.WARDS chưa được tải.");
  }

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
    imagePreviewContainer.innerHTML = "";
    if (imageInput.files.length > 10) {
      alert("Bạn chỉ được đăng tối đa 10 ảnh.");
      imageInput.value = "";
      return;
    }
    for (const file of imageInput.files) {
      if (file.size > 5 * 1024 * 1024) {
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

/**
 * Xử lý logic submit (Giữ nguyên logic gọi API)
 */
async function submitPost(selectedWardValue) {
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

  const formData = new FormData();
  formData.append("title", document.getElementById("title").value);
  formData.append("motelName", document.getElementById("motelName").value);
  formData.append("price", document.getElementById("price").value);
  formData.append("area", document.getElementById("area").value);
  formData.append("rooms", document.getElementById("rooms").value);
  const roomTypeVal = document.getElementById("roomType").value;
  formData.append("room_type", roomTypeVal);
  formData.append("ward", selectedWardValue);
  formData.append("address_detail", document.getElementById("address").value);
  formData.append("description", document.getElementById("description").value);

  const highlights = Array.from(
    document.querySelectorAll('input[name="highlight"]:checked')
  ).map((el) => el.value);
  formData.append("highlights", JSON.stringify(highlights));

  files.forEach((file) => {
    formData.append("images", file);
  });

  console.log("Đang gọi create-post...");

  const { data, error } = await callEdgeFunction("posts-api", {
    method: "POST",
    body: formData,
  });

  if (error) {
    console.error("Lỗi khi gọi create-post:", error);
    if (error.name === "AuthError") {
      showAlert("Bạn cần đăng nhập để đăng tin!");
      window.location.href = "/login.html";
    } else {
      showAlert("Lỗi đăng tin: " + error.message);
    }
  } else {
    console.log("Thành công:", data);
    showAlert("Đăng tin thành công!");
    window.location.href = "/danhsach.html";
  }
}

document.addEventListener("DOMContentLoaded", setupDangTinPage);

/* =======================================
   --- FILE: js/oghep-dangtin.js ---
   (REFACTORED: DÙNG Utils.WARDS)
   ======================================= */

function setupDangTinPage() {
  const postForm = document.getElementById("postForm");
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
      "Lỗi: Không tìm thấy các thành phần DOM quan trọng trong oghep-dangtin.html."
    );
    return;
  }

  // 1. Load Wards từ Utils.WARDS
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
    console.error("Utils.WARDS chưa được tải.");
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

  // 5. Gán sự kiện submit
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitButton = postForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = "ĐANG XỬ LÝ...";

    await submitPost();

    submitButton.disabled = false;
    submitButton.textContent = "ĐĂNG TIN";
  });
}

/**
 * Xử lý logic submit
 */
async function submitPost() {
  const postingTypeInput = document.querySelector(
    'input[name="posting_type"]:checked'
  );
  const wardValue = document.getElementById("ward-hidden").value;
  const priceValue = document.getElementById("price").value;

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

  const { data, error } = await callEdgeFunction("roommate-api", {
    method: "POST",
    body: body,
  });

  if (error) {
    console.error("Lỗi đăng tin:", error);
    if (error.message.includes("not authenticated")) {
      showAlert("Bạn cần đăng nhập để đăng tin!");
      window.location.href = "/login.html";
    } else if (error.message.includes("Only RENTERs")) {
      showAlert("Lỗi: Chỉ có Người Thuê (RENTER) mới được đăng tin này.");
    } else {
      showAlert("Lỗi đăng tin: " + error.message);
    }
  } else {
    console.log("Đăng tin thành công:", data);
    showAlert(
      "Đăng tin thành công! Tin của bạn đang chờ Admin duyệt trước khi hiển thị."
    );
    setTimeout(() => {
      window.location.href = "/oghep-danhsach.html";
    }, 2000);
  }
}

document.addEventListener("DOMContentLoaded", setupDangTinPage);

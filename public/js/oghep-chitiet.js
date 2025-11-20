/* =======================================
   --- FILE: /js/oghep-chitiet.js ---
   (PHIÊN BẢN V4 - TÍCH HỢP PUBLIC PROFILE LINK)
   ======================================= */

let currentPostId = null;

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Trang chi tiết (Ở Ghép) đã tải.");

  const postId = Utils.getParam("id");
  currentPostId = postId;

  if (!postId || postId === "undefined") {
    document.getElementById("post-detail-container").innerHTML =
      '<h2 class="text-center text-danger">Lỗi: Không tìm thấy ID bài đăng.</h2>';
    return;
  }

  try {
    await Promise.all([loadPostDetails(postId), loadSavedStatus(postId)]);
  } catch (error) {
    console.error("Lỗi tải trang:", error);
    Utils.setText("detail-page-title", "Lỗi tải trang");
  }
});

async function loadPostDetails(postId) {
  const { data: responseData, error } = await callEdgeFunction("roommate-api", {
    params: { id: postId },
    method: "GET",
  });

  if (error) {
    console.error("Lỗi tải chi tiết:", error);
    let errorMsg = error.message.includes("404")
      ? "Không tìm thấy tin đăng này."
      : error.message;
    document.getElementById(
      "post-detail-container"
    ).innerHTML = `<h2 class="text-center text-danger">Lỗi: ${errorMsg}</h2>`;
    return;
  }

  const post = responseData;
  if (!post) return;

  document.title = `${post.title || "Chi tiết"} | Chicky.stu`;

  Utils.setText("detail-title", post.title);
  Utils.setText("detail-page-title", "Chi tiết tin tìm ở ghép");

  Utils.setText(
    "detail-date",
    `Đăng ngày: ${Utils.formatDate(post.created_at)}`
  );
  Utils.setText(
    "detail-price",
    `${Utils.formatCurrency(post.price)} đ/người/tháng`
  );

  Utils.setText(
    "detail-posting-type",
    post.posting_type === "OFFERING" ? "Cần tìm người" : "Cần tìm phòng"
  );
  Utils.setText("detail-gender", post.gender_preference || "Không yêu cầu");
  Utils.setText("detail-ward", post.ward);
  Utils.setText("detail-address", post.address_detail || "Không có");

  const descriptionEl = document.getElementById("detail-description");
  if (descriptionEl)
    descriptionEl.textContent = post.description || "Không có mô tả.";

  if (post.profiles) {
    // --- TẠO LINK PROFILE ---
    const profileUrl = `/profile.html?user_id=${post.user_id}`;

    const contactNameEl = document.getElementById("detail-contact-name");
    if (contactNameEl) {
      contactNameEl.innerHTML = `<a href="${profileUrl}" class="text-primary hover:underline font-bold" target="_blank">${
        post.profiles.full_name || "Chưa cập nhật"
      }</a>`;
    }

    Utils.setText(
      "detail-phone",
      post.profiles.phone_number || "Chưa cập nhật"
    );
    Utils.setText("detail-email", post.profiles.email || "Chưa cập nhật");
  } else {
    Utils.setText("detail-contact-name", "Không rõ");
  }
}

// --- Nút Lưu Tin ---
async function loadSavedStatus(postId) {
  const saveBtn = document.getElementById("save-post-btn");
  if (!saveBtn) return;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    saveBtn.innerHTML = '<i class="far fa-heart mr-2"></i> Đăng nhập để lưu';
    saveBtn.classList.remove("active");
    saveBtn.onclick = () => (window.location.href = "/login.html");
    return;
  }

  const { data: responseData, error } = await callEdgeFunction(
    "get-user-roommate-bookmarks",
    { method: "GET" }
  );
  if (error) {
    console.error("Lỗi bookmarks:", error);
    return;
  }

  const bookmarks = responseData || [];
  const isSaved = bookmarks.some(
    (b) =>
      b.posting?.posting_id === postId ||
      b.roommate_postings?.posting_id === postId
  );

  updateSaveButtonUI(isSaved);
  setupSaveButton(postId, isSaved);
}

function updateSaveButtonUI(isSaved) {
  const saveBtn = document.getElementById("save-post-btn");
  if (!saveBtn) return;
  if (isSaved) {
    saveBtn.innerHTML = '<i class="fas fa-heart mr-2"></i> Đã lưu';
    saveBtn.classList.add("active");
  } else {
    saveBtn.innerHTML = '<i class="far fa-heart mr-2"></i> Lưu tin';
    saveBtn.classList.remove("active");
  }
  saveBtn.disabled = false;
}

function setupSaveButton(postId, isCurrentlySaved) {
  const saveBtn = document.getElementById("save-post-btn");
  if (!saveBtn) return;

  saveBtn.onclick = async () => {
    saveBtn.disabled = true;
    let isSaved = isCurrentlySaved;
    try {
      if (isSaved) {
        await callEdgeFunction("remove-roommate-bookmark", {
          method: "DELETE",
          params: { posting_id: postId },
        });
        isSaved = false;
      } else {
        await callEdgeFunction("add-roommate-bookmark", {
          method: "POST",
          body: { posting_id: postId },
        });
        isSaved = true;
      }
      isCurrentlySaved = isSaved;
      updateSaveButtonUI(isSaved);
    } catch (error) {
      alert(error.message);
    } finally {
      saveBtn.disabled = false;
    }
  };
}

/* =======================================
   --- FILE: public/js/admin.js ---
   (PHIÊN BẢN V2 - QUẢN LÝ DUYỆT TIN)
   ======================================= */

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("adminTableBody");
  if (!tableBody) return;

  // Hàm tải danh sách (Lấy TẤT CẢ trạng thái)
  async function loadAdminPosts() {
    tableBody.innerHTML =
      '<tr><td colspan="5" class="text-center">Đang tải dữ liệu...</td></tr>';

    // Gọi API với tham số status="ALL" (hoặc không truyền status để mặc định logic Admin lấy hết nếu backend hỗ trợ,
    // nhưng ở backend ta vừa sửa: nếu không có status -> lấy APPROVED.
    // Vậy Admin cần truyền status cụ thể hoặc ta sửa backend để Admin lấy hết.
    // Ở đây ta sẽ gọi lần lượt 3 loại status hoặc sửa Backend cho phép lấy ALL.
    // Cách đơn giản nhất: Gọi 3 lần và gộp lại hoặc dùng param status đặc biệt.

    // TUY NHIÊN: Để đơn giản và hiệu quả, ta sẽ gọi API lấy tin PENDING trước để xử lý.
    // Bạn có thể mở rộng để lấy hết sau.

    // SỬA LẠI CHIẾN THUẬT: Gọi API 3 lần để lấy Pending, Approved, Rejected rồi gộp lại
    // Hoặc tốt nhất: Admin chỉ cần quan tâm tin PENDING và APPROVED.

    const [pendingRes, approvedRes] = await Promise.all([
      callEdgeFunction("posts-api", {
        method: "GET",
        params: { status: "PENDING", limit: 50 },
      }),
      callEdgeFunction("posts-api", {
        method: "GET",
        params: { status: "APPROVED", limit: 50 },
      }),
    ]);

    let allPosts = [];
    if (pendingRes.data && pendingRes.data.data)
      allPosts = [...allPosts, ...pendingRes.data.data];
    if (approvedRes.data && approvedRes.data.data)
      allPosts = [...allPosts, ...approvedRes.data.data];

    if (allPosts.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="5" class="text-center">Chưa có tin đăng nào.</td></tr>';
      return;
    }

    renderTable(allPosts);
  }

  function renderTable(posts) {
    tableBody.innerHTML = "";

    // Sắp xếp: PENDING lên đầu
    posts.sort((a, b) => {
      if (a.status === "PENDING" && b.status !== "PENDING") return -1;
      if (a.status !== "PENDING" && b.status === "PENDING") return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    posts.forEach((post, index) => {
      const tr = document.createElement("tr");

      // Badge trạng thái
      let statusBadge = "";
      let actionButtons = "";

      if (post.status === "PENDING") {
        statusBadge =
          '<span class="badge bg-warning text-dark">Chờ duyệt</span>';
        actionButtons = `
            <button class="btn btn-success btn-sm approve-btn me-1" data-id="${post.id}">
                <i class="fa-solid fa-check"></i> Duyệt
            </button>
            <button class="btn btn-secondary btn-sm reject-btn me-1" data-id="${post.id}">
                <i class="fa-solid fa-xmark"></i> Từ chối
            </button>
          `;
      } else if (post.status === "APPROVED") {
        statusBadge = '<span class="badge bg-success">Đang hiển thị</span>';
        actionButtons = `
             <button class="btn btn-secondary btn-sm reject-btn me-1" data-id="${post.id}">
                <i class="fa-solid fa-ban"></i> Gỡ bài
             </button>
          `;
      } else {
        statusBadge = '<span class="badge bg-danger">Đã từ chối</span>';
      }

      // Nút Xóa (Luôn có)
      actionButtons += `
        <button class="btn btn-danger btn-sm delete-btn" data-id="${post.id}">
           <i class="fa-solid fa-trash"></i>
        </button>
      `;

      tr.innerHTML = `
          <td class="text-center">${index + 1}</td>
          <td>
              <a href="/public/chitiet.html?id=${
                post.id
              }" target="_blank" class="fw-bold text-decoration-none">
                  ${post.title}
              </a>
              <br><small class="text-muted">${post.price.toLocaleString()} đ</small>
          </td>
          <td class="text-center">${statusBadge}</td>
          <td class="text-center">
              <div class="d-flex justify-content-center">
                 ${actionButtons}
              </div>
          </td>
      `;
      tableBody.appendChild(tr);
    });

    addEventListeners();
  }

  function addEventListeners() {
    // 1. Nút DUYỆT
    document.querySelectorAll(".approve-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        updateStatus(btn.dataset.id, "APPROVED")
      );
    });

    // 2. Nút TỪ CHỐI / GỠ BÀI
    document.querySelectorAll(".reject-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        updateStatus(btn.dataset.id, "REJECTED")
      );
    });

    // 3. Nút XÓA VĨNH VIỄN
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const id = e.target.closest("button").dataset.id;
        showConfirm("Xóa vĩnh viễn bài này?", async () => {
          const { error } = await callEdgeFunction("posts-api", {
            method: "DELETE",
            params: { id },
          });
          if (!error) {
            alert("Đã xóa!");
            loadAdminPosts();
          } else {
            alert("Lỗi: " + error.message);
          }
        });
      });
    });
  }

  async function updateStatus(id, newStatus) {
    // Gọi method PATCH
    const { error } = await callEdgeFunction("posts-api", {
      method: "PATCH",
      body: { id: id, status: newStatus },
    });

    if (error) {
      alert("Lỗi cập nhật: " + error.message);
    } else {
      // alert("Thành công!"); // Không cần alert cho mượt
      loadAdminPosts(); // Tải lại bảng
    }
  }

  loadAdminPosts();
});

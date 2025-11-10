// public/js/admin.js
// === ĐÃ REFACTOR (VAI TRÒ NGA - NGÀY 4) ===

document.addEventListener("DOMContentLoaded", () => {
  const tableBody = document.getElementById("adminTableBody");
  if (!tableBody) {
    console.error("Không tìm thấy #adminTableBody");
    return;
  }

  /**
   * Hàm tải tất cả tin đăng
   */
  async function loadAdminPosts() {
    tableBody.innerHTML = '<tr><td colspan="5">Đang tải...</td></tr>';

    // 1. === REFACTOR: Gọi Edge Function "get-posts-list" ===
    // Thay thế cho 'supabase.from('posts').select('*')'
    // Chúng ta tái sử dụng function này, không cần filter
    const { data, error } = await callEdgeFunction("get-posts-list", {
      method: "GET",
    });
    // === KẾT THÚC REFACTOR ===

    if (error) {
      console.error("Lỗi tải admin posts:", error);
      tableBody.innerHTML = `<tr><td colspan="5" class="text-danger">Lỗi: ${error.message}</td></tr>`;
      return;
    }

    // data.data là mảng bài đăng
    const posts = data.data;

    if (!posts || posts.length === 0) {
      tableBody.innerHTML =
        '<tr><td colspan="5">Chưa có tin đăng nào.</td></tr>';
      return;
    }

    // 2. Vẽ lại bảng
    tableBody.innerHTML = "";
    posts.forEach((post, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
          <td class="text-center">${index + 1}</td>
          <td>
              <a href="/public/chitiet.html?id=${post.id}" target="_blank">
                  ${post.title}
              </a>
          </td>
          <td class="text-center">${post.price.toLocaleString()} đ</td>
          <td class="text-center"><span class="badge bg-success">Đang hiển thị</span></td>
          <td class="text-center">
              <button class="btn btn-danger btn-sm delete-btn" data-id="${
                post.id
              }">
                  Xóa
              </button>
          </td>
      `;
      tableBody.appendChild(tr);
    });

    // 3. Gán sự kiện click cho TẤT CẢ các nút Xóa
    addDeleteListeners();
  }

  /**
   * Hàm gán sự kiện Xóa
   */
  function addDeleteListeners() {
    const deleteButtons = document.querySelectorAll(".delete-btn");
    deleteButtons.forEach((button) => {
      button.addEventListener("click", async (e) => {
        const postId = e.target.dataset.id;

        // Dùng hàm confirm tùy chỉnh (từ main.js)
        showConfirm("Bạn có chắc chắn muốn xóa tin này không?", async () => {
          // === REFACTOR: Gọi Edge Function "delete-post" ===
          // Thay thế cho 'supabase.from('posts').delete()'
          const { data, error: deleteError } = await callEdgeFunction(
            "delete-post",
            {
              method: "DELETE",
              params: { id: postId },
            }
          );
          // === KẾT THÚC REFACTOR ===

          if (deleteError) {
            console.error("Lỗi khi xóa:", deleteError);
            alert("Lỗi: " + deleteError.message);
          } else {
            alert("Xóa tin thành công!");
            // Tải lại bảng
            loadAdminPosts();
          }
        });
      });
    });
  }

  // Chạy hàm lần đầu tiên khi trang tải
  loadAdminPosts();
});

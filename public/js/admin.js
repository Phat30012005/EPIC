// public/js/admin.js (CODE MỚI HOÀN TOÀN TỪ KẾ HOẠCH NGÀY 5)

document.addEventListener('DOMContentLoaded', () => {
    // 1. Lấy tbody của bảng từ admin.html
    const tableBody = document.getElementById('adminTableBody');

    // 2. Định nghĩa hàm tải tất cả tin đăng
    async function loadAdminPosts() {
        // Xóa bảng cũ để chuẩn bị tải dữ liệu mới
        tableBody.innerHTML = '<tr><td colspan="5">Đang tải...</td></tr>';

        // 3. Lấy TẤT CẢ tin đăng
        // .order() để sắp xếp tin mới nhất lên đầu
        const { data: posts, error } = await supabase
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Lỗi tải admin posts:', error);
            tableBody.innerHTML = `<tr><td colspan="5" class="text-danger">Lỗi: ${error.message}</td></tr>`;
            return;
        }

        if (posts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5">Chưa có tin đăng nào.</td></tr>';
            return;
        }

        // 4. Xóa bảng lần nữa và vẽ lại với dữ liệu thật
        tableBody.innerHTML = '';
        posts.forEach((post, index) => {
            const tr = document.createElement('tr');
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
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${post.id}">
                        Xóa
                    </button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // 5. Thêm sự kiện click cho TẤT CẢ các nút Xóa
        addDeleteListeners();
    }

    // 6. Định nghĩa hàm gán sự kiện Xóa
    function addDeleteListeners() {
        const deleteButtons = document.querySelectorAll('.delete-btn');
        deleteButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const postId = button.dataset.id;
                
                // Xác nhận trước khi xóa (Theo kế hoạch Ngày 5)
                if (confirm('Bạn có chắc chắn muốn xóa tin này không?')) {
                    // Gọi Supabase để xóa
                    const { error: deleteError } = await supabase
                        .from('posts')
                        .delete()
                        .eq('id', postId); // Xóa hàng có id khớp

                    if (deleteError) {
                        console.error('Lỗi khi xóa:', deleteError);
                        alert('Lỗi: ' + deleteError.message);
                    } else {
                        alert('Xóa tin thành công!');
                        loadAdminPosts(); // Tải lại bảng
                    }
                }
            });
        });
    }

    // 7. Chạy hàm lần đầu tiên khi trang tải
    loadAdminPosts();
});
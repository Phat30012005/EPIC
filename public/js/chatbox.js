/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN REALTIME - KẾT NỐI EDGE FUNCTION)
   ======================================= */

let chatSubscription = null;
let currentUser = null;

async function initializeChatbox() {
  const chatWidget = document.getElementById("chat-widget");
  if (!chatWidget) return;

  const toggleBtn = document.getElementById("chat-toggle");
  const chatBox = document.getElementById("chat-box");
  const closeBtn = document.getElementById("chat-close");
  const sendBtn = document.getElementById("send-btn");
  const chatInput = document.getElementById("chat-input");
  const chatBody = document.getElementById("chat-body");

  if (!toggleBtn || !chatBox || !closeBtn) return;

  // 1. Kiểm tra Auth
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user;

  // 2. Xử lý giao diện Login nếu chưa đăng nhập
  if (!currentUser) {
    chatBody.innerHTML = `
      <div class="text-center mt-10 px-4">
        <p class="text-gray-600 mb-3">Vui lòng đăng nhập để chat với hỗ trợ.</p>
        <a href="/login.html" class="btn btn-sm btn-primary">Đăng nhập ngay</a>
      </div>
    `;
    // Vô hiệu hóa input
    chatInput.disabled = true;
    sendBtn.disabled = true;
  } else {
    // Nếu đã đăng nhập -> Tải lịch sử & Kết nối Realtime
    await loadChatHistory();
    setupRealtimeSubscription();
  }

  // 3. Sự kiện UI
  toggleBtn.addEventListener("click", () => {
    chatBox.classList.toggle("hidden");
    if (!chatBox.classList.contains("hidden") && currentUser) {
      chatInput.focus();
      scrollToBottom();
    }
  });

  closeBtn.addEventListener("click", () => chatBox.classList.add("hidden"));

  // 4. Gửi tin nhắn
  const handleSend = async () => {
    const msg = chatInput.value.trim();
    if (!msg || !currentUser) return;

    // Xóa input ngay để trải nghiệm mượt (Optimistic UI)
    chatInput.value = "";

    // Hiển thị tin nhắn tạm thời (Client-side echo)
    // Thực tế Realtime sẽ trả về lại, nhưng hiện ngay cho mượt
    // (Lưu ý: Nếu muốn chính xác tuyệt đối thì đợi Realtime,
    // nhưng ở đây ta gọi API nên cứ hiện trước)

    // Gọi Edge Function
    try {
      const { error } = await callEdgeFunction("chat-bot", {
        method: "POST",
        body: { message: msg },
      });

      if (error) {
        console.error("Lỗi gửi tin:", error);
        appendMessage("Lỗi: Không gửi được tin nhắn.", "bot");
      }
    } catch (err) {
      console.error(err);
    }
  };

  sendBtn.addEventListener("click", handleSend);
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  });
}

// --- HÀM TẢI LỊCH SỬ ---
async function loadChatHistory() {
  const chatBody = document.getElementById("chat-body");
  chatBody.innerHTML =
    '<div class="text-center text-gray-400 mt-4 text-sm">Đang tải...</div>';

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  if (error) {
    chatBody.innerHTML =
      '<p class="text-red-500 text-center">Lỗi tải lịch sử.</p>';
    return;
  }

  chatBody.innerHTML = ""; // Xóa loading

  if (data.length === 0) {
    appendMessage(
      "Xin chào! Tôi là trợ lý ảo của Chicky.stu. Tôi có thể giúp gì cho bạn?",
      "bot"
    );
  } else {
    data.forEach((msg) => {
      appendMessage(msg.content, msg.is_bot ? "bot" : "user");
    });
  }
  scrollToBottom();
}

// --- HÀM REALTIME (NHẬN TIN MỚI) ---
function setupRealtimeSubscription() {
  if (chatSubscription) supabase.removeChannel(chatSubscription);

  chatSubscription = supabase
    .channel("public:chat_messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `user_id=eq.${currentUser.id}`,
      },
      (payload) => {
        console.log("Realtime message:", payload);
        const newMsg = payload.new;

        // Chỉ hiển thị nếu chưa có trên màn hình (Tránh duplicate do Optimistic UI nếu có)
        // Ở đây ta chỉ append, logic đơn giản nhất
        // Tuy nhiên để tránh user thấy tin mình gửi hiện 2 lần (1 lần do JS, 1 lần do Realtime)
        // Ta có thể kiểm tra hoặc đơn giản là ở hàm handleSend KHÔNG append manual nữa.
        // => SỬA LẠI CHIẾN LƯỢC: handleSend CHỈ GỌI API. Realtime sẽ lo việc hiển thị.

        appendMessage(newMsg.content, newMsg.is_bot ? "bot" : "user");
      }
    )
    .subscribe();
}

// --- HELPER: HIỂN THỊ TIN NHẮN ---
function appendMessage(text, sender) {
  const chatBody = document.getElementById("chat-body");

  // Kiểm tra xem tin nhắn cuối cùng có giống hệt tin vừa nhận không (trong khoảng thời gian ngắn)
  // Để chống duplicate đơn giản nếu cần (tùy chọn)

  const div = document.createElement("div");
  div.className = sender === "user" ? "user-message" : "bot-message";

  const p = document.createElement("p");

  // Bot được phép dùng HTML (để gửi link), User thì không (chống XSS)
  if (sender === "bot") {
    p.innerHTML = text;
  } else {
    p.textContent = text;
  }

  div.appendChild(p);
  chatBody.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const chatBody = document.getElementById("chat-body");
  chatBody.scrollTop = chatBody.scrollHeight;
}

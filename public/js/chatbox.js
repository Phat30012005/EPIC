/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN V6 - UI TỨC THÌ / KHẮC PHỤC LỖI TÀNG HÌNH)
   ======================================= */

let currentUser = null;

const SUGGESTED_QUESTIONS = [
  "Cách đăng tin cho thuê?",
  "Tìm phòng dưới 2 triệu",
  "Chính sách tìm người ở ghép?",
  "Khu vực nào gần ĐH Cần Thơ?",
];

async function initializeChatbox() {
  const chatWidget = document.getElementById("chat-widget");
  if (!chatWidget) return;

  const toggleBtn = document.getElementById("chat-toggle");
  const chatBox = document.getElementById("chat-box");
  const closeBtn = document.getElementById("chat-close");
  const sendBtn = document.getElementById("send-btn");
  const chatInput = document.getElementById("chat-input");
  const chatBody = document.getElementById("chat-body");

  // Tạo vùng gợi ý nếu chưa có
  let suggestionBox = document.getElementById("suggestion-box");
  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "suggestion-box";
    suggestionBox.className = "suggestion-container hidden";
    chatBox.insertBefore(suggestionBox, document.querySelector(".chat-footer"));
  }

  if (!toggleBtn || !chatBox || !closeBtn) return;

  // 1. Kiểm tra đăng nhập
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user;

  if (!currentUser) {
    chatBody.innerHTML = `
      <div class="text-center mt-10 px-4">
        <p class="text-gray-600 mb-3">Đăng nhập để chat với Gà Bông 🐣 nhé!</p>
        <a href="/login.html" class="btn btn-sm btn-primary">Đăng nhập ngay</a>
      </div>
    `;
    chatInput.disabled = true;
    sendBtn.disabled = true;
  } else {
    // Tải lịch sử cũ
    await loadChatHistory();
    renderSuggestions();
  }

  // 2. Sự kiện Mở/Đóng
  toggleBtn.addEventListener("click", () => {
    chatBox.classList.toggle("hidden");
    if (!chatBox.classList.contains("hidden") && currentUser) {
      chatInput.focus();
      scrollToBottom();
    }
  });

  closeBtn.addEventListener("click", () => chatBox.classList.add("hidden"));

  // 3. HÀM GỬI TIN (SỬA LỖI QUAN TRỌNG Ở ĐÂY)
  window.handleSend = async (messageText = null) => {
    const msg = messageText || chatInput.value.trim();
    if (!msg || !currentUser) return;

    // A. UI: Hiển thị tin nhắn người dùng NGAY LẬP TỨC (Không chờ Server)
    appendMessage(msg, "user");

    // Reset input và ẩn gợi ý
    chatInput.value = "";
    document.getElementById("suggestion-box").classList.add("hidden");

    // Hiển thị hiệu ứng "Bot đang nhập..."
    const loadingId = showTypingIndicator();

    try {
      // B. Database: Lưu tin nhắn User vào DB (để F5 không bị mất)
      const { error: insertError } = await supabase
        .from("chat_messages")
        .insert({
          user_id: currentUser.id,
          content: msg,
          is_bot: false,
        });

      if (insertError) console.error("Lỗi lưu tin nhắn:", insertError);

      // C. API: Gọi Bot lấy câu trả lời
      const { data, error } = await callEdgeFunction("chat-bot", {
        method: "POST",
        body: { message: msg },
      });

      // Xóa hiệu ứng đang nhập
      removeTypingIndicator(loadingId);

      if (error) {
        console.error("Lỗi Bot:", error);
        appendMessage("⚠️ Gà Bông đang mất kết nối. Thử lại sau nhé!", "bot");
      } else {
        // D. UI: Hiển thị tin nhắn Bot từ phản hồi API
        if (data && data.reply) {
          appendMessage(data.reply, "bot");
        }
      }
    } catch (err) {
      removeTypingIndicator(loadingId);
      console.error(err);
    }
  };

  sendBtn.addEventListener("click", () => window.handleSend());
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.handleSend();
    }
  });
}

// --- CÁC HÀM UI HỖ TRỢ ---

function renderSuggestions() {
  const box = document.getElementById("suggestion-box");
  if (!box) return;
  box.innerHTML = "";
  box.classList.remove("hidden");
  SUGGESTED_QUESTIONS.forEach((q) => {
    const btn = document.createElement("button");
    btn.textContent = q;
    btn.className = "suggestion-btn";
    btn.onclick = () => window.handleSend(q);
    box.appendChild(btn);
  });
}

async function loadChatHistory() {
  const chatBody = document.getElementById("chat-body");
  chatBody.innerHTML =
    '<div class="text-center text-gray-400 mt-4 text-sm">Đang tải cuộc trò chuyện...</div>';

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  chatBody.innerHTML = "";

  if (!error && data.length > 0) {
    data.forEach((msg) => {
      appendMessage(msg.content, msg.is_bot ? "bot" : "user");
    });
  } else {
    appendMessage(
      "Chào bạn! Mình là Gà Bông 🐣. Bạn cần tìm phòng trọ ở đâu?",
      "bot"
    );
  }
  scrollToBottom();
}

// Hàm vẽ tin nhắn (QUAN TRỌNG)
function appendMessage(text, sender) {
  const chatBody = document.getElementById("chat-body");
  const div = document.createElement("div");
  // Class user-message (màu xanh) hoặc bot-message (màu xám)
  div.className = sender === "user" ? "user-message" : "bot-message";

  // Format xuống dòng và tô đậm
  let formattedText = text
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  div.innerHTML = `<p>${formattedText}</p>`;
  chatBody.appendChild(div);
  scrollToBottom();
}

function showTypingIndicator() {
  const chatBody = document.getElementById("chat-body");
  const id = "typing-" + Date.now();
  const div = document.createElement("div");
  div.id = id;
  div.className = "bot-message";
  div.innerHTML = `<p class="text-gray-400 italic text-xs">Bot đang nhập...</p>`;
  chatBody.appendChild(div);
  scrollToBottom();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  const chatBody = document.getElementById("chat-body");
  chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
}

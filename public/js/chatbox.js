/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN AI + SUGGESTED QUESTIONS)
   ======================================= */

let chatSubscription = null;
let currentUser = null;

// Danh sách câu hỏi mẫu
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

  // Thêm vùng chứa gợi ý (nếu chưa có)
  let suggestionBox = document.getElementById("suggestion-box");
  if (!suggestionBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "suggestion-box";
    suggestionBox.className = "suggestion-container hidden";
    // Chèn vào trên footer
    chatBox.insertBefore(suggestionBox, document.querySelector(".chat-footer"));
  }

  if (!toggleBtn || !chatBox || !closeBtn) return;

  // 1. Auth Check
  const {
    data: { session },
  } = await supabase.auth.getSession();
  currentUser = session?.user;

  if (!currentUser) {
    chatBody.innerHTML = `
      <div class="text-center mt-10 px-4">
        <p class="text-gray-600 mb-3">Đăng nhập để chat với AI Chicky!</p>
        <a href="/login.html" class="btn btn-sm btn-primary">Đăng nhập ngay</a>
      </div>
    `;
    chatInput.disabled = true;
    sendBtn.disabled = true;
  } else {
    await loadChatHistory();
    setupRealtimeSubscription();
    renderSuggestions(); // Hiển thị gợi ý
  }

  // 2. Sự kiện UI
  toggleBtn.addEventListener("click", () => {
    chatBox.classList.toggle("hidden");
    if (!chatBox.classList.contains("hidden") && currentUser) {
      chatInput.focus();
      scrollToBottom();
    }
  });

  closeBtn.addEventListener("click", () => chatBox.classList.add("hidden"));

  // 3. Hàm gửi tin
  window.handleSend = async (messageText = null) => {
    // Nếu có text truyền vào (từ nút gợi ý) thì dùng, không thì lấy từ input
    const msg = messageText || chatInput.value.trim();

    if (!msg || !currentUser) return;

    chatInput.value = "";

    // Ẩn gợi ý sau khi chat
    document.getElementById("suggestion-box").classList.add("hidden");

    try {
      // Gọi AI Function
      const { error } = await callEdgeFunction("chat-bot", {
        method: "POST",
        body: { message: msg },
      });

      if (error) {
        console.error("Lỗi AI:", error);
        appendMessage("Lỗi kết nối AI. Vui lòng thử lại.", "bot");
      }
    } catch (err) {
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

// --- HÀM RENDER GỢI Ý ---
function renderSuggestions() {
  const box = document.getElementById("suggestion-box");
  if (!box) return;

  box.innerHTML = "";
  box.classList.remove("hidden"); // Hiện lên

  SUGGESTED_QUESTIONS.forEach((q) => {
    const btn = document.createElement("button");
    btn.textContent = q;
    btn.className = "suggestion-btn";
    btn.onclick = () => window.handleSend(q); // Gửi ngay khi click
    box.appendChild(btn);
  });
}

// --- CÁC HÀM CŨ (Giữ nguyên logic) ---
async function loadChatHistory() {
  const chatBody = document.getElementById("chat-body");
  chatBody.innerHTML =
    '<div class="text-center text-gray-400 mt-4 text-sm">Đang tải lịch sử...</div>';

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  if (error) {
    chatBody.innerHTML =
      '<p class="text-red-500 text-center">Lỗi tải chat.</p>';
    return;
  }

  chatBody.innerHTML = "";

  // Lời chào mặc định nếu chưa chat
  if (data.length === 0) {
    appendMessage(
      "Chào bạn! Mình là AI của Chicky.stu 🐣. Bạn cần giúp gì không?",
      "bot"
    );
  } else {
    data.forEach((msg) => {
      appendMessage(msg.content, msg.is_bot ? "bot" : "user");
    });
  }
  scrollToBottom();
}

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
        const newMsg = payload.new;
        appendMessage(newMsg.content, newMsg.is_bot ? "bot" : "user");
      }
    )
    .subscribe();
}

function appendMessage(text, sender) {
  const chatBody = document.getElementById("chat-body");
  const div = document.createElement("div");
  div.className = sender === "user" ? "user-message" : "bot-message";

  // Markdown đơn giản (xuống dòng)
  const formattedText = text.replace(/\n/g, "<br>");

  div.innerHTML = `<p>${formattedText}</p>`;
  chatBody.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const chatBody = document.getElementById("chat-body");
  chatBody.scrollTop = chatBody.scrollHeight;
}

/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN V5 - FIX UI TIN NHẮN NGƯỜI DÙNG)
   ======================================= */

let chatSubscription = null;
let currentUser = null;

// Danh sách câu hỏi mẫu (Gợi ý)
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
        <p class="text-gray-600 mb-3">Đăng nhập để chat với Gà Bông 🐣 nhé!</p>
        <a href="/login.html" class="btn btn-sm btn-primary">Đăng nhập ngay</a>
      </div>
    `;
    chatInput.disabled = true;
    sendBtn.disabled = true;
  } else {
    await loadChatHistory();
    setupRealtimeSubscription();
    renderSuggestions();
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

  // 3. Hàm gửi tin (ĐÃ SỬA LOGIC)
  window.handleSend = async (messageText = null) => {
    const msg = messageText || chatInput.value.trim();

    if (!msg || !currentUser) return;

    // Reset input ngay lập tức cho mượt
    chatInput.value = "";
    document.getElementById("suggestion-box").classList.add("hidden");

    try {
      // BƯỚC 1: Lưu tin nhắn của User vào Database NGAY LẬP TỨC
      // (Realtime sẽ tự động bắt sự kiện này và vẽ lên giao diện)
      const { error: insertError } = await supabase
        .from("chat_messages")
        .insert({
          user_id: currentUser.id,
          content: msg,
          is_bot: false, // Đây là tin người dùng
        });

      if (insertError) {
        console.error("Lỗi lưu tin nhắn:", insertError);
        appendMessage("⚠️ Lỗi gửi tin nhắn. Vui lòng thử lại.", "bot");
        return;
      }

      // BƯỚC 2: Gọi AI (Backend)
      // Bot sẽ tự xử lý và lưu câu trả lời của nó vào DB sau
      const { error } = await callEdgeFunction("chat-bot", {
        method: "POST",
        body: { message: msg },
      });

      if (error) {
        console.error("Lỗi gọi AI:", error);
        // Nếu gọi Function thất bại (mất mạng, server sập...), báo lỗi
        appendMessage("⚠️ Gà Bông đang mất kết nối. Thử lại sau nhé!", "bot");
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

// --- CÁC HÀM HỖ TRỢ ---

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
    '<div class="text-center text-gray-400 mt-4 text-sm"><div class="spinner-border spinner-border-sm text-primary" role="status"></div> Đang tải lịch sử...</div>';

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

  chatBody.innerHTML = ""; // Xóa loading

  if (data.length === 0) {
    appendMessage(
      "Chào bạn! Mình là Gà Bông 🐣. Bạn đang tìm phòng trọ khu vực nào?",
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

  // Lắng nghe sự kiện INSERT vào bảng chat_messages
  chatSubscription = supabase
    .channel("public:chat_messages")
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `user_id=eq.${currentUser.id}`, // Chỉ nhận tin của mình (hoặc Bot trả lời mình)
      },
      (payload) => {
        const newMsg = payload.new;
        // Vẽ tin nhắn lên màn hình (Cả User và Bot đều qua đây)
        appendMessage(newMsg.content, newMsg.is_bot ? "bot" : "user");
      }
    )
    .subscribe();
}

function appendMessage(text, sender) {
  const chatBody = document.getElementById("chat-body");
  const div = document.createElement("div");

  // Class CSS quyết định màu sắc (Xanh cho User, Xám cho Bot)
  div.className = sender === "user" ? "user-message" : "bot-message";

  // Xử lý xuống dòng và format nhẹ
  // Regex này chuyển các dấu gạch đầu dòng (-) thành chấm tròn cho đẹp
  let formattedText = text.replace(/\n/g, "<br>");

  // Highlight giá tiền (nếu có)
  formattedText = formattedText.replace(
    /(\d{1,3}(?:\.\d{3})+) VNĐ/g,
    "<b>$1 VNĐ</b>"
  );

  div.innerHTML = `<p>${formattedText}</p>`;
  chatBody.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  const chatBody = document.getElementById("chat-body");
  // Cuộn mượt
  chatBody.scrollTo({
    top: chatBody.scrollHeight,
    behavior: "smooth",
  });
}

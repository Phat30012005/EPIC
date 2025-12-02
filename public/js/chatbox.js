/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN FINAL - RISK MANAGEMENT & DEBUG)
   ======================================= */

// [DEBUG] Dòng này giúp xác nhận trình duyệt đã tải code mới
console.log(
  "%c Chatbox System V8.0 Loaded ",
  "background: #222; color: #bada55"
);

let currentUser = null;

const SUGGESTED_QUESTIONS = [
  "Cách đăng tin cho thuê?",
  "Tìm phòng dưới 2 triệu",
  "Chính sách tìm người ở ghép?",
  "Khu vực nào gần ĐH Cần Thơ?",
];

async function initializeChatbox() {
  try {
    const chatWidget = document.getElementById("chat-widget");
    if (!chatWidget) return; // Không có widget thì không chạy

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
      // Chèn an toàn vào trước footer
      const footer = document.querySelector(".chat-footer");
      if (footer) chatBox.insertBefore(suggestionBox, footer);
    }

    if (!toggleBtn || !chatBox || !closeBtn) {
      console.error("[Chatbox] Thiếu thành phần UI quan trọng.");
      return;
    }

    // 1. Kiểm tra Auth & Session (Quản lý rủi ro phiên đăng nhập)
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) {
      console.error("[Chatbox] Lỗi Session:", sessionError);
      return;
    }

    currentUser = session?.user;

    if (!currentUser) {
      // Giao diện khi chưa đăng nhập
      chatBody.innerHTML = `
        <div class="text-center mt-10 px-4">
          <p class="text-gray-600 mb-3">Đăng nhập để chat với Gà Bông 🐣 nhé!</p>
          <a href="/login.html" class="btn btn-sm btn-primary">Đăng nhập ngay</a>
        </div>
      `;
      if (chatInput) chatInput.disabled = true;
      if (sendBtn) sendBtn.disabled = true;
    } else {
      // Đã đăng nhập -> Tải lịch sử
      await loadChatHistory();
      renderSuggestions();
    }

    // 2. Gán sự kiện UI
    toggleBtn.onclick = () => {
      chatBox.classList.toggle("hidden");
      if (!chatBox.classList.contains("hidden") && currentUser) {
        setTimeout(() => {
          chatInput.focus();
          scrollToBottom();
        }, 100); // Delay nhẹ để UI vẽ xong
      }
    };

    closeBtn.onclick = () => chatBox.classList.add("hidden");

    // 3. XỬ LÝ GỬI TIN (LOGIC AN TOÀN CAO)
    window.handleSend = async (messageText = null) => {
      const msg = messageText || chatInput.value.trim();

      // Rủi ro 1: Người dùng chưa nhập hoặc mất session
      if (!msg) return;
      if (!currentUser) {
        alert("Phiên đăng nhập đã hết hạn. Vui lòng tải lại trang.");
        return;
      }

      // === A. UI UPDATE (OPTIMISTIC) ===
      // Vẽ ngay lập tức để người dùng thấy phản hồi
      appendMessage(msg, "user");

      // Reset input & UI phụ
      chatInput.value = "";
      if (suggestionBox) suggestionBox.classList.add("hidden");

      // Hiệu ứng "Đang xử lý..."
      const loadingId = showTypingIndicator();

      try {
        // === B. DATA PERSISTENCE (Lưu Database) ===
        // Chạy song song insert DB để không chặn UI
        const insertPromise = supabase.from("chat_messages").insert({
          user_id: currentUser.id,
          content: msg,
          is_bot: false,
        });

        // === C. AI PROCESSING (Gọi Edge Function) ===
        const apiPromise = callEdgeFunction("chat-bot", {
          method: "POST",
          body: { message: msg },
        });

        // Chờ cả 2 (hoặc xử lý API trước tùy ưu tiên, ở đây ta chờ API để trả lời)
        const [insertResult, apiResult] = await Promise.all([
          insertPromise,
          apiPromise,
        ]);

        // Kiểm tra lỗi lưu DB (Ghi log để debug)
        if (insertResult.error)
          console.error("[Chatbox] DB Insert Error:", insertResult.error);

        // Xóa hiệu ứng nhập
        removeTypingIndicator(loadingId);

        // Xử lý kết quả AI
        const { data, error } = apiResult;

        if (error) {
          console.error("[Chatbox] API Error:", error);
          appendMessage("⚠️ Gà Bông đang mất kết nối. Thử lại sau nhé!", "bot");
        } else if (data && data.reply) {
          appendMessage(data.reply, "bot");
        }
      } catch (err) {
        removeTypingIndicator(loadingId);
        console.error("[Chatbox] Critical Error:", err);
        appendMessage("⚠️ Lỗi hệ thống. Vui lòng thử lại.", "bot");
      }
    };

    sendBtn.onclick = () => window.handleSend();

    chatInput.onkeypress = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        window.handleSend();
      }
    };
  } catch (e) {
    console.error("[Chatbox] Init Failed:", e);
  }
}

// --- CÁC HÀM UI ---

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
  if (!chatBody) return;

  // Chỉ hiện loading nếu chatBody trống
  if (chatBody.children.length === 0) {
    chatBody.innerHTML =
      '<div class="text-center text-gray-400 mt-4 text-sm">Đang tải tin nhắn...</div>';
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: true });

  chatBody.innerHTML = ""; // Xóa loading

  if (!error && data && data.length > 0) {
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

function appendMessage(text, sender) {
  const chatBody = document.getElementById("chat-body");
  if (!chatBody) return;

  const div = document.createElement("div");
  div.className = sender === "user" ? "user-message" : "bot-message";

  // Format văn bản: Xuống dòng + Bold
  let formattedText = text
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  div.innerHTML = `<p>${formattedText}</p>`;
  chatBody.appendChild(div);
  scrollToBottom();
}

function showTypingIndicator() {
  const chatBody = document.getElementById("chat-body");
  if (!chatBody) return;

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
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function scrollToBottom() {
  const chatBody = document.getElementById("chat-body");
  if (chatBody) {
    chatBody.scrollTo({ top: chatBody.scrollHeight, behavior: "smooth" });
  }
}

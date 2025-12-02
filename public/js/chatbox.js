/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN V14 - FINAL - FIXED SYNTAX)
   ======================================= */

// Định nghĩa hàm khởi tạo toàn cục (Global)
window.initializeChatbox = async function () {
  // 1. KIỂM TRA AN TOÀN
  // Tìm phần tử cha chứa chatbox
  const chatWidget = document.getElementById("chat-widget");
  if (!chatWidget) {
    console.warn("⚠️ Chatbox HTML chưa sẵn sàng. Bỏ qua khởi tạo.");
    return;
  }

  // Kiểm tra Supabase
  if (typeof supabase === "undefined") {
    console.error("❌ Không tìm thấy Supabase client. Chatbox bị tắt.");
    return;
  }

  console.log("✅ Chatbox V14 đã khởi động thành công!");

  // === KHAI BÁO BIẾN UI ===
  let currentUser = null;
  let isSending = false;

  const ui = {
    toggleBtn: document.getElementById("chat-toggle"),
    chatBox: document.getElementById("chat-box"),
    closeBtn: document.getElementById("chat-close"),
    sendBtn: document.getElementById("send-btn"),
    chatInput: document.getElementById("chat-input"),
    chatBody: document.getElementById("chat-body"),
  };

  // Các câu hỏi gợi ý
  const SUGGESTED_QUESTIONS = [
    "Cách đăng tin cho thuê?",
    "Tìm phòng dưới 2 triệu",
    "Chính sách tìm người ở ghép?",
    "Khu vực nào gần ĐH Cần Thơ?",
  ];

  // === LOGIC KHỞI TẠO ===

  // Tạo vùng gợi ý (nếu chưa có)
  let suggestionBox = document.getElementById("suggestion-box");
  if (!suggestionBox && ui.chatBox) {
    suggestionBox = document.createElement("div");
    suggestionBox.id = "suggestion-box";
    suggestionBox.className = "hidden";
    const footer = document.querySelector(".chat-footer");
    if (footer) ui.chatBox.insertBefore(suggestionBox, footer);
  }

  // Kiểm tra Auth an toàn
  try {
    const { data } = await supabase.auth.getSession();
    currentUser = data?.session?.user;
  } catch (err) {
    console.warn("Lỗi kiểm tra Auth chatbox:", err);
  }

  // Render UI dựa trên trạng thái đăng nhập
  if (ui.chatBody) {
    if (!currentUser) {
      ui.chatBody.innerHTML = `
        <div style="text-align: center; margin-top: 60px; color: #666;">
          <p>Vui lòng đăng nhập để chat 🐣</p>
          <a href="/login.html" class="btn btn-sm btn-primary" style="margin-top:10px;">Đăng nhập ngay</a>
        </div>
      `;
      if (ui.chatInput) ui.chatInput.disabled = true;
      if (ui.sendBtn) ui.sendBtn.disabled = true;
    } else {
      await loadChatHistory(ui.chatBody);
      renderSuggestions();
    }
  }

  // === EVENT LISTENERS ===
  if (ui.toggleBtn) {
    ui.toggleBtn.onclick = () => {
      ui.chatBox.classList.toggle("hidden");
      if (!ui.chatBox.classList.contains("hidden") && currentUser) {
        setTimeout(() => {
          ui.chatInput?.focus();
          scrollToBottom(ui.chatBody);
        }, 150);
      }
    };
  }

  if (ui.closeBtn) {
    ui.closeBtn.onclick = () => ui.chatBox.classList.add("hidden");
  }

  // === HÀM GỬI TIN NHẮN ===
  const handleSend = async (text = null) => {
    const msg = text || ui.chatInput.value.trim();

    if (!msg) return;
    if (!currentUser) {
      alert("Vui lòng đăng nhập.");
      return;
    }
    if (isSending) return;
    isSending = true;

    // UI Update Instant
    appendMessageToUI(ui.chatBody, msg, "user");

    ui.chatInput.value = "";
    if (suggestionBox) suggestionBox.classList.add("hidden");

    const typingId = showTyping(ui.chatBody);

    try {
      // Backend Calls
      const [dbRes, apiRes] = await Promise.all([
        supabase.from("chat_messages").insert({
          user_id: currentUser.id,
          content: msg,
          is_bot: false,
        }),
        callEdgeFunction("chat-bot", {
          method: "POST",
          body: { message: msg },
        }),
      ]);

      removeTyping(typingId);

      // Handle Response
      if (apiRes.error) {
        appendMessageToUI(ui.chatBody, "⚠️ Lỗi kết nối Gà Bông.", "bot");
      } else if (apiRes.data && apiRes.data.reply) {
        appendMessageToUI(ui.chatBody, apiRes.data.reply, "bot");
      } else {
        appendMessageToUI(ui.chatBody, "Gà Bông chưa hiểu ý bạn.", "bot");
      }
    } catch (err) {
      removeTyping(typingId);
      console.error(err);
      appendMessageToUI(ui.chatBody, "⚠️ Lỗi hệ thống.", "bot");
    } finally {
      isSending = false;
      setTimeout(() => ui.chatInput?.focus(), 100);
    }
  };

  // Gán hàm handleSend vào window để nút gợi ý có thể gọi (nếu cần)
  window.handleSendChat = handleSend;

  if (ui.sendBtn) ui.sendBtn.onclick = () => handleSend();

  if (ui.chatInput) {
    ui.chatInput.onkeypress = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    };
  }

  // --- UI HELPER FUNCTIONS (Nằm trong scope để tránh xung đột global) ---

  function appendMessageToUI(container, text, sender) {
    if (!container) return;
    const row = document.createElement("div");
    const modifier = sender === "user" ? "is-user" : "is-bot";
    row.className = `chat-row ${modifier}`;

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.innerHTML = text
      .replace(/\n/g, "<br>")
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

    row.appendChild(bubble);
    container.appendChild(row);
    scrollToBottom(container);
  }

  function showTyping(container) {
    if (!container) return;
    const id = "typing-" + Date.now();
    const row = document.createElement("div");
    row.id = id;
    row.className = "chat-row is-bot";
    row.innerHTML = `<div class="chat-bubble" style="background:none; color:#888; font-style:italic;">Đang nhập...</div>`;
    container.appendChild(row);
    scrollToBottom(container);
    return id;
  }

  function removeTyping(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function scrollToBottom(container) {
    if (container)
      setTimeout(() => (container.scrollTop = container.scrollHeight), 50);
  }

  async function loadChatHistory(container) {
    if (!container) return;
    if (!container.hasChildNodes())
      container.innerHTML =
        '<div style="text-align:center; color:#aaa; padding:20px;">Đang tải...</div>';

    const { data, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: true });

    container.innerHTML = "";
    if (!error && data) {
      data.forEach((msg) =>
        appendMessageToUI(container, msg.content, msg.is_bot ? "bot" : "user")
      );
    } else {
      appendMessageToUI(container, "Chào bạn! Mình là Gà Bông 🐣.", "bot");
    }
    scrollToBottom(container);
  }

  function renderSuggestions() {
    if (!suggestionBox) return;
    suggestionBox.innerHTML = "";
    suggestionBox.classList.remove("hidden");
    SUGGESTED_QUESTIONS.forEach((q) => {
      const btn = document.createElement("button");
      btn.className = "suggestion-btn";
      btn.textContent = q;
      btn.onclick = () => handleSend(q);
      suggestionBox.appendChild(btn);
    });
  }
};

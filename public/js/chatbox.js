/* =======================================
   --- FILE: js/chatbox.js ---
   (PHIÊN BẢN V2.0 - MENU DRIVEN / NO-TYPING)
   ======================================= */

window.initializeChatbox = async function () {
  const ui = {
    toggleBtn: document.getElementById("chat-toggle"),
    chatBox: document.getElementById("chat-box"),
    closeBtn: document.getElementById("chat-close"),
    chatBody: document.getElementById("chat-body"),
    optionContainer: document.getElementById("option-buttons"),
    loadingIndicator: document.getElementById("loading-indicator"),
  };

  if (!ui.chatBox) return; // Safety check

  let currentUser = null;
  let isProcessing = false;

  // 1. Kiểm tra Auth
  try {
    const { data } = await supabase.auth.getSession();
    currentUser = data?.session?.user;
  } catch (err) {
    console.warn("Auth check failed:", err);
  }

  // 2. Render UI khởi đầu
  if (!currentUser) {
    ui.chatBody.innerHTML = `
        <div style="text-align: center; margin-top: 50px; color: #666;">
          <p>Xin chào! 👋</p>
          <p>Vui lòng đăng nhập để được Gà Bông hỗ trợ nhé.</p>
          <a href="/login.html" class="btn btn-sm btn-primary" style="margin-top:10px;">Đăng nhập ngay</a>
        </div>`;
    ui.optionContainer.innerHTML = "";
  } else {
    // Load lịch sử cũ
    await loadChatHistory();
    // Nếu lịch sử trống, tự động kích hoạt lời chào
    if (!ui.chatBody.hasChildNodes() || ui.chatBody.children.length === 0) {
      handleStep("start");
    }
  }

  // === EVENT LISTENERS ===
  if (ui.toggleBtn) {
    ui.toggleBtn.onclick = () => {
      ui.chatBox.classList.toggle("hidden");
      scrollToBottom();
    };
  }
  if (ui.closeBtn) {
    ui.closeBtn.onclick = () => ui.chatBox.classList.add("hidden");
  }

  // === CORE FUNCTION: XỬ LÝ BƯỚC ĐI (STEP) ===
  async function handleStep(stepId, userLabel = null) {
    if (isProcessing) return;
    isProcessing = true;

    // 1. Nếu đây là hành động click của user (có label), hiển thị nó lên chat
    if (userLabel) {
      appendMessage(userLabel, "user");
      // Xóa các nút cũ đi để tránh bấm lại
      ui.optionContainer.innerHTML = "";
    }

    // 2. Hiển thị loading
    ui.loadingIndicator.classList.remove("hidden");

    try {
      // 3. Gọi Backend
      // Lưu ý: callEdgeFunction đã có sẵn trong api-client.js
      const { data, error } = await callEdgeFunction("chat-bot", {
        method: "POST",
        body: { step_id: stepId },
      });

      ui.loadingIndicator.classList.add("hidden");

      if (error) {
        console.error(error);
        appendMessage("⚠️ Có lỗi kết nối. Thử lại sau nhé.", "bot");
        return;
      }

      // 4. Hiển thị phản hồi của Bot
      if (data && data.reply) {
        appendMessage(data.reply, "bot");
      }

      // 5. Render các nút bấm tiếp theo (Options)
      if (data && data.options) {
        renderOptions(data.options);
      }
    } catch (err) {
      console.error(err);
      ui.loadingIndicator.classList.add("hidden");
      appendMessage("⚠️ Lỗi hệ thống.", "bot");
    } finally {
      isProcessing = false;
      scrollToBottom();
    }
  }

 // === HELPER: RENDER BUTTONS (GIAO DIỆN MỚI) ===
  function renderOptions(options) {
    ui.optionContainer.innerHTML = ""; // Clear cũ

    options.forEach((opt, index) => { // Thêm biến index để tính độ trễ
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.textContent = opt.label;

      // THÊM: Chỉnh độ trễ animation (Stagger Effect)
      // Nút thứ 2 sẽ hiện chậm hơn nút 1 một xíu...
      btn.style.animationDelay = ${index * 0.1}s; 

      // Khi bấm nút
      btn.onclick = () => handleStep(opt.next_step, opt.label);

      ui.optionContainer.appendChild(btn);
    });

    // Scroll xuống
    setTimeout(scrollToBottom, 100);
  }

  // === UI UTILS ===
  function appendMessage(text, sender) {
    const row = document.createElement("div");
    row.className = `chat-row ${sender === "user" ? "is-user" : "is-bot"}`;

    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    // Xử lý xuống dòng
    bubble.innerHTML = text.replace(/\n/g, "<br>");

    row.appendChild(bubble);
    ui.chatBody.appendChild(row);
    scrollToBottom();
  }

  function scrollToBottom() {
    if (ui.chatBody) {
      ui.chatBody.scrollTop = ui.chatBody.scrollHeight;
    }
  }

  async function loadChatHistory() {
    // Lấy tin nhắn cũ để user không thấy trống trơn
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: true });

    if (data) {
      data.forEach((msg) =>
        appendMessage(msg.content, msg.is_bot ? "bot" : "user")
      );

      // Mẹo nhỏ: Nếu tin nhắn cuối cùng là của Bot,
      // ta nên gọi lại bước đó (hoặc bước Start) để hiện lại nút bấm cho user chọn tiếp.
      // Nhưng để đơn giản, ta chỉ hiện nút "Bắt đầu lại" nếu lịch sử đã load xong.
      if (data.length > 0) {
        renderOptions([{ label: "🐣 Menu Chính", next_step: "start" }]);
      }
    }
  }
};

/* ═══════════════════════════════════════════════
   PARIVARTAN VENDOR BOT – CHATBOT ENGINE v2
   Supports: Bot Chat + Vendor Order Chat
═══════════════════════════════════════════════ */

// ──────────────────────────────────────────────
// DOM REFERENCES
// ──────────────────────────────────────────────
const messagesArea = document.getElementById('messagesArea');
const chatBg = document.getElementById('chatBg');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const plusBtn = document.getElementById('plusBtn');
const plusMenu = document.getElementById('plusMenu');
const onboardingTrigger = document.getElementById('onboardingTrigger');
const orderTrackerTrigger = document.getElementById('orderTrackerTrigger');
const fileInput = document.getElementById('fileInput');
const headerName = document.getElementById('headerName');
const headerSub = document.getElementById('headerSub');
const headerAvatar = document.getElementById('headerAvatar');

// ──────────────────────────────────────────────
// CHAT STATE
// ──────────────────────────────────────────────
// activeChat: 'bot' | 'vendor' | 'orders'
let activeChat = 'bot';
let orderBotRunning = false;
let onlineOrdersBotRunning = false;
let currentUploadCallback = null;

// Pre-stored chat histories
const chatHistory = {
  bot: [],    // Messages generated dynamically
  vendor: [   // Pre-loaded Parivartan Vendor conversation
    { type: 'incoming', text: 'Hello, your delivery is scheduled.', time: '7:07 pm' },
    { type: 'outgoing', text: 'Great, please deliver it to Birmingham Shikhar Hostel.', time: '7:08 pm' },
    { type: 'incoming', text: 'Noted. Birmingham Shikhar Hostel. Driver is on the way.', time: '7:10 pm' },
  ]
};

// Vendor data for onboarding bot
let vendorData = {
  verification: { idProof: false, bizVerify: false, license: false },
  location: { live: false, shop: false, tourist: false },
  inventory: { photos: false, products: [], stock: false, category: '' }
};
let completedShown = false;
let selectedSpots = [];

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function delay(ms) { return new Promise(res => setTimeout(res, ms)); }

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function escHtml(t) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(t));
  return d.innerHTML;
}

function scrollBottom() {
  setTimeout(() => { chatBg.scrollTop = chatBg.scrollHeight; }, 60);
}

function disableAllQR() {
  document.querySelectorAll('.qr-btn:not(.disabled), .sub-btn:not(.disabled)').forEach(b => b.classList.add('disabled'));
}

function updateChatPreview(text) {
  const el = document.getElementById('botPreview');
  const tl = document.getElementById('botLastTime');
  if (el) el.textContent = text;
  if (tl) tl.textContent = nowTime();
}

// ──────────────────────────────────────────────
// RENDER HELPERS
// ──────────────────────────────────────────────
function addUserMessage(text) {
  const row = document.createElement('div');
  row.className = 'msg-row outgoing';
  row.innerHTML = `
    <div class="msg-bubble outgoing">
      <span class="msg-text">${escHtml(text)}</span>
      <div class="msg-meta">
        <span class="msg-time">${nowTime()}</span>
        <span class="msg-tick"><span class="material-icons-round" style="font-size:14px;color:#53bdeb;">done_all</span></span>
      </div>
    </div>`;
  messagesArea.appendChild(row);
  scrollBottom();
}

function addVendorMessage(text, time) {
  const row = document.createElement('div');
  row.className = 'msg-row incoming';
  row.innerHTML = `
    <div class="msg-bubble incoming">
      <span class="msg-text">${escHtml(text)}</span>
      <div class="msg-meta"><span class="msg-time">${time || nowTime()}</span></div>
    </div>`;
  messagesArea.appendChild(row);
  scrollBottom();
}

function addPreloadedOutgoing(text, time) {
  const row = document.createElement('div');
  row.className = 'msg-row outgoing';
  row.innerHTML = `
    <div class="msg-bubble outgoing">
      <span class="msg-text">${escHtml(text)}</span>
      <div class="msg-meta">
        <span class="msg-time">${time}</span>
        <span class="msg-tick"><span class="material-icons-round" style="font-size:14px;color:#53bdeb;">done_all</span></span>
      </div>
    </div>`;
  messagesArea.appendChild(row);
}

async function addBotMessage(html, delay_ms = 0) {
  return new Promise(resolve => {
    setTimeout(() => {
      const typingRow = document.createElement('div');
      typingRow.className = 'msg-row incoming';
      typingRow.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
      messagesArea.appendChild(typingRow);
      scrollBottom();

      setTimeout(() => {
        typingRow.remove();
        const row = document.createElement('div');
        row.className = 'msg-row incoming';
        row.innerHTML = `
          <div class="msg-bubble incoming">
            <div class="bot-label">🤖 Parivartan Bot</div>
            ${html}
            <div class="msg-meta"><span class="msg-time">${nowTime()}</span></div>
          </div>`;
        messagesArea.appendChild(row);
        scrollBottom();
        resolve(row);
      }, 900);
    }, delay_ms);
  });
}

// ──────────────────────────────────────────────
// ORDER STATUS CARDS (Vendor Chat)
// ──────────────────────────────────────────────
function addOrderStatusCard({ type, icon, title, bodyLines, chips }) {
  const el = document.createElement('div');
  el.className = `order-status-msg ${type}`;

  const chipsHTML = (chips || []).map(c =>
    `<span class="order-detail-chip"><span class="material-icons-round" style="font-size:14px;">${c.icon}</span>${escHtml(c.label)}</span>`
  ).join('');

  el.innerHTML = `
    <div class="order-status-header">
      <div class="order-status-icon">
        <span class="material-icons-round" style="font-size:18px;">${icon}</span>
      </div>
      <span class="order-status-title">${escHtml(title)}</span>
    </div>
    <div class="order-status-body">${bodyLines.map(l => escHtml(l)).join('<br>')}</div>
    <div>${chipsHTML}</div>
    <div class="order-status-time">${nowTime()}</div>`;

  messagesArea.appendChild(el);
  scrollBottom();
}

function addRunningBotLabel() {
  const el = document.createElement('div');
  el.className = 'running-bot-label';
  el.id = 'runningLabel';
  el.innerHTML = `<div class="pulse-dot"></div> Live Order Tracking Active`;
  messagesArea.appendChild(el);
  scrollBottom();
  return el;
}

// ──────────────────────────────────────────────
// VENDOR OMS (Order Management System) STATE
// ──────────────────────────────────────────────
let omsState = {
  status: 'IDLE',   // IDLE | NEW_ORDER | PACKING | SHIPPING
  orderNum: null,
  product: null,
  qty: null,
  customer: null
};

const INVENTORY_STACK = [
  'Channapatna Toy Set (Train Set)',
  'Channapatna Toy Set (6-piece)',
  'Mysore Silk Saree (Crepe)',
  'Mysore Silk Saree (Zari Border)',
  'Mysore Rosewood Painting (Elephant)',
  'Sandalwood Oil (100ml)',
  'Coorg Coffee (Arabica)'
];
const NAMES = ['Priya Nair', 'Arjun Hegde', 'Sneha Reddy', 'Rohan Sharma', 'Deepa Venkatesh', 'Vivek R.'];
const AGENTS = ['Suresh Babu', 'Mahesh Kumar', 'Venkatesh P.', 'Rajesh D.'];
const LOCATIONS = ['Koramangala, Bengaluru', 'Indiranagar, Bengaluru', 'Jayanagar, Bengaluru', 'Malleshwaram, Bengaluru'];

function generateRandomOrder() {
  omsState.orderNum = '#' + (1000 + Math.floor(Math.random() * 8999));
  omsState.product = INVENTORY_STACK[Math.floor(Math.random() * INVENTORY_STACK.length)];
  omsState.qty = 1 + Math.floor(Math.random() * 4);
  omsState.customer = NAMES[Math.floor(Math.random() * NAMES.length)];
  omsState.location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
}

// ──────────────────────────────────────────────
// VENDOR INTERACTIVE INPUT HANDLER (STATE MACHINE)
// ──────────────────────────────────────────────
async function handleVendorInput(rawText) {
  const t = rawText.trim().toLowerCase();

  if (omsState.status === 'IDLE') {
    if (t === 'start' || t === 'proceed' || t === 'next') {
      triggerNewOrder();
    } else {
      addVendorHelperMessage("System IDLE. Type <strong>Start</strong> to fetch the next order.");
    }
    return;
  }

  if (omsState.status === 'NEW_ORDER') {
    if (t === 'accept' || t === 'proceed') {
      omsState.status = 'PACKING';
      addApiEventCard({
        evClass: 'ev-placed',
        icon: 'check_circle',
        title: '✅ ORDER CONFIRMED',
        body: `<strong>Status:</strong> Invoice Generated. Inventory Deducted.<br>⚠️ <strong>Pending:</strong> Item needs packing.`,
        watermark: 'Vendor Dashboard'
      });
      addVendorHelperMessage("Next Step: Type <strong>Pack</strong> to prepare the shipment.");
    } else if (t === 'reject') {
      omsState.status = 'IDLE';
      addApiEventCard({
        evClass: 'ev-cancelled',
        icon: 'cancel',
        title: '❌ ORDER REJECTED',
        body: `Order ${omsState.orderNum} has been cancelled by Vendor.<br>Inventory unlocked.`,
        watermark: 'Vendor Dashboard'
      });
      setTimeout(triggerNewOrder, 2500);
    } else {
      addVendorHelperMessage("Pending action: <strong>Accept</strong> or <strong>Reject</strong> order.");
    }
    return;
  }

  if (omsState.status === 'PACKING') {
    if (t === 'pack' || t === 'proceed') {
      omsState.status = 'SHIPPING';
      const weight = (0.5 + Math.random() * 2).toFixed(1);
      addApiEventCard({
        evClass: 'ev-transit', // amber
        icon: 'inventory_2',
        title: '📦 PACKAGING COMPLETE',
        body: `🏷️ <strong>Label:</strong> Printed for ${omsState.customer}.<br>⚖️ <strong>Weight:</strong> ${weight} kg<br>⚠️ <strong>Pending:</strong> Ready for logistics handover.`,
        watermark: 'Vendor Dashboard'
      });
      addVendorHelperMessage("Next Step: Type <strong>Ship</strong> to assign a delivery agent.");
    } else {
      addVendorHelperMessage("Pending action: Type <strong>Pack</strong> to seal the order.");
    }
    return;
  }

  if (omsState.status === 'SHIPPING') {
    if (t === 'ship' || t === 'proceed') {
      omsState.status = 'IDLE';
      const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const trackingId = 'KA-' + (10000 + Math.floor(Math.random() * 89999));
      addApiEventCard({
        evClass: 'ev-location', // blue
        icon: 'local_shipping',
        title: '🚚 SHIPMENT INITIATED',
        body: `👮 <strong>Delivery Agent:</strong> ${agent} (Shadowfax) has picked up the item.<br>📍 <strong>Tracking ID:</strong> ${trackingId}`,
        watermark: 'Vendor Dashboard'
      });
      setTimeout(triggerNewOrder, 4000);
    } else {
      addVendorHelperMessage("Pending action: Type <strong>Ship</strong> to dispatch the order.");
    }
    return;
  }
}

// ──────────────────────────────────────────────
// VENDOR BOT ACTIONS
// ──────────────────────────────────────────────
function addVendorHelperMessage(text) {
  const row = document.createElement('div');
  row.className = 'msg-row incoming';
  row.innerHTML = `
    <div class="msg-bubble incoming" style="background:#1e2a30; border:1px dashed #3a4a50;">
      <div class="bot-label" style="color:#f59e0b;">⚙️ System Prompt</div>
      <p class="msg-text">${text}</p>
      <div class="msg-meta"><span class="msg-time">${nowTime()}</span></div>
    </div>`;
  messagesArea.appendChild(row);
  scrollBottom();
}

function triggerNewOrder() {
  if (activeChat !== 'vendor') switchToVendorChat();

  // 20% exception hook
  if (Math.random() < 0.20) {
    omsState.status = 'EXCEPTION_RETURN';
    addApiEventCard({
      evClass: 'ev-cancelled', // red
      icon: 'sync_problem',
      title: '↩️ RETURN REQUEST',
      body: `Customer reports "Damaged Product" for previous order.<br><strong>Action Required:</strong> Type <strong>Approve Return</strong> or <strong>Deny</strong>.`,
      watermark: 'Vendor Dashboard'
    });
    return;
  }

  generateRandomOrder();
  omsState.status = 'NEW_ORDER';

  const card = document.createElement('div');
  card.className = 'order-confirm-card';
  card.innerHTML = `
    <div class="occ-header" style="background:#1e150a;border-bottom-color:#f59e0b20;">
      <span class="material-icons-round" style="color:#f59e0b;font-size:22px;">notifications_active</span>
      <span class="occ-header-title">🔔 NEW ORDER RECEIVED</span>
    </div>
    <div class="occ-body">
      <div class="occ-row"><span class="occ-label">Order ID</span><span class="occ-val occ-order-num" style="color:#f59e0b;">${omsState.orderNum}</span></div>
      <div class="occ-row"><span class="occ-label">Item</span><span class="occ-val">${omsState.product}</span></div>
      <div class="occ-row"><span class="occ-label">Qty</span><span class="occ-val">${omsState.qty}</span></div>
      <div class="occ-row"><span class="occ-label">Customer</span><span class="occ-val">${omsState.customer}</span></div>
    </div>
    <div class="occ-footer" style="background:#15110a;">
      <span class="material-icons-round" style="font-size:14px;color:#8696a0;">hourglass_empty</span>
      STATUS: Awaiting Vendor Action
    </div>
    <div class="occ-time">${nowTime()}</div>`;

  // Change the left border color for new orders to match the amber theme
  card.style.borderLeftColor = '#f59e0b';
  messagesArea.appendChild(card);
  scrollBottom();

  setTimeout(() => {
    const row = document.createElement('div');
    row.className = 'msg-row incoming';
    row.innerHTML = `
      <div class="msg-bubble incoming">
        <p class="msg-text">What would you like to do?</p>
        <div style="margin-top:8px;display:flex;gap:5px;">
          <div class="order-hint" onclick="fillInput('Accept')" style="border-color:#f59e0b50; color:#fcd34d;">✅ Accept</div>
          <div class="order-hint" onclick="fillInput('Reject')">❌ Reject</div>
        </div>
        <div class="msg-meta"><span class="msg-time">${nowTime()}</span></div>
      </div>`;
    messagesArea.appendChild(row);
    scrollBottom();
  }, 600);
}

// ──────────────────────────────────────────────
// API EVENT CARD (Vendor Dashboard & Workshops)
// ──────────────────────────────────────────────
function addApiEventCard({ evClass, icon, title, body, watermark }) {
  const el = document.createElement('div');
  el.className = `api-event ${evClass}`;
  el.innerHTML = `
    <div class="api-event-header">
      <div class="api-event-icon">
        <span class="material-icons-round" style="font-size:18px;">${icon}</span>
      </div>
      <span class="api-event-title">${title}</span>
    </div>
    <div class="api-event-body">${body}</div>
    <div class="api-event-footer">
      <span class="api-event-time">${nowTime()}</span>
      <span class="api-event-watermark">
        <span class="material-icons-round" style="font-size:12px;">verified</span>
        ${watermark || 'WhatsApp Cloud API'}
      </span>
    </div>`;
  messagesArea.appendChild(el);
  scrollBottom();
}


function switchToVendorChat() {
  activeChat = 'vendor';
  headerAvatar.className = 'chat-avatar vendor-avatar';
  headerAvatar.innerHTML = `<span class="material-icons-round" style="font-size:24px;color:#f59e0b;">storefront</span>`;
  headerName.textContent = 'Parivartan Vendor';
  headerSub.textContent = '🟡 Delivering – Birmingham Shikhar Hostel';
  headerSub.style.color = '#f59e0b';

  messagesArea.innerHTML = `<div class="date-separator"><span>Today</span></div>`;
  chatHistory.vendor.forEach(msg => {
    if (msg.type === 'incoming') addVendorMessage(msg.text, msg.time);
    else addPreloadedOutgoing(msg.text, msg.time);
  });
  scrollBottom();
}

// ── Interactive Workshop API Chat ──
let workshopState = {
  status: 'IDLE', // IDLE | PENDING
  user: null,
  workshop: null,
  day: null
};

function switchToWorkshopsChat() {
  activeChat = 'workshops';
  headerAvatar.className = 'chat-avatar orders-avatar';
  headerAvatar.innerHTML = `<span class="material-icons-round" style="font-size:24px;color:#0ea5e9;">auto_awesome</span>`;
  headerName.innerHTML = 'Heritage Workshops <span class="biz-verified" title="Official Business" style="color:#0ea5e9;">✓</span>';
  headerSub.innerHTML = '<span class="biz-badge" style="background:rgba(14,165,233,0.15);color:#0ea5e9;">⚡ Interactive Booking Engine Active</span>';
  headerSub.style.color = '#0ea5e9';

  messagesArea.innerHTML = `<div class="date-separator"><span>Today</span></div>`;
  scrollBottom();

  if (workshopState.status === 'IDLE') {
    triggerWorkshopRequest();
  }
}

async function triggerWorkshopRequest() {
  const WORKSHOPS = [
    '🎨 Mysore Painting (3 Hrs)',
    '🧵 Saree Tassel Making (2 Hrs)',
    '🏺 Clay Pottery (1 Hour)'
  ];
  const DAYS = ['Friday 02:00 PM', 'Saturday 10:00 AM', 'Sunday 11:30 AM', 'Wednesday 10:00 AM'];
  const USERS = [
    { name: 'Rahul S.', phone: '+91 98450 12345' },
    { name: 'Ananya K.', phone: '+91 97312 98765' },
    { name: 'Vikram M.', phone: '+91 99887 66554' },
    { name: 'Deepika R.', phone: '+91 96123 45678' }
  ];

  workshopState.user = USERS[Math.floor(Math.random() * USERS.length)];
  workshopState.workshop = WORKSHOPS[Math.floor(Math.random() * WORKSHOPS.length)];
  workshopState.day = DAYS[Math.floor(Math.random() * DAYS.length)];
  workshopState.status = 'PENDING';

  // 1: Inbound Trigger (Replaced with Interactive Booking Request Card)
  const id = `booking-${Date.now()}`;

  const cardHTML = `
    <div class="booking-card" id="${id}">
      <div class="booking-header">
        <div class="booking-icon-wrapper">
          <span class="material-icons-round">calendar_month</span>
        </div>
        <span class="booking-title">New Booking Request</span>
      </div>
      <div class="booking-body">
        <div class="booking-detail">
          <span class="material-icons-round" style="font-size:16px;color:#8696a0;">person</span>
          <span><strong>Customer:</strong> ${workshopState.user.name}</span>
        </div>
        <div class="booking-detail">
          <span class="material-icons-round" style="font-size:16px;color:#8696a0;">event</span>
          <span><strong>Time:</strong> ${workshopState.day}</span>
        </div>
        <div class="booking-detail">
          <span class="material-icons-round" style="font-size:16px;color:#8696a0;">tour</span>
          <span><strong>Service:</strong> ${workshopState.workshop}</span>
        </div>
        <div class="booking-status-badge">Pending Action</div>
      </div>
      <div class="booking-actions" id="actions-${id}">
        <button class="btn-primary" onclick="handleBookingAction('${id}', 'accept')">Accept & Confirm</button>
        <button class="btn-outline" onclick="handleBookingAction('${id}', 'reject')">Reject</button>
      </div>
      <div class="booking-result" id="result-${id}" style="display:none;">
        <!-- Success/Error content injected here -->
      </div>
    </div>
  `;

  const row = document.createElement('div');
  row.className = 'msg-row incoming';
  row.innerHTML = `
    <div class="msg-bubble incoming" style="background:transparent; pading:0; box-shadow:none;">
      ${cardHTML}
      <div class="msg-meta" style="justify-content:flex-start; margin-left:12px;"><span class="msg-time">${nowTime()}</span></div>
    </div>`;

  messagesArea.appendChild(row);
  scrollBottom();
}

window.handleBookingAction = async function (id, action) {
  const actionsDiv = document.getElementById(`actions-${id}`);
  const resultDiv = document.getElementById(`result-${id}`);
  const cardDiv = document.getElementById(id);

  // Immeditate feedback: Hide buttons
  actionsDiv.style.display = 'none';
  resultDiv.style.display = 'flex';

  if (action === 'accept') {
    workshopState.status = 'IDLE';
    cardDiv.classList.add('state-accepted');
    resultDiv.innerHTML = `
      <span class="material-icons-round result-icon" style="color:#22c55e;">check_circle</span>
      <span class="result-text" style="color:#22c55e;">Booking Confirmed! ✅</span>
    `;
    showToast(`Confirmation sent to ${workshopState.user.name} via WhatsApp.`);

    // Simulate subsequent messages
    await delay(1500);
    const shortName = workshopState.workshop.split('(')[0].trim();
    const shortDay = workshopState.day.split(' ')[0].trim();
    addApiEventCard({
      evClass: 'ev-placed',
      icon: 'rocket_launch',
      title: '🚀 API RESPONSE: 200 OK',
      body: `📩 <strong>Sent Template:</strong> <em>booking_confirmed</em><br><br>"Hello ${workshopState.user.name}! 👋 Your booking is confirmed for <strong>${shortName}</strong>. See you on ${shortDay}! 🎟️"`,
      watermark: 'Message Dispatched'
    });
    setTimeout(triggerWorkshopRequest, 3000);

  } else {
    workshopState.status = 'IDLE';
    cardDiv.classList.add('state-rejected');
    resultDiv.innerHTML = `
      <span class="material-icons-round result-icon" style="color:#ef4444;">cancel</span>
      <span class="result-text" style="color:#ef4444;">Slots Not Available ❌</span>
    `;
    showToast(`Availability updated. Customer notified.`);

    // Simulate subsequent messages
    await delay(1500);
    addApiEventCard({
      evClass: 'ev-cancelled',
      icon: 'cancel',
      title: '❌ BOOKING REJECTED',
      body: `Booking for ${workshopState.user.name} has been rejected.<br><strong>Slots not available.</strong>`,
      watermark: 'Interactive Engine'
    });
    setTimeout(triggerWorkshopRequest, 3000);
  }
};

function showToast(message) {
  let toastContainer = document.getElementById('global-toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'global-toast-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'custom-toast';
  toast.innerText = message;
  toastContainer.appendChild(toast);

  // Trigger reflow for animation
  void toast.offsetWidth;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

async function handleWorkshopInput(rawText) {
  const t = rawText.trim().toLowerCase();

  if (workshopState.status === 'IDLE') {
    if (t === 'start' || t === 'proceed' || t === 'next') {
      triggerWorkshopRequest();
    } else {
      const row = document.createElement('div');
      row.className = 'msg-row incoming';
      row.innerHTML = `
        <div class="msg-bubble incoming" style="background:#1e2a30; border:1px dashed #3a4a50;">
          <div class="bot-label" style="color:#0ea5e9;">⚙️ System Prompt</div>
          <p class="msg-text">System IDLE. Type <strong>Start</strong> to fetch the next booking request.</p>
          <div class="msg-meta"><span class="msg-time">${nowTime()}</span></div>
        </div>`;
      messagesArea.appendChild(row);
      scrollBottom();
    }
    return;
  }

  if (workshopState.status === 'PENDING') {
    if (t === 'accept' || t === 'proceed') {
      workshopState.status = 'IDLE';

      addApiEventCard({
        evClass: 'ev-transit', // Amber accent
        icon: 'bolt',
        title: '⚙️ PROCESSING BOOKING...',
        body: `<em>Securing slot for ${workshopState.user.name}...</em><br>✅ <strong>BOOKING CONFIRMED.</strong>`,
        watermark: 'Interactive Engine'
      });

      alert('Booking Confirmed');

      await delay(1200);
      if (activeChat !== 'workshops') return;

      const shortName = workshopState.workshop.split('(')[0].trim();
      const shortDay = workshopState.day.split(' ')[0].trim();
      addApiEventCard({
        evClass: 'ev-placed', // Green accent
        icon: 'rocket_launch',
        title: '🚀 API RESPONSE: 200 OK',
        body: `📩 <strong>Sent Template:</strong> <em>booking_confirmed</em><br><br>"Hello ${workshopState.user.name}! 👋 Your booking is confirmed for <strong>${shortName}</strong>. See you on ${shortDay}! 🎟️"`,
        watermark: 'Message Dispatched'
      });

      setTimeout(triggerWorkshopRequest, 3000);

    } else if (t === 'reject') {
      workshopState.status = 'IDLE';

      alert('Slots not available');

      addApiEventCard({
        evClass: 'ev-cancelled',
        icon: 'cancel',
        title: '❌ BOOKING REJECTED',
        body: `Booking for ${workshopState.user.name} has been rejected.<br><strong>Slots not available.</strong>`,
        watermark: 'Interactive Engine'
      });
      setTimeout(triggerWorkshopRequest, 2500);
    } else {
      const row = document.createElement('div');
      row.className = 'msg-row incoming';
      row.innerHTML = `
        <div class="msg-bubble incoming" style="background:#1e2a30; border:1px dashed #3a4a50;">
          <div class="bot-label" style="color:#0ea5e9;">⚙️ System Prompt</div>
          <p class="msg-text">Pending action: <strong>Accept</strong> or <strong>Reject</strong> booking.</p>
          <div class="msg-meta"><span class="msg-time">${nowTime()}</span></div>
        </div>`;
      messagesArea.appendChild(row);
      scrollBottom();
    }
  }
}

// ──────────────────────────────────────────────
// OFFLINE MANAGER CHAT (Local Vendor Tools)
// ──────────────────────────────────────────────
let offlineManagerState = {
  status: 'IDLE', // IDLE | AWAITING_AMOUNT | AWAITING_ITEM
  shopStatus: 'CLOSED', // OPEN | CLOSED
  todaySales: 0,
  itemsSold: 0
};

function switchToOfflineManagerChat() {
  activeChat = 'offlineManager';
  headerAvatar.className = 'chat-avatar';
  headerAvatar.innerHTML = `<span class="material-icons-round" style="font-size:24px;color:#fff;">point_of_sale</span>`;
  headerAvatar.style.background = '#555';
  headerName.innerHTML = 'Offline Manager <span class="biz-verified" title="Internal Bot" style="background:#555;color:#fff;">✓</span>';
  headerSub.textContent = '🤖 Internal Tools';
  headerSub.style.color = '#fff';

  messagesArea.innerHTML = `<div class="date-separator"><span>Today</span></div>`;
  scrollBottom();
  renderOfflineManagerDashboard();
}

function renderOfflineManagerDashboard() {
  const mapStr = offlineManagerState.shopStatus === 'CLOSED' ? '🔴 CLOSED' : '🟢 OPEN';
  addBotMessage(`
    <div style="background:#1e2a30; border:1px solid #3a4a50; border-radius:10px; padding:12px;">
      <p class="msg-text" style="font-size:16px; margin-bottom:10px;">🏪 <strong>MY SHOP DASHBOARD</strong></p>
      <div style="background:rgba(0,0,0,0.15); padding:10px; border-radius:8px; margin-bottom:12px;">
        <p class="msg-text">📊 <strong>Today's Sales:</strong> ₹${offlineManagerState.todaySales.toLocaleString()}</p>
        <p class="msg-text" style="margin-top:6px;">🗺️ <strong>Map Status:</strong> ${mapStr}</p>
      </div>
      <p class="msg-text" style="font-size:13px; color:#8696a0; margin-bottom:6px;">Reply with a number:</p>
      <div style="display:flex; flex-direction:column; gap:6px;">
        <div class="msg-text"><strong>1️⃣ SOLD</strong> (Record Cash Sale)</div>
        <div class="msg-text"><strong>2️⃣ ADD</strong> (Add New Product)</div>
        <div class="msg-text"><strong>3️⃣ OPEN</strong> (Go Live on Map)</div>
        <div class="msg-text"><strong>4️⃣ CLOSED</strong> (End Day & Report)</div>
      </div>
    </div>
  `, 200);
}

function handleOfflineManagerInput(rawText) {
  const t = rawText.trim().toLowerCase();

  if (offlineManagerState.status === 'IDLE') {
    if (t === '1' || t === 'sold') {
      offlineManagerState.status = 'AWAITING_AMOUNT';
      addBotMessage(`<p class="msg-text">💰 <strong>Enter amount received (₹):</strong></p>`);
    } else if (t === '2' || t === 'add') {
      offlineManagerState.status = 'AWAITING_ITEM';
      addBotMessage(`<p class="msg-text">📸 <strong>What are you adding? (Type Name):</strong></p>`);
    } else if (t === '3' || t === 'open') {
      offlineManagerState.shopStatus = 'OPEN';
      addBotMessage(`<p class="msg-text">📢 <strong>SHOP IS LIVE!</strong> Notification sent to 14 tourists nearby. Good luck!</p>`);
      setTimeout(renderOfflineManagerDashboard, 2000);
    } else if (t === '4' || t === 'closed') {
      offlineManagerState.shopStatus = 'CLOSED';
      addBotMessage(`
        <div style="background:#1e2a30; border:1px solid #5a1a1a; border-radius:10px; padding:12px;">
          <p class="msg-text">🌙 <strong>SHOP CLOSED</strong></p>
          <div style="margin-top:10px;">
            <p class="msg-text">💵 <strong>Final Total:</strong> ₹${offlineManagerState.todaySales.toLocaleString()}</p>
            <p class="msg-text" style="margin-top:6px;">📈 <strong>Items Sold:</strong> ${offlineManagerState.itemsSold}</p>
          </div>
        </div>
      `);
      // Reset for next day
      offlineManagerState.todaySales = 0;
      offlineManagerState.itemsSold = 0;
    } else {
      addBotMessage(`<p class="msg-text">Please reply with <strong>1, 2, 3, or 4</strong>.</p>`);
    }
    return;
  }

  if (offlineManagerState.status === 'AWAITING_AMOUNT') {
    const amt = parseInt(t.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(amt)) {
      offlineManagerState.todaySales += amt;
      offlineManagerState.itemsSold += 1;
      addBotMessage(`<p class="msg-text">✅ <strong>Sale Recorded!</strong> New Total: ₹${offlineManagerState.todaySales.toLocaleString()}</p>`);
      offlineManagerState.status = 'IDLE';
      setTimeout(renderOfflineManagerDashboard, 2000);
    } else {
      addBotMessage(`<p class="msg-text">Please type a valid amount (e.g., 500).</p>`);
    }
    return;
  }

  if (offlineManagerState.status === 'AWAITING_ITEM') {
    if (t.length > 0) {
      addBotMessage(`<p class="msg-text">✅ <strong>${rawText}</strong> added to your digital catalog! Tourists can now see it.</p>`);
      offlineManagerState.status = 'IDLE';
      setTimeout(renderOfflineManagerDashboard, 2000);
    } else {
      addBotMessage(`<p class="msg-text">Please type a valid item name.</p>`);
    }
    return;
  }
}

// ──────────────────────────────────────────────
// CHAT ITEM CLICK
// ──────────────────────────────────────────────
document.querySelectorAll('.chat-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    const chatType = item.dataset.chat;
    if (chatType === 'vendor') switchToVendorChat();
    else if (chatType === 'bot') switchToBotChat();
    else if (chatType === 'notifications') switchToNotificationsChat();
    else if (chatType === 'workshops') switchToWorkshopsChat();
    else if (chatType === 'offlineManager') switchToOfflineManagerChat();
  });
});

// ──────────────────────────────────────────────
// PLUS MENU
// ──────────────────────────────────────────────
function closePlusMenu() { plusMenu.classList.remove('open'); }

plusBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  plusMenu.classList.toggle('open');
});

onboardingTrigger.addEventListener('click', () => triggerOnboarding());

document.addEventListener('click', (e) => {
  if (!plusMenu.contains(e.target) && e.target !== plusBtn) closePlusMenu();
});

// ──────────────────────────────────────────────
// INPUT BAR
// ──────────────────────────────────────────────
chatInput.addEventListener('input', () => {
  sendBtn.querySelector('.material-icons-round').textContent =
    chatInput.value.trim() ? 'send' : 'mic';
});

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && chatInput.value.trim()) sendUserTyped();
});

sendBtn.addEventListener('click', () => {
  if (chatInput.value.trim()) sendUserTyped();
});

async function sendUserTyped() {
  const text = chatInput.value.trim();
  chatInput.value = '';
  sendBtn.querySelector('.material-icons-round').textContent = 'mic';
  addUserMessage(text);

  if (activeChat === 'vendor') {
    await delay(600);
    handleVendorInput(text);
  } else if (activeChat === 'notifications') {
    await delay(600);
    handleNotificationInput(text);
  } else if (activeChat === 'workshops') {
    await delay(600);
    handleWorkshopInput(text);
  } else if (activeChat === 'offlineManager') {
    await delay(600);
    handleOfflineManagerInput(text);
  } else {
    await delay(800);
    await addBotMessage(`<p class="msg-text">Use the <strong>➕ Plus icon</strong> to access onboarding or click <strong>Order Track</strong> to track your delivery.</p>`);
  }
}

// ──────────────────────────────────────────────
// FILE UPLOAD
// ──────────────────────────────────────────────
fileInput.addEventListener('change', async (e) => {
  if (!e.target.files || !e.target.files[0]) return;
  const file = e.target.files[0];
  const type = currentUploadCallback;
  fileInput.value = '';

  vendorData.verification[type === 'id' ? 'idProof' : type === 'productPhoto' ? 'photos' : 'license'] = true;
  if (type === 'productPhoto') vendorData.inventory.photos = true;

  addUserMessage(`📎 ${file.name} (${(file.size / 1024).toFixed(0)} KB)`);

  await addBotMessage(`
    <p class="msg-text">⬆️ Uploading <strong>${file.name}</strong>…</p>
    <div class="upload-progress"><div class="progress-bar-bg"><div class="progress-bar-fill"></div></div></div>
  `);
  await delay(1600);
  await addBotMessage(`
    <div class="success-chip"><span class="material-icons-round" style="font-size:18px;color:#00a884;">check_circle</span> <strong>${file.name}</strong> uploaded!</div>
    <p class="msg-text" style="margin-top:8px;color:#8696a0;font-size:13px;">✅ Document verified and saved securely.</p>
    ${checkVerificationProgress()}
  `);
  updateChatPreview('Document uploaded & verified ✅');
  checkOnboardingComplete();
});

// ──────────────────────────────────────────────
// BOT WELCOME FLOW
// ──────────────────────────────────────────────
async function startWelcomeFlow() {
  await addBotMessage(`
    <p class="msg-text">👋 <strong>Welcome to Parivartan Vendor Platform!</strong></p>
    <p class="msg-text" style="margin-top:6px;color:#8696a0;font-size:13px;">I'll help you register, verify, and launch your digital storefront — all right here in chat.</p>
  `, 400);

  await addBotMessage(`
    <p class="msg-text">To get started, click the <strong>➕ Plus icon</strong> below and select an option.</p>
    <div class="quick-replies" style="margin-top:10px;">
      <button class="qr-btn" onclick="triggerOnboarding()">🚀 Start Onboarding</button>
      <button class="qr-btn" onclick="showAPIInfo()">☁️ Cloud API Info</button>
    </div>
  `, 1200);

  updateChatPreview('Welcome! Complete your onboarding 🚀');
}

// ──────────────────────────────────────────────
// ONBOARDING FLOWS
// ──────────────────────────────────────────────
async function triggerOnboarding() {
  closePlusMenu();
  disableAllQR();
  addUserMessage('🚀 Start Onboarding');
  await delay(300);
  await addBotMessage(`
    <p class="msg-text">✅ <strong>Great! Let's complete your onboarding.</strong></p>
    <p class="msg-text" style="margin-top:6px;color:#8696a0;font-size:13px;">Please select a section to begin:</p>
    <div class="quick-replies" style="margin-top:12px;">
      <button class="qr-btn" onclick="openVerification()">✅ Verification</button>
      <button class="qr-btn" onclick="openLocation()">📍 Location</button>
      <button class="qr-btn" onclick="openInventory()">📦 Inventory</button>
    </div>
  `);
}

// ── VERIFICATION ──
async function openVerification() {
  disableAllQR(); addUserMessage('✅ Verification'); await delay(300);
  await addBotMessage(`
    <p class="msg-text">🔐 <strong>Verification</strong></p>
    <p class="msg-text" style="margin-top:6px;color:#8696a0;font-size:13px;">Complete all three verification steps:</p>
    <div class="sub-replies">
      <button class="sub-btn" onclick="doUpload('id', this)">
        <span class="material-icons-round sub-icon">badge</span>
        <div><strong>Upload ID Proof</strong><br><span style="font-size:12px;color:#8696a0">Aadhaar, PAN, Passport, Voter ID</span></div>
        <span class="material-icons-round" style="margin-left:auto;color:#8696a0;font-size:18px;">chevron_right</span>
      </button>
      <button class="sub-btn" onclick="doBizVerify(this)">
        <span class="material-icons-round sub-icon">store</span>
        <div><strong>Business / Vendor Verification</strong><br><span style="font-size:12px;color:#8696a0">GST, Shop Registration, Trade License</span></div>
        <span class="material-icons-round" style="margin-left:auto;color:#8696a0;font-size:18px;">chevron_right</span>
      </button>
      <button class="sub-btn" onclick="doUpload('license', this)">
        <span class="material-icons-round sub-icon">description</span>
        <div><strong>License Upload</strong><br><span style="font-size:12px;color:#8696a0">FSSAI, Tourism, Local Body License</span></div>
        <span class="material-icons-round" style="margin-left:auto;color:#8696a0;font-size:18px;">chevron_right</span>
      </button>
    </div>
  `);
}

async function doUpload(type, btn) {
  btn.classList.add('disabled');
  const labels = { id: 'ID Proof', license: 'License Document', productPhoto: 'Product Photos' };
  const icons = { id: 'badge', license: 'description', productPhoto: 'add_photo_alternate' };
  const title = labels[type] || 'Document';
  const icon = icons[type] || 'upload';
  addUserMessage(`📎 Upload ${title}`);
  await addBotMessage(`
    <p class="msg-text">📎 Please upload your <strong>${title}</strong>:</p>
    <div class="upload-area" onclick="triggerFileUpload('${type}')">
      <span class="material-icons-round" style="font-size:36px;color:#00a884;display:block;margin-bottom:6px;">${icon}</span>
      <strong style="color:#e9edef;font-size:13.5px;">Tap to upload file</strong>
      <p>Supported: JPG, PNG, PDF (max 10MB)</p>
    </div>
  `);
}

function triggerFileUpload(type) { currentUploadCallback = type; fileInput.click(); }

async function doBizVerify(btn) {
  btn.classList.add('disabled'); addUserMessage('🏪 Business / Vendor Verification');
  await addBotMessage(`
    <p class="msg-text">🏪 <strong>Business Verification</strong></p>
    <div class="inv-form">
      <input class="inv-input" id="bizName" placeholder="Business / Shop Name" />
      <input class="inv-input" id="bizGST" placeholder="GST Number (optional)" />
      <input class="inv-input" id="bizPhone" placeholder="Registered Phone Number" />
      <button class="submit-btn" onclick="submitBizVerify()">✅ Submit for Verification</button>
    </div>
  `);
}

async function submitBizVerify() {
  const name = document.getElementById('bizName')?.value?.trim();
  const phone = document.getElementById('bizPhone')?.value?.trim();
  if (!name || !phone) { alert('Please fill in Business Name and Phone.'); return; }
  vendorData.verification.bizVerify = true;
  addUserMessage(`🏪 ${name} | ${phone}`);
  await addBotMessage(`
    <div class="success-chip"><span class="material-icons-round" style="font-size:18px;color:#00a884;">verified</span> Business <strong>${name}</strong> verified!</div>
    ${checkVerificationProgress()}
  `);
  checkOnboardingComplete();
}

function checkVerificationProgress() {
  const v = vendorData.verification;
  const done = [v.idProof, v.bizVerify, v.license].filter(Boolean).length;
  if (done === 3) return `<p class="msg-text" style="margin-top:8px;color:#00a884;font-weight:600;">🎉 All verification steps complete!</p>`;
  return `<p class="msg-text" style="margin-top:8px;color:#8696a0;font-size:13px;">${3 - done} verification step(s) remaining.</p>`;
}

// ── LOCATION ──
async function openLocation() {
  disableAllQR(); addUserMessage('📍 Location'); await delay(300);
  await addBotMessage(`
    <p class="msg-text">📍 <strong>Location Setup</strong></p>
    <div class="sub-replies">
      <button class="sub-btn" onclick="doLiveLocation(this)">
        <span class="material-icons-round sub-icon">my_location</span>
        <div><strong>Share Live Location</strong><br><span style="font-size:12px;color:#8696a0">Real-time GPS</span></div>
        <span class="material-icons-round" style="margin-left:auto;color:#8696a0;font-size:18px;">chevron_right</span>
      </button>
      <button class="sub-btn" onclick="doShopLocation(this)">
        <span class="material-icons-round sub-icon">storefront</span>
        <div><strong>Select Shop / Stall Location</strong><br><span style="font-size:12px;color:#8696a0">Pin your stall</span></div>
        <span class="material-icons-round" style="margin-left:auto;color:#8696a0;font-size:18px;">chevron_right</span>
      </button>
      <button class="sub-btn" onclick="doTouristMapping(this)">
        <span class="material-icons-round sub-icon">tour</span>
        <div><strong>Tourist Spot Mapping</strong><br><span style="font-size:12px;color:#8696a0">Link nearby attractions</span></div>
        <span class="material-icons-round" style="margin-left:auto;color:#8696a0;font-size:18px;">chevron_right</span>
      </button>
    </div>
  `);
}

async function doLiveLocation(btn) {
  btn.classList.add('disabled'); addUserMessage('📡 Share Live Location');
  await addBotMessage(`<p class="msg-text">📡 Requesting your location…</p>`);
  await delay(800);
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      vendorData.location.live = true;
      await addBotMessage(`
        <p class="msg-text">📍 <strong>Live location captured!</strong></p>
        <div class="location-card">
          <div class="location-map"><span class="material-icons-round">location_on</span></div>
          <div class="location-info"><strong>${latitude.toFixed(5)}, ${longitude.toFixed(5)}</strong><span>Your current GPS coordinates</span></div>
        </div>
        <div class="success-chip" style="margin-top:8px;"><span class="material-icons-round" style="font-size:18px;">check_circle</span> Location saved</div>
      `);
      checkOnboardingComplete();
    }, async () => { await simulatedLocation('Live Location', 12.9716, 77.5946); });
  } else { await simulatedLocation('Live Location', 12.9716, 77.5946); }
}

async function doShopLocation(btn) {
  btn.classList.add('disabled'); addUserMessage('🏪 Select Shop Location');
  await addBotMessage(`
    <p class="msg-text">🏪 <strong>Shop / Stall Location</strong></p>
    <div class="inv-form">
      <input class="inv-input" id="shopAddr" placeholder="Shop Name / Address" />
      <input class="inv-input" id="shopArea" placeholder="Area / Landmark" />
      <input class="inv-input" id="shopCity" placeholder="City" />
      <button class="submit-btn" onclick="submitShopLocation()">📍 Pin Location</button>
    </div>
  `);
}

async function submitShopLocation() {
  const addr = document.getElementById('shopAddr')?.value?.trim();
  const city = document.getElementById('shopCity')?.value?.trim();
  if (!addr || !city) { alert('Please fill Shop Name and City.'); return; }
  vendorData.location.shop = true;
  addUserMessage(`📍 ${addr}, ${city}`);
  await simulatedLocation(`${addr}, ${city}`, 12.9716, 77.5946);
  checkOnboardingComplete();
}

async function doTouristMapping(btn) {
  btn.classList.add('disabled'); addUserMessage('🗺️ Tourist Spot Mapping');
  const spots = ['Mysore Palace', 'Coorg Coffee Estates', 'Hampi Ruins', 'Dandeli Forest', 'Badami Caves', 'Gokarna Beach'];
  const chips = spots.map(s => `<button class="cat-chip" onclick="selectTouristSpot(this,'${s}')">${s}</button>`).join('');
  await addBotMessage(`
    <p class="msg-text">🗺️ <strong>Tourist Spot Mapping</strong></p>
    <div class="category-chips" style="margin-top:10px;">${chips}</div>
    <button class="submit-btn" style="margin-top:12px;" onclick="submitTouristSpots()">✅ Link Spots</button>
  `);
}

function selectTouristSpot(el, name) {
  el.classList.toggle('selected');
  if (el.classList.contains('selected')) selectedSpots.push(name);
  else selectedSpots = selectedSpots.filter(s => s !== name);
}

async function submitTouristSpots() {
  if (!selectedSpots.length) { alert('Select at least one tourist spot.'); return; }
  vendorData.location.tourist = true;
  addUserMessage(`🗺️ Linked: ${selectedSpots.join(', ')}`);
  await addBotMessage(`
    <div class="success-chip"><span class="material-icons-round" style="font-size:18px;color:#00a884;">tour</span> Linked to <strong>${selectedSpots.length} tourist spot(s)</strong></div>
    <p class="msg-text" style="margin-top:8px;color:#8696a0;font-size:13px;">Near: <em>${selectedSpots.join(', ')}</em></p>
  `);
  selectedSpots = [];
  checkOnboardingComplete();
}

async function simulatedLocation(label, lat, lng) {
  vendorData.location.shop = true;
  await addBotMessage(`
    <div class="location-card">
      <div class="location-map"><span class="material-icons-round">location_on</span></div>
      <div class="location-info"><strong>${label}</strong><span>${lat.toFixed(4)}, ${lng.toFixed(4)}</span></div>
    </div>
    <div class="success-chip" style="margin-top:8px;"><span class="material-icons-round" style="font-size:18px;">check_circle</span> Location mapped</div>
  `);
}

// ── INVENTORY ──
async function openInventory() {
  disableAllQR(); addUserMessage('📦 Inventory'); await delay(300);
  await addBotMessage(`
    <p class="msg-text">📦 <strong>Inventory Management</strong></p>
    <div class="sub-replies">
      <button class="sub-btn" onclick="doUpload('productPhoto', this)">
        <span class="material-icons-round sub-icon">add_photo_alternate</span>
        <div><strong>Add Product Photos</strong></div>
        <span class="material-icons-round" style="margin-left:auto;color:#8696a0;font-size:18px;">chevron_right</span>
      </button>
      <button class="sub-btn" onclick="doProductDetails(this)">
        <span class="material-icons-round sub-icon">edit_note</span>
        <div><strong>Add Product Name & Price</strong></div>
        <span class="material-icons-round" style="margin-left:auto;color:#8696a0;font-size:18px;">chevron_right</span>
      </button>
      <button class="sub-btn" onclick="doStockAvailability(this)">
        <span class="material-icons-round sub-icon">inventory_2</span>
        <div><strong>Stock Availability</strong></div>
        <span class="material-icons-round" style="margin-left:auto;color:#8696a0;font-size:18px;">chevron_right</span>
      </button>
      <button class="sub-btn" onclick="doCategorySelection(this)">
        <span class="material-icons-round sub-icon">category</span>
        <div><strong>Category Selection</strong></div>
        <span class="material-icons-round" style="margin-left:auto;color:#8696a0;font-size:18px;">chevron_right</span>
      </button>
    </div>
  `);
}

async function doProductDetails(btn) {
  btn.classList.add('disabled'); addUserMessage('🏷️ Add Product Name & Price');
  await addBotMessage(`
    <p class="msg-text">🏷️ <strong>Add to Catalog</strong></p>
    <div class="inv-form">
      <input class="inv-input" id="prodName" placeholder="Product Name" />
      <div class="inv-row">
        <input class="inv-input" id="prodPrice" placeholder="Price (₹)" type="number" min="0"/>
        <input class="inv-input" id="prodUnit" placeholder="Unit (per pc, kg…)" />
      </div>
      <input class="inv-input" id="prodDesc" placeholder="Short Description (optional)" />
      <button class="submit-btn" onclick="submitProduct()">➕ Add to Catalog</button>
    </div>
  `);
}

async function submitProduct() {
  const name = document.getElementById('prodName')?.value?.trim();
  const price = document.getElementById('prodPrice')?.value?.trim();
  const unit = document.getElementById('prodUnit')?.value?.trim() || 'pc';
  if (!name || !price) { alert('Fill Product Name and Price.'); return; }
  vendorData.inventory.products.push({ name, price, unit });
  vendorData.inventory.photos = true;
  addUserMessage(`🏷️ ${name} – ₹${price}/${unit}`);
  await addBotMessage(`
    <div class="success-chip"><span class="material-icons-round" style="font-size:18px;color:#00a884;">check_circle</span> <strong>${name}</strong> added – ₹${price}/${unit}</div>
    <p class="msg-text" style="margin-top:6px;color:#8696a0;font-size:13px;">Total ${vendorData.inventory.products.length} product(s) in catalog.</p>
    <div class="quick-replies"><button class="qr-btn" onclick="doProductDetailsAgain()">➕ Add Another</button></div>
  `);
  checkOnboardingComplete();
}

async function doProductDetailsAgain() {
  disableAllQR(); addUserMessage('➕ Add Another Product');
  await addBotMessage(`
    <p class="msg-text">🏷️ <strong>Add Another Product</strong></p>
    <div class="inv-form">
      <input class="inv-input" id="prodName" placeholder="Product Name" />
      <div class="inv-row">
        <input class="inv-input" id="prodPrice" placeholder="Price (₹)" type="number" min="0"/>
        <input class="inv-input" id="prodUnit" placeholder="Unit" />
      </div>
      <input class="inv-input" id="prodDesc" placeholder="Short Description (optional)" />
      <button class="submit-btn" onclick="submitProduct()">➕ Add to Catalog</button>
    </div>`);
}

async function doStockAvailability(btn) {
  btn.classList.add('disabled'); addUserMessage('📊 Stock Availability');
  await addBotMessage(`
    <p class="msg-text">📊 <strong>Stock Status</strong></p>
    <div class="inv-form">
      <input class="inv-input" id="stockQty" placeholder="Total stock quantity" type="number" min="0"/>
      <select class="inv-input" id="stockStatus" style="cursor:pointer;">
        <option value="">— Availability Status —</option>
        <option>✅ In Stock</option><option>⚠️ Limited Stock</option>
        <option>📅 Pre-Order</option><option>❌ Out of Stock</option>
      </select>
      <button class="submit-btn" onclick="submitStock()">✅ Save Stock Info</button>
    </div>
  `);
}

async function submitStock() {
  const qty = document.getElementById('stockQty')?.value?.trim();
  const status = document.getElementById('stockStatus')?.value;
  if (!qty || !status) { alert('Fill stock qty and status.'); return; }
  vendorData.inventory.stock = true;
  addUserMessage(`📊 ${status} · ${qty} units`);
  await addBotMessage(`<div class="success-chip"><span class="material-icons-round" style="font-size:18px;color:#00a884;">inventory_2</span> Stock: <strong>${qty} units – ${status}</strong></div>`);
  checkOnboardingComplete();
}

async function doCategorySelection(btn) {
  btn.classList.add('disabled'); addUserMessage('🏷️ Category Selection');
  const cats = ['🧵 Handicrafts', '🍎 Organic Food', '🌿 Herbs & Spices', '🧴 Skincare', '🏺 Pottery', '🎁 Souvenirs', '👗 Textiles', '🍫 Sweets', '📿 Jewellery', '🌺 Flowers'];
  const chips = cats.map(c => `<button class="cat-chip" onclick="this.classList.toggle('selected')">${c}</button>`).join('');
  await addBotMessage(`
    <p class="msg-text">🏷️ <strong>Category Selection</strong></p>
    <div class="category-chips">${chips}</div>
    <button class="submit-btn" style="margin-top:12px;" onclick="submitCategory()">✅ Save Categories</button>
  `);
}

async function submitCategory() {
  const selected = [...document.querySelectorAll('.cat-chip.selected')].map(c => c.textContent);
  if (!selected.length) { alert('Select at least one category.'); return; }
  vendorData.inventory.category = selected.join(', ');
  addUserMessage(`🏷️ ${selected.join(', ')}`);
  await addBotMessage(`
    <div class="success-chip"><span class="material-icons-round" style="font-size:18px;color:#00a884;">category</span> Categories: <strong>${selected.join(', ')}</strong></div>
  `);
  checkOnboardingComplete();
}

// ── COMPLETION ──
function checkOnboardingComplete() {
  if (completedShown) return;
  const v = vendorData.verification, l = vendorData.location, i = vendorData.inventory;
  if ((v.bizVerify || v.idProof) && (l.live || l.shop || l.tourist) && (i.photos || i.products.length > 0 || i.stock || i.category)) {
    completedShown = true;
    setTimeout(showCompletionMessage, 600);
  }
}

async function showCompletionMessage() {
  await addBotMessage(`
    <p class="msg-text" style="font-size:18px;">🎉 <strong>Onboarding Complete!</strong></p>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:10px;">
      <div class="success-chip">✅ Verification submitted</div>
      <div class="success-chip">📍 Location mapped</div>
      <div class="success-chip">📦 Inventory configured</div>
    </div>
    <div class="quick-replies" style="margin-top:14px;">
      <button class="qr-btn" onclick="viewStorefront()">🌐 View Storefront</button>
      <button class="qr-btn" onclick="showAPIInfo()">☁️ API Broadcasts</button>
    </div>
  `);
  updateChatPreview('Onboarding complete! 🎉');
}

async function viewStorefront() {
  disableAllQR(); addUserMessage('🌐 View Storefront');
  await addBotMessage(`
    <p class="msg-text">🌐 <strong>Your Digital Storefront is Live!</strong></p>
    <div style="background:#1a2c37;border:1px solid #2a4a5a;border-radius:10px;padding:14px;margin-top:10px;">
      <div style="font-size:13px;color:#8696a0;">Storefront URL</div>
      <div style="font-size:14px;color:#53bdeb;margin-top:4px;">https://parivartan.app/vendor/your-shop</div>
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
        <div class="success-chip">🛍️ Products Listed</div>
        <div class="success-chip">📍 Location Tagged</div>
        <div class="success-chip">✅ Verified</div>
      </div>
    </div>
  `);
}

async function showAPIInfo() {
  disableAllQR(); addUserMessage('☁️ Cloud API Info');
  await addBotMessage(`
    <p class="msg-text">☁️ <strong>WhatsApp Cloud API Features</strong></p>
    <div class="sub-replies">
      <div class="sub-btn" style="cursor:default;"><span class="material-icons-round sub-icon">notifications_active</span><div><strong>Automated Onboarding Notifications</strong></div></div>
      <div class="sub-btn" style="cursor:default;"><span class="material-icons-round sub-icon">shopping_bag</span><div><strong>Product Catalog Sharing</strong></div></div>
      <div class="sub-btn" style="cursor:default;"><span class="material-icons-round sub-icon">campaign</span><div><strong>Promotional Broadcasts</strong></div></div>
      <div class="sub-btn" style="cursor:default;"><span class="material-icons-round sub-icon">local_shipping</span><div><strong>Order Updates & Notifications</strong></div></div>
      <div class="sub-btn" style="cursor:default;"><span class="material-icons-round sub-icon">link</span><div><strong>Digital Storefront Links</strong></div></div>
    </div>
    <p class="msg-text" style="margin-top:10px;color:#8696a0;font-size:12.5px;">Powered by <strong>WhatsApp Cloud API (Meta)</strong></p>
  `);
}

// ──────────────────────────────────────────────
// STORE NOTIFICATIONS CHAT (WHATSAPP CLOUD API)
// ──────────────────────────────────────────────
let notificationState = {
  status: 'IDLE', // IDLE | PENDING
  orderNum: null,
  item: null,
  qty: null,
  customer: null
};

function switchToNotificationsChat() {
  activeChat = 'notifications';
  headerAvatar.className = 'chat-avatar img-avatar';
  headerAvatar.style.background = '#25d366';
  headerAvatar.innerHTML = `<span class="material-icons-round" style="color:#fff;font-size:24px;">storefront</span>`;
  headerName.innerHTML = `Store Notifications <span class="biz-verified" title="Official Business" style="font-size:12px;margin-left:3px;color:#25d366;">✓</span>`;
  headerSub.textContent = '🟢 Verified Business Account';
  headerSub.style.color = '#25d366';

  messagesArea.innerHTML = `<div class="date-separator"><span>Today</span></div>`;

  // Inform the user how to trigger the flow if it's idle
  if (notificationState.status === 'IDLE') {
    triggerNotificationOrder();
  } else {
    // If pending, just redraw the card and await input (simplified)
    renderNotificationCard();
  }
}

function triggerNotificationOrder() {
  if (activeChat !== 'notifications') return;

  notificationState.status = 'PENDING';

  const inventory = [
    '✏️ Wooden Pencil Holder (Channapatna Craft)',
    '🏺 Terracotta Water Bottle',
    '🪵 Rosewood Key Hanger',
    '🕯️ Scented Beeswax Candles (Pack of 4)'
  ];
  const names = ['Anita Sharma', 'Vikram Desai', 'Sneha Patel', 'Rahul Verma'];

  notificationState.orderNum = 'ORD-' + (2000 + Math.floor(Math.random() * 7999));
  notificationState.item = inventory[Math.floor(Math.random() * inventory.length)];
  notificationState.qty = 1 + Math.floor(Math.random() * 3);
  notificationState.customer = names[Math.floor(Math.random() * names.length)];

  renderNotificationCard();
}

function renderNotificationCard() {
  const card = document.createElement('div');
  card.className = 'msg-row incoming';
  card.innerHTML = `
    <div class="msg-bubble incoming" style="border-left: 4px solid #25d366;">
      <p class="msg-text">📱 <strong>NEW ORDER RECEIVED</strong></p>
      <hr style="border-top:1px solid #e0e0e0; margin: 8px 0;" />
      <p class="msg-text">
        🆔 <strong>Order ID:</strong> #${notificationState.orderNum}<br>
        📦 <strong>Item:</strong> ${notificationState.item}<br>
        🔢 <strong>Qty:</strong> ${notificationState.qty}<br>
        👤 <strong>Customer:</strong> ${notificationState.customer}
      </p>
      <hr style="border-top:1px solid #e0e0e0; margin: 8px 0;" />
      <p class="msg-text" style="font-size: 13px; color: #8696a0;">
        👉 <em>Vendor Action: Type "Accept" or "Reject"</em>
      </p>
      <div style="margin-top:10px;display:flex;gap:5px;">
        <div class="order-hint" onclick="fillInput('Accept')" style="color:#25d366;border-color:rgba(37,211,102,0.3)">✅ Accept</div>
        <div class="order-hint" onclick="fillInput('Reject')">❌ Reject</div>
      </div>
      <div class="msg-meta"><span class="msg-time">${nowTime()}</span></div>
    </div>`;
  messagesArea.appendChild(card);
  scrollBottom();
}

async function handleNotificationInput(rawText) {
  const t = rawText.trim().toLowerCase();

  if (notificationState.status !== 'PENDING') {
    // Ignore input if we're not waiting for a decision
    return;
  }

  if (t === 'accept') {
    notificationState.status = 'IDLE';
    addApiEventCard({
      evClass: 'ev-placed',
      icon: 'check_circle',
      title: '✅ ORDER CONFIRMED',
      body: `<strong>WhatsApp Message Sent to Customer:</strong><br><br><em>"oder shipping in process"</em>`,
      watermark: 'WhatsApp Cloud API'
    });

    // Auto-trigger next order after 3s
    setTimeout(() => {
      triggerNotificationOrder();
    }, 4500);

  } else if (t === 'reject') {
    notificationState.status = 'IDLE';
    addApiEventCard({
      evClass: 'ev-cancelled',
      icon: 'cancel',
      title: '❌ ORDER REJECTED',
      body: `⚠️ <strong>WhatsApp Message Sent to Customer:</strong><br><br><em>"Hi ${notificationState.customer}, we regret to inform you that your order for ${notificationState.item} cannot be fulfilled at this time due to stock issues. A full refund has been initiated."</em>`,
      watermark: 'WhatsApp Cloud API'
    });

    // Auto-trigger next order after 3s
    setTimeout(() => {
      triggerNotificationOrder();
    }, 4500);
  } else {
    // If not accept/reject
    const el = document.createElement('div');
    el.className = 'msg-row incoming';
    el.innerHTML = `
      <div class="msg-bubble incoming">
        <p class="msg-text">⚠️ Invalid input. Please reply with <strong>Accept</strong> or <strong>Reject</strong>.</p>
        <div class="msg-meta"><span class="msg-time">${nowTime()}</span></div>
      </div>`;
    messagesArea.appendChild(el);
    scrollBottom();
  }
}

// ── NAV BUTTONS ──
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ── FILTER TABS ──
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
  });
});

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
window.addEventListener('load', () => {
  chatBg.scrollTop = chatBg.scrollHeight;
  startWelcomeFlow();
});

// Expose globals
window.triggerOnboarding = triggerOnboarding;
window.openVerification = openVerification;
window.openLocation = openLocation;
window.openInventory = openInventory;
window.doUpload = doUpload;
window.doBizVerify = doBizVerify;
window.submitBizVerify = submitBizVerify;
window.doLiveLocation = doLiveLocation;
window.doShopLocation = doShopLocation;
window.doTouristMapping = doTouristMapping;
window.submitShopLocation = submitShopLocation;
window.submitTouristSpots = submitTouristSpots;
window.selectTouristSpot = selectTouristSpot;
window.doProductDetails = doProductDetails;
window.doProductDetailsAgain = doProductDetailsAgain;
window.submitProduct = submitProduct;
window.doStockAvailability = doStockAvailability;
window.submitStock = submitStock;
window.doCategorySelection = doCategorySelection;
window.submitCategory = submitCategory;
window.viewStorefront = viewStorefront;
window.showAPIInfo = showAPIInfo;
window.triggerFileUpload = triggerFileUpload;
window.switchToNotificationsChat = switchToNotificationsChat;
window.fillInput = fillInput;

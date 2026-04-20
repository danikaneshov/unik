import { auth, db } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { 
  collection, doc, setDoc, getDoc, updateDoc, increment, 
  addDoc, getDocs, query, orderBy, limit, where,
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentUser = null;
let currentBalance = 0;
let liveTrackerUnsubscribe = null;
let activeQR = null;

// Ext UI
const openDashboardBtn = document.getElementById('open-dashboard-btn');
const closeDashboardBtn = document.getElementById('close-dashboard-btn');
const dashboardDrawer = document.getElementById('dashboard-drawer');
const navBalanceLabel = document.getElementById('nav-balance');
const dashBalanceLabel = document.getElementById('dash-balance');

// Garage UI
const garageSaveBtn = document.getElementById('garage-save-btn');
const garageDisplay = document.getElementById('garage-display');
const garageSetup = document.getElementById('garage-setup');

// Tracker UI
const trackerSection = document.getElementById('live-tracker-section');
const trackerWashName = document.getElementById('tracker-wash-name');
const trackerBar = document.getElementById('tracker-bar');
const step0 = document.getElementById('step-0');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');

// QR UI
const userPinDisplay = document.getElementById('user-pin');
const qrcodeDiv = document.getElementById('qrcode');

// Utils
window.showToast = (message, type = 'success') => {
  let container = document.getElementById('toast-container');
  if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
};

// Modals Setup (Simplified generic)
document.getElementById('login-btn')?.addEventListener('click', () => document.getElementById('auth-modal').classList.remove('hidden', 'opacity-0'));
document.getElementById('close-modal-btn')?.addEventListener('click', () => document.getElementById('auth-modal').classList.add('hidden', 'opacity-0'));

openDashboardBtn?.addEventListener('click', () => {
  document.getElementById('dashboard-overlay').classList.add('open');
  dashboardDrawer.classList.add('open');
});
const closeDash = () => {
  document.getElementById('dashboard-overlay').classList.remove('open');
  dashboardDrawer.classList.remove('open');
};
closeDashboardBtn?.addEventListener('click', closeDash);
document.getElementById('dashboard-overlay')?.addEventListener('click', closeDash);

document.getElementById('drawer-logout-btn')?.addEventListener('click', () => { signOut(auth); closeDash(); });

// AUTH logic
document.getElementById('auth-submit-btn')?.addEventListener('click', async () => {
  const e = document.getElementById('auth-email').value;
  const p = document.getElementById('auth-password').value;
  if(!e || !p) return;
  try {
    const cred = await createUserWithEmailAndPassword(auth, e, p).catch(err => {
      if(err.code === 'auth/email-already-in-use') return signInWithEmailAndPassword(auth, e, p);
      throw err;
    });
    
    // Check user doc
    const uRef = doc(db, "users", cred.user.uid);
    const snap = await getDoc(uRef);
    if(!snap.exists()) {
       const pin = Math.floor(100000 + Math.random() * 900000).toString();
       await setDoc(uRef, { email: e, balance: 0, pin: pin, garage: null });
    }
    
    document.getElementById('auth-modal').classList.add('hidden');
    confetti({ particleCount: 100, origin: { y: 0.6 } });
    window.showToast('Вход выполнен');
  } catch(err) {
    window.showToast(err.message, 'error');
  }
});

// DATA Load
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if(user) {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('user-section').classList.remove('hidden', 'opacity-0');
    
    // Load User Doc
    const uRef = doc(db, "users", user.uid);
    let ds = await getDoc(uRef);
    if(!ds.exists()) {
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      await setDoc(uRef, { email: user.email, balance: 0, pin: pin, garage: null });
      ds = await getDoc(uRef);
    }
    
    const data = ds.data();
    currentBalance = data.balance || 0;
    navBalanceLabel.innerText = `${currentBalance.toLocaleString()} WP`;
    dashBalanceLabel.innerText = currentBalance.toLocaleString();
    
    // Generate QR / PIN
    userPinDisplay.innerText = data.pin || "000000";
    qrcodeDiv.innerHTML = '';
    activeQR = new QRCode(qrcodeDiv, {
      text: user.uid + "-" + data.pin,
      width: 120, height: 120,
      colorDark : "#000000", colorLight : "#ffffff", corrLevel : QRCode.CorrectLevel.H
    });

    // Load Garage
    let g = data.garage;
    if(g && !Array.isArray(g)) g = [g];
    if(g && g.length > 0) {
      renderGarage(g);
    } else {
      garageSetup.classList.remove('hidden');
      garageDisplay.classList.add('hidden');
    }

    // Subscribe to latest booking for Live Tracker
    startLiveTracker();

  } else {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('user-section').classList.add('hidden');
    if(liveTrackerUnsubscribe) liveTrackerUnsubscribe();
  }
});

// GARAGE Logic
garageSaveBtn?.addEventListener('click', async () => {
  const model = document.getElementById('car-model').value.trim();
  const num = document.getElementById('car-number').value.trim().toUpperCase();
  if(!model || !num) return window.showToast('Заполните данные авто', 'error');
  
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  let arr = snap.data()?.garage || [];
  if(!Array.isArray(arr)) arr = [arr];
  if(arr.length >= 2) return window.showToast('Максимум 2 автомобиля', 'error');

  // Format KZ Plate rudimentarily: 123 ABC 01 -> 123ABC, 01
  let main = num; let reg = "01";
  const parts = num.split(' ');
  if(parts.length >= 2) {
    reg = parts[parts.length-1];
    main = parts.slice(0, parts.length-1).join('');
  }

  arr.push({ id: Date.now().toString(), model, main, reg });
  await updateDoc(userRef, { garage: arr });
  renderGarage(arr);
  window.showToast('Авто добавлено в гараж!');
  document.getElementById('car-model').value = '';
  document.getElementById('car-number').value = '';
});

window.toggleSmartGate = async (id, state) => {
  if(!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  let arr = snap.data()?.garage || [];
  const idx = arr.findIndex(c => c.id === id);
  if(idx > -1) {
    arr[idx].smartGate = state;
    await updateDoc(userRef, { garage: arr });
    window.showToast(state ? 'Smart Gate активирован' : 'Smart Gate отключен', state ? 'success' : 'error');
  }
};

window.deleteCar = async (id) => {
  if(!currentUser) return;
  const userRef = doc(db, "users", currentUser.uid);
  const snap = await getDoc(userRef);
  let arr = snap.data()?.garage || [];
  if(!Array.isArray(arr)) arr = [arr];
  arr = arr.filter(c => c.id !== id);
  await updateDoc(userRef, { garage: arr });
  renderGarage(arr);
  window.showToast('Автомобиль удален');
};

function renderGarage(arr) {
  if(!arr || arr.length === 0) {
    garageDisplay.classList.add('hidden');
    garageSetup.classList.remove('hidden');
    return;
  }
  
  garageDisplay.classList.remove('hidden');
  garageDisplay.style.display = 'flex';
  garageDisplay.innerHTML = '';
  
  arr.forEach(c => {
    garageDisplay.innerHTML += `
      <div class="flex items-center justify-between p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 relative group w-full">
        <div class="flex items-center gap-3">
           <div class="kz-plate shadow-sm scale-75 origin-left">
             <div class="kz-plate-left">
                <div class="kz-plate-flag"></div>
                <span class="kz-plate-country">KZ</span>
             </div>
             <div class="kz-plate-main">${c.main}</div>
             <div class="kz-plate-region">${c.reg}</div>
           </div>
           <p class="text-sm border-l border-gray-700 pl-3 py-1 text-gray-300 font-bold">${c.model}</p>
        </div>
        
        <div class="flex items-center gap-4">
          <div class="flex flex-col items-end">
            <span class="text-[10px] text-brand-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><svg class="w-3 h-3 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>Smart Gate</span>
            <label class="toggle-switch">
              <input type="checkbox" onchange="window.toggleSmartGate('${c.id}', this.checked)" ${c.smartGate ? 'checked' : ''}>
              <span class="slider-toggle"></span>
            </label>
          </div>
          <button onclick="window.deleteCar('${c.id}')" class="p-2 text-gray-500 hover:text-red-500 bg-black/50 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/30">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
      </div>`;
  });

  if(arr.length >= 2) {
    garageSetup.classList.add('hidden');
  } else {
    garageSetup.classList.remove('hidden');
  }
}

// LIVE TRACKER Logic
function startLiveTracker() {
  if(liveTrackerUnsubscribe) liveTrackerUnsubscribe();
  
  const q = query(
    collection(db, "bookings"),
    where("userEmail", "==", currentUser.email), // Assuming no complex rules, tracking by email
    orderBy("time", "desc"),
    limit(1)
  );

  liveTrackerUnsubscribe = onSnapshot(q, (snapshot) => {
    if(snapshot.empty) {
      trackerSection.classList.add('hidden');
      return;
    }
    
    const doc = snapshot.docs[0];
    const data = doc.data();
    
    // Stop tracking if it's over
    if(data.status === 'Завершено') {
      trackerSection.classList.add('hidden');
      return;
    }
    
    trackerSection.classList.remove('hidden');
    trackerWashName.innerText = `Мойка: ${data.washName}`;
    
    // Reset steps
    [step0, step1, step2].forEach(s => s.className = 'progress-step');
    
    // Evaluate status
    if(data.status === 'В ожидании') {
      trackerBar.style.width = '0%';
      step0.classList.add('active');
    } else if (data.status === 'В процессе') {
      trackerBar.style.width = '50%';
      step0.classList.add('completed');
      step1.classList.add('active');
    } else if (data.status === 'Отменено') {
      trackerWashName.innerText = `Заявка отменена`;
      trackerBar.style.width = '0%';
      trackerBar.style.background = 'red';
    } else {
      trackerBar.style.width = '100%';
      step0.classList.add('completed');
      step1.classList.add('completed');
      step2.classList.add('active');
    }
  });
}

// WASH FETCH 
async function loadWashes() {
  const defaultWashes = [
    { name: "AquaClean Центр", address: "ул. Достык, 12", status: "🟢 Свободно" },
    { name: "Wash&Go Левый Берег", address: "пр. Мангилик Ел, 45", status: "🔴 Очередь" }
  ];
  try {
    const sn = await getDocs(query(collection(db, "washes")));
    let arr = sn.empty ? defaultWashes : sn.docs.map(d => ({id:d.id, ...d.data()}));
    
    washesContainer.innerHTML = '';
    arr.forEach((w, i) => {
      washesContainer.innerHTML += `
        <div class="glass-panel p-6 flex flex-col justify-between rounded-2xl tilt-card reveal active delay-100">
          <div class="tilt-content">
            <h3 class="text-xl font-bold mb-2 group-hover:text-brand-400">${w.name}</h3>
            <p class="text-sm text-gray-400 mb-6">${w.address}</p>
          </div>
          <button onclick="window.bookWash('${w.name}', this)" class="ripple-button bg-brand-600 font-bold py-3 text-white rounded-xl hover:bg-brand-500 transition shadow-[0_0_15px_rgba(var(--brand-rgb),0.5)]">Записаться на мойку</button>
        </div>`;
    });
  } catch(e) { } 
}

let currentBookingLocation = '';

window.bookWash = async (n, btn) => {
  if(!currentUser) {
    document.getElementById('auth-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('auth-modal').classList.remove('opacity-0'), 10);
    return window.showToast('Войдите для записи', 'error');
  }
  
  currentBookingLocation = n;
  document.getElementById('booking-location-name').innerText = n;
  
  const modal = document.getElementById('booking-modal');
  modal.classList.remove('hidden');
  setTimeout(() => modal.classList.remove('opacity-0'), 10);
};

document.getElementById('close-booking-modal-btn')?.addEventListener('click', () => {
  const modal = document.getElementById('booking-modal');
  modal.classList.add('opacity-0');
  setTimeout(() => modal.classList.add('hidden'), 300);
});

document.getElementById('confirm-booking-btn')?.addEventListener('click', async () => {
  try {
    const dirtLevel = document.querySelector('input[name="dirtLevel"]:checked').value;
    const drinkPref = document.querySelector('input[name="drinkPref"]:checked').value;
    
    await addDoc(collection(db, "bookings"), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      washName: currentBookingLocation,
      status: "В ожидании",
      dirtLevel: dirtLevel,
      drinkPref: drinkPref,
      time: new Date().toISOString()
    });
    
    const modal = document.getElementById('booking-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
    
    window.showToast(`Успешно! Ваш ${drinkPref} будет готов.`);
    document.getElementById('dashboard-overlay').classList.add('open');
    dashboardDrawer.classList.add('open');
    confetti({origin: {y:0.8}});
  } catch (e) {
    console.error(e);
    window.showToast('Ошибка при записи', 'error');
  }
});

// WP Operations
document.getElementById('test-topup-btn')?.addEventListener('click', async () => {
    if(!currentUser) return;
    await updateDoc(doc(db, "users", currentUser.uid), { balance: increment(100000) });
    currentBalance += 100000;
    navBalanceLabel.innerText = `${currentBalance.toLocaleString()} WP`;
    dashBalanceLabel.innerText = currentBalance.toLocaleString();
    confetti();
});

window.buyTariff = async (n, p, btn) => {
  if(!currentUser) return;
  if(currentBalance < p) { window.showToast('Недостаточно WP', 'error'); document.getElementById('dashboard-overlay').classList.add('open'); dashboardDrawer.classList.add('open'); return; }
  await updateDoc(doc(db, "users", currentUser.uid), { balance: increment(-p + Math.floor(p*0.05)) });
  currentBalance += (-p + Math.floor(p*0.05));
  navBalanceLabel.innerText = `${currentBalance.toLocaleString()} WP`;
  dashBalanceLabel.innerText = currentBalance.toLocaleString();
  window.showToast('Оформлено! Кэшбэк начислен.');
  confetti();
};

document.getElementById('promo-submit-btn')?.addEventListener('click', async () => {
   const val = document.getElementById('promo-input').value.toUpperCase();
   if(['WASH2026','VIP'].includes(val)) {
      await updateDoc(doc(db, "users", currentUser.uid), { balance: increment(5000) });
      currentBalance += 5000;
      dashBalanceLabel.innerText = currentBalance.toLocaleString();
      navBalanceLabel.innerText = `${currentBalance.toLocaleString()} WP`;
      window.showToast('WP зачислены!');
      document.getElementById('promo-input').value = '';
      confetti();
   } else {
      window.showToast('Неверный код', 'error');
   }
});

document.addEventListener('DOMContentLoaded', loadWashes);

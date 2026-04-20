import { db } from './firebase-config.js';
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Toast Notification System
window.showToast = (message, type = 'success') => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

const tableBody = document.getElementById('bookings-table');

async function loadBookings() {
  try {
    const q = query(collection(db, "bookings")); // add orderBy if indices exist: orderBy('time', 'desc')
    const snapshot = await getDocs(q);

    tableBody.innerHTML = '';

    if (snapshot.empty) {
      tableBody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500 font-medium">Пока нет бронирований</td></tr>';
      return;
    }

    // Sort manually if indexing is not set up in firestore to avoid missing index errors
    let docsData = [];
    snapshot.forEach(d => {
      docsData.push({ id: d.id, ...d.data() });
    });

    docsData.sort((a, b) => new Date(b.time) - new Date(a.time));

    docsData.forEach((data, index) => {
      const time = new Date(data.time).toLocaleString('ru-RU');

      let statusClass = "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
      if (data.status === 'Завершено') statusClass = "bg-green-500/20 text-green-500 border-green-500/30";
      if (data.status === 'Отменено') statusClass = "bg-red-500/20 text-red-500 border-red-500/30";

      tableBody.innerHTML += `
        <tr class="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors text-sm group slide-up delay-${Math.min(index * 50, 500)}">
          <td class="p-4 text-gray-300 flex items-center gap-2">
            <div class="h-8 w-8 rounded-full bg-blue-900/30 flex items-center justify-center text-blue-500 font-bold border border-blue-800/50">
              ${data.userEmail.charAt(0).toUpperCase()}
            </div>
            ${data.userEmail}
          </td>
          <td class="p-4 font-semibold text-white tracking-wide">${data.washName}</td>
          <td class="p-4 text-gray-500 font-mono text-xs">${time}</td>
          <td class="p-4">
            <span class="px-2.5 py-1 rounded-md text-xs font-semibold border ${statusClass}">
              ${data.status}
            </span>
          </td>
          <td class="p-4 text-right opacity-0 group-hover:opacity-100 transition-opacity">
            <select onchange="window.updateStatus('${data.id}', this.value)" class="bg-gray-900 border border-gray-700 text-white text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 outline-none">
              <option value="" disabled selected>Изменить</option>
              <option value="В ожидании">В ожидании</option>
              <option value="В процессе">В процессе</option>
              <option value="Завершено">Завершено</option>
              <option value="Отменено">Отменено</option>
            </select>
          </td>
        </tr>
      `;
    });
  } catch (e) {
    console.error(e);
    tableBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-red-500">Ошибка загрузки данных из БД.<br><span class="text-xs text-gray-500">${e.message}</span></td></tr>`;
  }
}

window.updateStatus = async (id, newStatus) => {
  if (!newStatus) return;
  try {
    const bookingRef = doc(db, "bookings", id);
    await updateDoc(bookingRef, { status: newStatus });
    window.showToast(`Статус обновлен на "${newStatus}"`);
    loadBookings(); // Reload to reflect changes visually
  } catch (e) {
    console.error(e);
    window.showToast('Ошибка при обновлении статуса', 'error');
  }
};

document.addEventListener('DOMContentLoaded', loadBookings);


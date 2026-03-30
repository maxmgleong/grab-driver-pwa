/* ========================================
   Grab 司机工作记录 - Main App
   ======================================== */

const DB_NAME = 'grab_driver_db';
const STORE_NAME = 'trips';
const CLOUD_CONFIG_KEY = 'grab_cloud_config';
let db = null;
let currentMonth = new Date();
let cloudConfig = {};

// ==========================================
// IndexedDB
// ==========================================

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('date', 'date', { unique: false });
      }
    };
  });
}

function getAllTrips() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function addTripRecord(record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function updateTripRecord(id, record) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ ...record, id });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function deleteTripRecord(id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function clearAllRecords() {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// Cloud Sync
// ==========================================

function saveCloudConfig() {
  cloudConfig = {
    api: document.getElementById('cloudApi').value,
    key: document.getElementById('cloudKey').value
  };
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig));
  updateCloudStatus();
}

function loadCloudConfig() {
  const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
  if (saved) {
    cloudConfig = JSON.parse(saved);
    document.getElementById('cloudApi').value = cloudConfig.api || '';
    document.getElementById('cloudKey').value = cloudConfig.key || '';
  }
  updateCloudStatus();
}

function updateCloudStatus() {
  const el = document.getElementById('cloudStatus');
  if (cloudConfig.api) {
    el.textContent = '🟢 云端已配置';
    el.style.color = 'var(--grab-green)';
  } else {
    el.textContent = '⚪ 未配置云端同步';
    el.style.color = 'var(--gray)';
  }
}

async function syncToCloud() {
  if (!cloudConfig.api) {
    showToast('⚠️ 请先配置云端API');
    return;
  }
  try {
    const trips = await getAllTrips();
    const response = await fetch(cloudConfig.api, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cloudConfig.key}`
      },
      body: JSON.stringify({ trips, lastSync: Date.now() })
    });
    if (response.ok) {
      localStorage.setItem('grab_last_sync', Date.now());
      updateLastSyncTime();
      showToast('✅ 同步成功！');
    } else {
      showToast('❌ 同步失败: ' + response.status);
    }
  } catch (e) {
    showToast('❌ 网络错误: ' + e.message);
  }
}

async function testCloudConnection() {
  if (!cloudConfig.api) {
    showToast('⚠️ 请先输入API地址');
    return;
  }
  try {
    const response = await fetch(cloudConfig.api + '/ping', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${cloudConfig.key}` }
    });
    if (response.ok) {
      showToast('✅ 连接成功！');
    } else {
      showToast('❌ 连接失败: ' + response.status);
    }
  } catch (e) {
    showToast('❌ 连接失败: ' + e.message);
  }
}

function updateLastSyncTime() {
  const lastSync = localStorage.getItem('grab_last_sync');
  const el = document.getElementById('lastSync');
  if (lastSync) {
    const date = new Date(parseInt(lastSync));
    el.textContent = '上次同步: ' + date.toLocaleString('zh-CN');
  }
}

// ==========================================
// App Logic
// ==========================================

function renderMonth() {
  const el = document.getElementById('currentMonth');
  el.textContent = `${currentMonth.getFullYear()}年 ${currentMonth.getMonth() + 1}月`;
}

function changeMonth(delta) {
  currentMonth.setMonth(currentMonth.getMonth() + delta);
  renderMonth();
  renderRecords();
  renderSummary();
}

function calculateHours(start, end) {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let minutes = (eh * 60 + em) - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  return (minutes / 60).toFixed(1);
}

function getMonthTrips(trips) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  return trips.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

async function renderSummary() {
  const allTrips = await getAllTrips();
  const monthTrips = getMonthTrips(allTrips);

  const totalIncome = monthTrips.reduce((sum, t) => sum + parseFloat(t.income || 0), 0);
  const totalDays = monthTrips.length;
  const totalTripCount = monthTrips.reduce((sum, t) => sum + parseInt(t.trips || 0), 0);
  const dailyAvg = totalDays > 0 ? totalIncome / totalDays : 0;
  const perTripAvg = totalTripCount > 0 ? totalIncome / totalTripCount : 0;

  // Calculate average hours
  let totalMinutes = 0;
  monthTrips.forEach(t => {
    const hours = parseFloat(calculateHours(t.startTime, t.endTime));
    totalMinutes += hours;
  });
  const avgHours = totalDays > 0 ? (totalMinutes / totalDays).toFixed(1) : 0;

  document.getElementById('totalIncome').textContent = `RM ${totalIncome.toFixed(2)}`;
  document.getElementById('totalDays').textContent = `${totalDays} 天`;
  document.getElementById('totalTrips').textContent = `${totalTripCount} 趟`;
  document.getElementById('dailyAvg').textContent = `RM ${dailyAvg.toFixed(2)}`;
  document.getElementById('avgHours').textContent = `${avgHours} 小时`;
  document.getElementById('perTrip').textContent = `RM ${perTripAvg.toFixed(2)}`;
}

async function renderRecords() {
  const allTrips = await getAllTrips();
  const monthTrips = getMonthTrips(allTrips);

  // Sort by date descending
  monthTrips.sort((a, b) => new Date(b.date) - new Date(a.date));

  const list = document.getElementById('recordsList');

  if (monthTrips.length === 0) {
    list.innerHTML = '<div class="empty-state">这个月还没有记录 🚖</div>';
    return;
  }

  list.innerHTML = monthTrips.map(t => `
    <div class="record-item" onclick="openEditModal(${t.id})">
      <button class="record-delete" onclick="event.stopPropagation(); confirmDelete(${t.id})">🗑️</button>
      <div class="record-header">
        <span class="record-date">${new Date(t.date).toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' })}</span>
        <span class="record-income">RM ${parseFloat(t.income).toFixed(2)}</span>
      </div>
      <div class="record-details">
        <span>⏱️ ${t.startTime} - ${t.endTime}</span>
        <span>🚗 ${t.trips} 趟</span>
        <span>⚡ RM ${(parseFloat(t.income) / parseInt(t.trips)).toFixed(2)}/趟</span>
      </div>
      ${t.notes ? `<div class="record-notes">📝 ${t.notes}</div>` : ''}
    </div>
  `).join('');
}

async function addTrip(event) {
  event.preventDefault();
  const record = {
    date: document.getElementById('tripDate').value,
    startTime: document.getElementById('startTime').value,
    endTime: document.getElementById('endTime').value,
    trips: parseInt(document.getElementById('trips').value),
    income: parseFloat(document.getElementById('income').value),
    notes: document.getElementById('notes').value,
    createdAt: Date.now()
  };

  await addTripRecord(record);
  document.getElementById('tripForm').reset();
  // Reset date to today
  document.getElementById('tripDate').value = new Date().toISOString().split('T')[0];
  renderRecords();
  renderSummary();
  showToast('✅ 记录已保存！');
}

// ==========================================
// Edit Modal
// ==========================================

async function openEditModal(id) {
  const trips = await getAllTrips();
  const record = trips.find(t => t.id === id);
  if (!record) return;

  document.getElementById('editId').value = record.id;
  document.getElementById('editDate').value = record.date;
  document.getElementById('editStart').value = record.startTime;
  document.getElementById('editEnd').value = record.endTime;
  document.getElementById('editTrips').value = record.trips;
  document.getElementById('editIncome').value = record.income;
  document.getElementById('editNotes').value = record.notes || '';
  document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

async function saveEdit(event) {
  event.preventDefault();
  const id = parseInt(document.getElementById('editId').value);
  const trips = await getAllTrips();
  const record = trips.find(t => t.id === id);
  if (!record) return;

  const updated = {
    ...record,
    date: document.getElementById('editDate').value,
    startTime: document.getElementById('editStart').value,
    endTime: document.getElementById('editEnd').value,
    trips: parseInt(document.getElementById('editTrips').value),
    income: parseFloat(document.getElementById('editIncome').value),
    notes: document.getElementById('editNotes').value
  };

  await updateTripRecord(id, updated);
  closeEditModal();
  renderRecords();
  renderSummary();
  showToast('✅ 更新成功！');
}

async function deleteEditRecord() {
  const id = parseInt(document.getElementById('editId').value);
  if (confirm('确定删除这条记录？')) {
    await deleteTripRecord(id);
    closeEditModal();
    renderRecords();
    renderSummary();
    showToast('🗑️ 已删除');
  }
}

async function confirmDelete(id) {
  if (confirm('确定删除这条记录？')) {
    await deleteTripRecord(id);
    renderRecords();
    renderSummary();
    showToast('🗑️ 已删除');
  }
}

// ==========================================
// Import / Export
// ==========================================

async function exportData() {
  const trips = await getAllTrips();
  const blob = new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grab_records_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 数据已导出');
}

async function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const trips = JSON.parse(text);
      if (!Array.isArray(trips)) throw new Error('Invalid format');
      if (confirm(`导入 ${trips.length} 条记录？现有数据将被合并。`)) {
        for (const t of trips) {
          delete t.id;
          await addTripRecord(t);
        }
        renderRecords();
        renderSummary();
        showToast(`✅ 成功导入 ${trips.length} 条记录！`);
      }
    } catch (e) {
      showToast('❌ 导入失败: ' + e.message);
    }
  };
  input.click();
}

async function clearAllData() {
  if (confirm('⚠️ 确定清空所有数据？这个操作不可恢复！')) {
    if (confirm('再次确认：所有记录将被永久删除！')) {
      await clearAllRecords();
      renderRecords();
      renderSummary();
      showToast('🗑️ 所有数据已清空');
    }
  }
}

// ==========================================
// UI Helpers
// ==========================================

function toggleSection(id) {
  const content = document.getElementById(id);
  const icon = document.getElementById(id + 'Icon');
  content.classList.toggle('open');
  icon.textContent = content.classList.contains('open') ? '▲' : '▼';
}

function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ==========================================
// PWA Service Worker Registration
// ==========================================

async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
      console.log('SW registered');
    } catch (e) {
      console.log('SW registration failed:', e);
    }
  }
}

// ==========================================
// Init
// ==========================================

async function init() {
  await initDB();
  loadCloudConfig();
  renderMonth();

  // Set default date to today
  document.getElementById('tripDate').value = new Date().toISOString().split('T')[0];

  await renderRecords();
  await renderSummary();
  updateLastSyncTime();
  registerSW();

  // Register Service Worker for background sync
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(registration => {
      // Background sync available
    });
  }

  // Open first section by default
  toggleSection('addForm');
  toggleSection('records');
}

// Init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

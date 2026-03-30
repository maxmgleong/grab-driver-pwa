/* ========================================
   Grab 司机工作记录 - Main App (Cloud Sync)
   ======================================== */

// Supabase Config
const SUPABASE_URL = 'https://mwmyxizvyurvkcgvfbqh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13bXl4aXp2eXVydmtjZ3ZmYnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NDgyODUsImV4cCI6MjA5MDQyNDI4NX0.mM4jAye3kltxUKvaafK_MEqxM9r56H9Jw-uVDXM_Vsc';
const TABLE_NAME = 'trips';

let currentMonth = new Date();
let deviceId = localStorage.getItem('grab_device_id') || generateDeviceId();

// Generate unique device ID
function generateDeviceId() {
  const id = 'device_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  localStorage.setItem('grab_device_id', id);
  return id;
}

// ==========================================
// Supabase API
// ==========================================

async function supabaseGetAll() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?select=*&order=created_at.desc`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!response.ok) throw new Error('Failed to fetch');
  return response.json();
}

async function supabaseAdd(record) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      date: record.date,
      start_time: record.startTime,
      end_time: record.endTime,
      trips_count: record.trips,
      income: record.income,
      notes: record.notes || null,
      created_at: record.createdAt || Date.now(),
      device_id: deviceId
    })
  });
  if (!response.ok) throw new Error('Failed to add');
  const data = await response.json();
  return data[0];
}

async function supabaseUpdate(id, record) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${id}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      date: record.date,
      start_time: record.startTime,
      end_time: record.endTime,
      trips_count: record.trips,
      income: record.income,
      notes: record.notes || null
    })
  });
  if (!response.ok) throw new Error('Failed to update');
}

async function supabaseDelete(id) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?id=eq.${id}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!response.ok) throw new Error('Failed to delete');
}

async function supabaseClearAll() {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${TABLE_NAME}?device_id=eq.${deviceId}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  if (!response.ok) throw new Error('Failed to clear');
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
  try {
    const trips = await supabaseGetAll();
    const monthTrips = getMonthTrips(trips);

    const totalIncome = monthTrips.reduce((sum, t) => sum + parseFloat(t.income || 0), 0);
    const totalDays = monthTrips.length;
    const totalTripCount = monthTrips.reduce((sum, t) => sum + parseInt(t.trips_count || 0), 0);
    const dailyAvg = totalDays > 0 ? totalIncome / totalDays : 0;
    const perTripAvg = totalTripCount > 0 ? totalIncome / totalTripCount : 0;

    let totalMinutes = 0;
    monthTrips.forEach(t => {
      const hours = parseFloat(calculateHours(t.start_time, t.end_time));
      totalMinutes += hours;
    });
    const avgHours = totalDays > 0 ? (totalMinutes / totalDays).toFixed(1) : 0;

    document.getElementById('totalIncome').textContent = `RM ${totalIncome.toFixed(2)}`;
    document.getElementById('totalDays').textContent = `${totalDays} 天`;
    document.getElementById('totalTrips').textContent = `${totalTripCount} 趟`;
    document.getElementById('dailyAvg').textContent = `RM ${dailyAvg.toFixed(2)}`;
    document.getElementById('avgHours').textContent = `${avgHours} 小时`;
    document.getElementById('perTrip').textContent = `RM ${perTripAvg.toFixed(2)}`;
  } catch (e) {
    console.error('Summary error:', e);
  }
}

async function renderRecords() {
  try {
    const trips = await supabaseGetAll();
    const monthTrips = getMonthTrips(trips);
    monthTrips.sort((a, b) => new Date(b.date) - new Date(a.date));

    const list = document.getElementById('recordsList');

    if (monthTrips.length === 0) {
      list.innerHTML = '<div class="empty-state">这个月还没有记录 🚖</div>';
      return;
    }

    list.innerHTML = monthTrips.map(t => `
      <div class="record-item" onclick="openEditModal(${t.id}, '${t.date}', '${t.start_time}', '${t.end_time}', ${t.trips_count}, ${t.income}, '${escapeHtml(t.notes || '')}')">
        <button class="record-delete" onclick="event.stopPropagation(); confirmDelete(${t.id})">🗑️</button>
        <div class="record-header">
          <span class="record-date">${new Date(t.date).toLocaleDateString('zh-CN', { weekday: 'short', month: 'numeric', day: 'numeric' })}</span>
          <span class="record-income">RM ${parseFloat(t.income).toFixed(2)}</span>
        </div>
        <div class="record-details">
          <span>⏱️ ${t.start_time} - ${t.end_time}</span>
          <span>🚗 ${t.trips_count} 趟</span>
          <span>⚡ RM ${(parseFloat(t.income) / parseInt(t.trips_count)).toFixed(2)}/趟</span>
        </div>
        ${t.notes ? `<div class="record-notes">📝 ${escapeHtml(t.notes)}</div>` : ''}
      </div>
    `).join('');
  } catch (e) {
    console.error('Records error:', e);
    document.getElementById('recordsList').innerHTML = '<div class="empty-state">❌ 加载失败，请检查网络</div>';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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

  try {
    await supabaseAdd(record);
    document.getElementById('tripForm').reset();
    document.getElementById('tripDate').value = new Date().toISOString().split('T')[0];
    renderRecords();
    renderSummary();
    showToast('✅ 记录已保存！');
  } catch (e) {
    showToast('❌ 保存失败: ' + e.message);
  }
}

// ==========================================
// Edit Modal
// ==========================================

function openEditModal(id, date, start, end, trips, income, notes) {
  document.getElementById('editId').value = id;
  document.getElementById('editDate').value = date;
  document.getElementById('editStart').value = start;
  document.getElementById('editEnd').value = end;
  document.getElementById('editTrips').value = trips;
  document.getElementById('editIncome').value = income;
  document.getElementById('editNotes').value = notes;
  document.getElementById('editModal').classList.add('open');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('open');
}

async function saveEdit(event) {
  event.preventDefault();
  const id = parseInt(document.getElementById('editId').value);
  const record = {
    date: document.getElementById('editDate').value,
    startTime: document.getElementById('editStart').value,
    endTime: document.getElementById('editEnd').value,
    trips: parseInt(document.getElementById('editTrips').value),
    income: parseFloat(document.getElementById('editIncome').value),
    notes: document.getElementById('editNotes').value
  };

  try {
    await supabaseUpdate(id, record);
    closeEditModal();
    renderRecords();
    renderSummary();
    showToast('✅ 更新成功！');
  } catch (e) {
    showToast('❌ 更新失败: ' + e.message);
  }
}

async function deleteEditRecord() {
  const id = parseInt(document.getElementById('editId').value);
  if (confirm('确定删除这条记录？')) {
    try {
      await supabaseDelete(id);
      closeEditModal();
      renderRecords();
      renderSummary();
      showToast('🗑️ 已删除');
    } catch (e) {
      showToast('❌ 删除失败: ' + e.message);
    }
  }
}

async function confirmDelete(id) {
  if (confirm('确定删除这条记录？')) {
    try {
      await supabaseDelete(id);
      renderRecords();
      renderSummary();
      showToast('🗑️ 已删除');
    } catch (e) {
      showToast('❌ 删除失败: ' + e.message);
    }
  }
}

// ==========================================
// Import / Export
// ==========================================

async function exportData() {
  try {
    const trips = await supabaseGetAll();
    const blob = new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `grab_records_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('📤 数据已导出');
  } catch (e) {
    showToast('❌ 导出失败: ' + e.message);
  }
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
      if (confirm(`导入 ${trips.length} 条记录？`)) {
        for (const t of trips) {
          await supabaseAdd({
            date: t.date,
            startTime: t.start_time,
            endTime: t.end_time,
            trips: t.trips_count,
            income: t.income,
            notes: t.notes,
            createdAt: t.created_at
          });
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
      try {
        await supabaseClearAll();
        renderRecords();
        renderSummary();
        showToast('🗑️ 所有数据已清空');
      } catch (e) {
        showToast('❌ 清空失败: ' + e.message);
      }
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
// Init
// ==========================================

function init() {
  renderMonth();
  document.getElementById('tripDate').value = new Date().toISOString().split('T')[0];
  renderRecords();
  renderSummary();
  toggleSection('addForm');
  toggleSection('records');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

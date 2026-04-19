let controlMode = 'manual';
const activeSpray = new Set();

function apiCall(endpoint, data = {}, method = 'POST') {
    return fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'POST' ? JSON.stringify(data) : undefined
    }).catch(err => console.error("API error:", err));
}

function sendMove(direction) {
    if (controlMode === 'auto') return;

    // UI feedback: highlight active movement
    document.querySelectorAll('.move-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll(`.move-btn[data-dir="${direction}"]`).forEach(b => b.classList.add('active'));

    apiCall(`/api/${direction}`);
}

function stopAll() {
    document.querySelectorAll('.move-btn').forEach(b => b.classList.remove('active'));
    apiCall('/api/stop');
}

function sendSpray(id) {
    if (activeSpray.has(id)) return;
    activeSpray.add(id);
    apiCall('/api/spray', { id });
    document.querySelectorAll(`.spray-btn[data-id="${id}"]`).forEach(b => b.classList.add('active'));
}

function stopSpray(id) {
    if (!activeSpray.has(id)) return;
    activeSpray.delete(id);
    apiCall('/api/spray', { id: 'stop' });
    document.querySelectorAll(`.spray-btn[data-id="${id}"]`).forEach(b => b.classList.remove('active'));
}

// Event Listeners
document.querySelectorAll('.move-btn').forEach(btn => {
    btn.addEventListener('click', () => sendMove(btn.dataset.dir));
});

document.getElementById('btn-stop-global').addEventListener('click', stopAll);

document.getElementById('btn-emergency').addEventListener('click', () => {
    stopAll();
    apiCall('/api/emergency');
});
document.getElementById('btn-reset').addEventListener('click', () => apiCall('/api/reset'));

// Mode Toggles
document.getElementById('mode-manual').addEventListener('click', () => setMode('manual'));
document.getElementById('mode-auto').addEventListener('click', () => setMode('auto'));

function setMode(mode) {
    controlMode = mode;
    document.getElementById('mode-manual').classList.toggle('active', mode === 'manual');
    document.getElementById('mode-auto').classList.toggle('active', mode === 'auto');

    // Disable/Enable buttons
    const inputs = document.querySelectorAll('.move-btn, .big-stop-btn');
    inputs.forEach(el => el.disabled = (mode === 'auto'));

    if (mode === 'auto') stopAll();
}

// Background status polling
let lastLogs = [];
function updateStatus() {
    fetch('/api/status')
        .then(r => r.json())
        .then(data => {
            const dot = document.querySelector('.dot');
            const stText = document.getElementById('status-text');
            const logContainer = document.getElementById('log-container');

            if (data.emergency) {
                dot.style.backgroundColor = '#EF4444';
                dot.style.boxShadow = '0 0 15px #EF4444';
                stText.textContent = 'SYSTEM EMERGENCY';
                stText.style.color = '#EF4444';

                // If emergency, force manual UI reset but keep it red
                document.querySelectorAll('.move-btn').forEach(b => b.classList.remove('active'));
            } else {
                dot.style.backgroundColor = '#10B981';
                dot.style.boxShadow = '0 0 15px #10B981';
                stText.textContent = 'SYSTEM ARMED';
                stText.style.color = '#F8FAFC';
            }

            // Build logs list
            if (JSON.stringify(data.logs) !== JSON.stringify(lastLogs)) {
                lastLogs = data.logs;
                logContainer.innerHTML = '';
                data.logs.forEach(log => {
                    const el = document.createElement('div');
                    el.className = 'log-entry';
                    el.textContent = log;
                    logContainer.appendChild(el);
                });
                logContainer.scrollTop = logContainer.scrollHeight;
            }
        });
}

setInterval(updateStatus, 1000);
updateStatus();

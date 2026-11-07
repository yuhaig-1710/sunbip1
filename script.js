// Dọn dẹp tự động dữ liệu cũ
try {
  let testHist = localStorage.getItem('sunbip_history');
  if (testHist && testHist.includes('TAI')) {
    localStorage.removeItem('sunbip_history');
  }
} catch (e) {}

// State Management
let balance = localStorage.getItem('sunbip_balance') !== null ? parseInt(localStorage.getItem('sunbip_balance')) : 0;
let currentSession = localStorage.getItem('sunbip_session') !== null ? parseInt(localStorage.getItem('sunbip_session')) : 1001;
let historyData = localStorage.getItem('sunbip_history') !== null ? JSON.parse(localStorage.getItem('sunbip_history')) : [];

let selectedChipVal = 10000;
let betSide = null; 
let tempBetAmount = 0; 
let confirmedBetAmount = 0; 
let isBetConfirmed = false;

let consecutiveWins = 0; 
let countdown = 15;
let gameState = 'BETTING'; 
let timerInterval = null;
let autoOpenTimeout = null;

let diceResults = [1, 1, 1];
let isBowlOpened = false;

// DOM Elements
const balanceEl = document.getElementById('balance');
const timerSecEl = document.getElementById('timer-sec');
const timerStateEl = document.getElementById('timer-state');
const bowlEl = document.getElementById('bowl');
const resultBanner = document.getElementById('result-banner');

const zoneTai = document.getElementById('zone-tai');
const zoneXiu = document.getElementById('zone-xiu');
const placedTai = document.getElementById('placed-tai');
const placedXiu = document.getElementById('placed-xiu');
const btnConfirm = document.getElementById('btn-confirm');
const ratioText = document.getElementById('ratio-text');

// Audio Synthesizer
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(type) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  if (type === 'chip') {
    osc.frequency.setValueAtTime(600, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
    osc.start(); osc.stop(audioCtx.currentTime + 0.05);
  } else if (type === 'shake') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(120, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc.start(); osc.stop(audioCtx.currentTime + 0.08);
  } else if (type === 'win') {
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
    osc.start(); osc.stop(audioCtx.currentTime + 0.25);
  }
}

// Load Data
balanceEl.textContent = balance.toLocaleString();
document.getElementById('session-num').textContent = currentSession;
renderHistoryDots();
renderHistoryTable();
drawTrendChart();

// Timer
function startTimer() {
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    if (gameState === 'BETTING') {
      countdown--;
      timerSecEl.textContent = countdown;
      if (countdown <= 0) {
        triggerLockAndShake();
      }
    }
  }, 1000);
}

startTimer();

// Chip Rack Selection
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    if (isBetConfirmed || gameState !== 'BETTING') return;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const v = chip.dataset.val;
    selectedChipVal = v === 'all' ? balance : parseInt(v);
    playSound('chip');
  });
});

// Select Side
zoneTai.addEventListener('click', () => placeBet('Tài'));
zoneXiu.addEventListener('click', () => placeBet('Xỉu'));

function placeBet(side) {
  if (gameState !== 'BETTING' || isBetConfirmed) return;
  if (selectedChipVal <= 0 || balance <= 0) return;

  if (betSide && betSide !== side) {
    tempBetAmount = 0;
  }

  betSide = side;
  tempBetAmount = Math.min(tempBetAmount + selectedChipVal, balance);

  updateUI();
  playSound('chip');
}

// Confirm Bet
btnConfirm.addEventListener('click', () => {
  if (!betSide || tempBetAmount <= 0 || isBetConfirmed || gameState !== 'BETTING') return;

  confirmedBetAmount = tempBetAmount;
  balance -= confirmedBetAmount;
  saveData();

  isBetConfirmed = true;
  btnConfirm.disabled = true;
  btnConfirm.textContent = '✔ ĐÃ XÁC NHẬN';
  resultBanner.textContent = `Đã cược ${confirmedBetAmount.toLocaleString()}$ vào cửa ${betSide}`;
  resultBanner.style.color = '#34d399';
  updateUI();
  playSound('chip');
});

function updateUI() {
  balanceEl.textContent = balance.toLocaleString();
  zoneTai.className = 'side-box side-tai' + (betSide === 'Tài' ? ' selected-tai' : '');
  zoneXiu.className = 'side-box side-xiu' + (betSide === 'Xỉu' ? ' selected-xiu' : '');

  placedTai.textContent = betSide === 'Tài' ? `${(isBetConfirmed ? confirmedBetAmount : tempBetAmount).toLocaleString()}$ ${isBetConfirmed ? '(Đã chốt)' : '(Chờ XN)'}` : '';
  placedXiu.textContent = betSide === 'Xỉu' ? `${(isBetConfirmed ? confirmedBetAmount : tempBetAmount).toLocaleString()}$ ${isBetConfirmed ? '(Đã chốt)' : '(Chờ XN)'}` : '';
}

// Lock & Shake Bowl
function triggerLockAndShake() {
  gameState = 'SHAKING';
  timerStateEl.textContent = 'ĐANG XÓC...';
  timerSecEl.textContent = '0';
  resultBanner.textContent = 'Đang lắc xúc xắc...';
  btnConfirm.disabled = true;

  bowlEl.style.transform = 'translate(0, 0)';
  bowlEl.classList.add('shake');
  isBowlOpened = false;

  let shakeTimes = 0;
  let shakeInterval = setInterval(() => {
    playSound('shake');
    shakeTimes++;
    if (shakeTimes > 10) clearInterval(shakeInterval);
  }, 100);

  setTimeout(() => {
    bowlEl.classList.remove('shake');
    rollDiceLogicBip(); 
    gameState = 'WAIT_OPEN';
    
    let autoOpenSec = 3;
    timerStateEl.textContent = `TỰ MỞ (${autoOpenSec}s)`;
    
    clearInterval(autoOpenTimeout);
    autoOpenTimeout = setInterval(() => {
      autoOpenSec--;
      timerStateEl.textContent = `TỰ MỞ (${autoOpenSec}s)`;
      if (autoOpenSec <= 0) {
        clearInterval(autoOpenTimeout);
        if (!isBowlOpened) {
          isBowlOpened = true;
          bowlEl.style.transform = `translate(250px, 0px)`;
          finishRound();
        }
      }
    }, 1000);

  }, 1500);
}

// Logic Bịp Tự Nhiên
function rollDiceLogicBip() {
  let targetOutcome = null;

  if (isBetConfirmed && consecutiveWins >= 2) {
    let bipProbability = Math.random();
    if (bipProbability < 0.5) { 
      targetOutcome = (betSide === 'Tài') ? 'Xỉu' : 'Tài';
    }
  }

  do {
    diceResults = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
    let sum = diceResults.reduce((a, b) => a + b, 0);
    let outcome = sum >= 11 ? 'Tài' : 'Xỉu';
    
    if (!targetOutcome || outcome === targetOutcome) break;
  } while (true);

  const rotations = [
    { x: 0, y: 0 },       
    { x: 0, y: -90 },     
    { x: 0, y: -180 },    
    { x: 0, y: 90 },      
    { x: -90, y: 0 },     
    { x: 90, y: 0 }       
  ];

  for (let i = 1; i <= 3; i++) {
    const cube = document.getElementById(`cube-${i}`);
    const res = diceResults[i - 1];
    const rot = rotations[res - 1];
    const extraX = (Math.floor(Math.random() * 2) + 2) * 360;
    const extraY = (Math.floor(Math.random() * 2) + 2) * 360;
    cube.style.transform = `rotateX(${rot.x + extraX}deg) rotateY(${rot.y + extraY}deg)`;
  }
}

// Drag Bowl 360
let isDragging = false;
let startX, startY;

function startDrag(e) {
  if (gameState !== 'WAIT_OPEN' || isBowlOpened) return;
  isDragging = true;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  startX = clientX; startY = clientY;
}

function moveDrag(e) {
  if (!isDragging) return;
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const deltaX = clientX - startX;
  const deltaY = clientY - startY;

  bowlEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
  const dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  if (dist > 80 && !isBowlOpened) {
    isBowlOpened = true;
    isDragging = false;
    clearInterval(autoOpenTimeout);
    bowlEl.style.transform = `translate(${deltaX * 2}px, ${deltaY * 2}px)`;
    finishRound();
  }
}

function endDrag() {
  if (!isDragging) return;
  isDragging = false;
  if (!isBowlOpened) bowlEl.style.transform = 'translate(0, 0)';
}

bowlEl.addEventListener('mousedown', startDrag);
window.addEventListener('mousemove', moveDrag);
window.addEventListener('mouseup', endDrag);
bowlEl.addEventListener('touchstart', startDrag);
window.addEventListener('touchmove', moveDrag);
window.addEventListener('touchend', endDrag);

// Calculate Result
function finishRound() {
  gameState = 'RESULT';
  clearInterval(autoOpenTimeout);
  const sum = diceResults.reduce((a, b) => a + b, 0);
  const outcome = sum >= 11 ? 'Tài' : 'Xỉu';

  let winAmount = 0;
  let isWin = false;

  if (isBetConfirmed && betSide === outcome) {
    winAmount = Math.floor(confirmedBetAmount * 1.98);
    balance += winAmount;
    isWin = true;
    consecutiveWins++;
    playSound('win');

    if (typeof confetti === 'function') {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }

    document.querySelector('.casino-app').classList.add('screen-shake');
    setTimeout(() => document.querySelector('.casino-app').classList.remove('screen-shake'), 400);

    showFloatingMoney(`+${winAmount.toLocaleString()}$`);
    if (outcome === 'Tài') zoneTai.classList.add('win-glow-tai');
    else zoneXiu.classList.add('win-glow-xiu');

    resultBanner.textContent = `🎉 KẾT QUẢ: ${sum} ĐIỂM (${outcome}) - THẮNG +${winAmount.toLocaleString()}$!`;
    resultBanner.style.color = '#4ade80';
  } else if (isBetConfirmed) {
    consecutiveWins = 0; 
    resultBanner.textContent = `❌ KẾT QUẢ: ${sum} ĐIỂM (${outcome}) - THUA -${confirmedBetAmount.toLocaleString()}$!`;
    resultBanner.style.color = '#f87171';
  } else {
    resultBanner.textContent = `KẾT QUẢ: ${sum} ĐIỂM (${outcome}) (Không đặt cược)`;
    resultBanner.style.color = 'var(--gold-glow)';
  }

  historyData.unshift({
    session: currentSession,
    dices: [...diceResults],
    sum,
    outcome,
    betSide: isBetConfirmed ? betSide : 'Không cược',
    betAmount: isBetConfirmed ? confirmedBetAmount : 0,
    winAmount: isWin ? winAmount - confirmedBetAmount : (isBetConfirmed ? -confirmedBetAmount : 0)
  });

  currentSession++;
  saveData();

  renderHistoryDots();
  renderHistoryTable();
  drawTrendChart();

  setTimeout(() => {
    document.getElementById('session-num').textContent = currentSession;
    betSide = null;
    tempBetAmount = 0;
    confirmedBetAmount = 0;
    isBetConfirmed = false;

    btnConfirm.disabled = false;
    btnConfirm.textContent = '✔ XÁC NHẬN';

    zoneTai.classList.remove('win-glow-tai');
    zoneXiu.classList.remove('win-glow-xiu');
    updateUI();

    bowlEl.style.transform = 'translate(0, 0)';
    resultBanner.textContent = 'CHỌN CỬA - NHẬP CHIP - BẤM XÁC NHẬN';
    resultBanner.style.color = 'var(--gold-glow)';

    countdown = 15;
    gameState = 'BETTING';
    timerStateEl.textContent = 'ĐANG ĐẶT CƯỢC';
  }, 5000);
}

function saveData() {
  localStorage.setItem('sunbip_balance', balance);
  localStorage.setItem('sunbip_session', currentSession);
  localStorage.setItem('sunbip_history', JSON.stringify(historyData));
}

// Modal Deposit
const modalDeposit = document.getElementById('modal-deposit');
document.getElementById('btn-open-deposit').addEventListener('click', () => modalDeposit.classList.add('open'));
document.getElementById('btn-close-deposit').addEventListener('click', () => modalDeposit.classList.remove('open'));

function setDepositVal(val) {
  document.getElementById('deposit-input').value = val;
}

document.getElementById('btn-submit-deposit').addEventListener('click', () => {
  let val = parseInt(document.getElementById('deposit-input').value);
  if (!isNaN(val) && val > 0) {
    balance += val;
    saveData();
    updateUI();
    playSound('chip');
    modalDeposit.classList.remove('open');
    document.getElementById('deposit-input').value = '';
  } else {
    alert('Vui lòng nhập số tiền hợp lệ!');
  }
});

function showFloatingMoney(text) {
  const el = document.createElement('div');
  el.className = 'floating-money';
  el.textContent = text;
  document.querySelector('.casino-app').appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function renderHistoryDots() {
  const container = document.getElementById('history-dots');
  if (!container) return;
  container.innerHTML = historyData.slice(0, 8).map(h => `
    <div class="dot-item ${h.outcome === 'Tài' ? 'tai' : 'xiu'}">${h.sum}</div>
  `).join('');
}

function renderHistoryTable() {
  const tbody = document.getElementById('hist-table-body');
  if (!tbody) return;
  tbody.innerHTML = historyData.map(h => {
    let winClass = h.winAmount > 0 ? 'win-text' : (h.winAmount < 0 ? 'lose-text' : '');
    let winTxt = h.winAmount > 0 ? `+${h.winAmount.toLocaleString()}$` : (h.winAmount < 0 ? `${h.winAmount.toLocaleString()}$` : '0$');
    return `
      <tr>
        <td>#${h.session}</td>
        <td>${h.dices.join('-')} (${h.sum})</td>
        <td style="color:${h.outcome==='Tài'?'var(--tai-red)':'var(--xiu-blue)'}; font-weight:bold">${h.outcome}</td>
        <td>${h.betSide !== 'Không cược' ? `${h.betSide} (${h.betAmount.toLocaleString()}$)` : 'Không đặt'}</td>
        <td class="${winClass}">${winTxt}</td>
      </tr>
    `;
  }).join('');
}

// Trend Chart
function drawTrendChart() {
  const canvas = document.getElementById('trendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const lastRounds = historyData.slice(0, 15).reverse();
  if (lastRounds.length === 0) {
    if (ratioText) ratioText.textContent = `Tài: 50% - Xỉu: 50%`;
    return;
  }

  let taiCount = lastRounds.filter(r => r.outcome === 'Tài').length;
  let total = lastRounds.length;
  let taiPercent = Math.round((taiCount / total) * 100);
  let xiuPercent = 100 - taiPercent;

  if (ratioText) ratioText.textContent = `Tài: ${taiPercent}% - Xỉu: ${xiuPercent}%`;

  const stepX = canvas.width / 15;
  ctx.beginPath();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 2;

  lastRounds.forEach((r, idx) => {
    const x = idx * stepX + stepX / 2;
    const y = 50 - ((r.sum - 3) / 15) * 40;
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  lastRounds.forEach((r, idx) => {
    const x = idx * stepX + stepX / 2;
    const y = 50 - ((r.sum - 3) / 15) * 40;

    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = r.outcome === 'Tài' ? '#ef4444' : '#3b82f6';
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.sum, x, y + 3);
  });
}

// Modal History
const modal = document.getElementById('modal-hist');
document.getElementById('btn-open-modal').addEventListener('click', () => modal.classList.add('open'));
document.getElementById('btn-close-modal').addEventListener('click', () => modal.classList.remove('open'));
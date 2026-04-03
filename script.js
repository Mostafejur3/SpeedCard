// ========== GLOBAL STATE ==========
let allCards = [];
let currentDeckCards = [];
let currentCardIndex = 0;
let showDetails = false;
let missionMode = false;
let missionActive = false;
let missionPaused = false;
let missionStartTime = null;
let cardStartTime = null;
let cardTimes = [];
let globalHistory = [];
let bookmarkedIndices = new Set();
let cardReviewCount = new Map();
let randomOrderEnabled = false;
let currentConfigBasis = 'All Cards (1-100)';
let currentConfigCards = [];

// ========== DOM ELEMENTS ==========
const chineseWordEl = document.getElementById('chineseWord');
const detailsArea = document.getElementById('detailsArea');
const missionTimerSpan = document.getElementById('missionTimer');
const cardTimerSpan = document.getElementById('cardTimer');
const cardProgressSpan = document.getElementById('cardProgress');
const missionModeToggle = document.getElementById('missionModeToggle');
const pauseMissionBtn = document.getElementById('pauseMissionBtn');
const completeMissionBtn = document.getElementById('completeMissionBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const missionStats = document.getElementById('missionStats');
const historyListDiv = document.getElementById('historyList');
const resetBtn = document.getElementById('clearAllHistoryBtn');
const resetModal = document.getElementById('resetModal');
const confirmResetBtn = document.getElementById('confirmResetBtn');
const cancelResetBtn = document.getElementById('cancelResetBtn');
const bookmarkBtn = document.getElementById('bookmarkBtn');
const themeToggle = document.getElementById('themeToggle');
const applyConfigBtn = document.getElementById('applyConfigBtn');
const randomOrderToggle = document.getElementById('randomOrderToggle');
const cardIdBadge = document.getElementById('cardIdBadge');
const modeIndicator = document.getElementById('modeIndicator');
const quickBookmarkBtn = document.getElementById('quickBookmarkBtn');

// ========== LOAD DATA ==========
async function loadData() {
    try {
        const response = await fetch('data.json');
        allCards = await response.json();
        loadHistoryFromLocal();
        loadBookmarks();
        loadReviewCounts();
        updateHistoryUI();
        
        // Initialize with default config (IDs 1-100)
        applyDefaultConfig();
    } catch (error) {
        console.error('Error loading JSON:', error);
        allCards = [
            { id: 1, chinese: "你好", pinyin: "nǐ hǎo", meaning: "Hello" },
            { id: 2, chinese: "谢谢", pinyin: "xiè xiè", meaning: "Thank you" },
            { id: 3, chinese: "再见", pinyin: "zài jiàn", meaning: "Goodbye" }
        ];
        applyDefaultConfig();
    }
}

function applyDefaultConfig() {
    const defaultCards = allCards.filter(card => card.id >= 1 && card.id <= 100);
    applyConfiguration(defaultCards, '📊 Range: 1-100');
}

function applyConfiguration(cards, basisText) {
    if (!cards.length) return;
    
    currentConfigCards = [...cards];
    currentConfigBasis = basisText;
    
    let deckCards = [...cards];
    if (randomOrderEnabled) {
        deckCards = shuffleArray(deckCards);
    }
    
    currentDeckCards = deckCards;
    currentCardIndex = 0;
    showDetails = false;
    
    renderCard();
    updateBookmarkIcon();
    updateCardIdBadge();
    
    // Reset mission stats if mission mode is on
    if (missionMode && missionActive) {
        resetMissionTimers();
    }
}

function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function renderCard() {
    if (!currentDeckCards.length) return;
    const card = currentDeckCards[currentCardIndex];
    chineseWordEl.innerText = card.chinese;
    
    if (showDetails) {
        detailsArea.innerHTML = `<div class="pinyin">${card.pinyin}</div>
                                 <div class="meaning">${card.meaning}</div>`;
    } else {
        detailsArea.innerHTML = '';
    }
    
    if (missionActive && missionMode) {
        cardProgressSpan.innerText = `${currentCardIndex + 1} / ${currentDeckCards.length}`;
    }
    
    updateBookmarkIcon();
    updateCardIdBadge();
}

function updateCardIdBadge() {
    if (currentDeckCards[currentCardIndex]) {
        cardIdBadge.innerText = `#${currentDeckCards[currentCardIndex].id}`;
        cardIdBadge.style.display = 'inline-flex';
    } else {
        cardIdBadge.style.display = 'none';
    }
}

// ========== NEXT/PREV with Show Details Logic ==========
function nextCard() {
    // If details not shown yet, show them first
    if (!showDetails) {
        showDetails = true;
        renderCard();
        return;
    }
    
    // Details are shown, move to next card
    // Record time for current card if mission is active
    if (missionActive && missionMode) {
        recordCardTime();
        
        // Update review count
        const currentCard = currentDeckCards[currentCardIndex];
        const count = cardReviewCount.get(currentCard.chinese) || 0;
        cardReviewCount.set(currentCard.chinese, count + 1);
        saveReviewCounts();
    }
    
    // Move to next card
    if (currentCardIndex + 1 < currentDeckCards.length) {
        currentCardIndex++;
        showDetails = false;
        renderCard();
        
        // Reset card timer for new card
        if (missionActive && missionMode) {
            resetCardTimer();
        }
    } else if (missionActive && missionMode) {
        // End of deck in mission mode
        completeMission();
    } else {
        // Loop in practice mode
        currentCardIndex = (currentCardIndex + 1) % currentDeckCards.length;
        showDetails = false;
        renderCard();
    }
}

function prevCard() {
    if (!showDetails) {
        // Go to previous card
        if (currentCardIndex - 1 >= 0) {
            currentCardIndex--;
            showDetails = false;
            renderCard();
            
            if (missionActive && missionMode) {
                resetCardTimer();
            }
        } else if (!missionActive && currentCardIndex === 0) {
            // Loop to end in practice mode
            currentCardIndex = currentDeckCards.length - 1;
            showDetails = false;
            renderCard();
        }
    } else {
        // Just hide details
        showDetails = false;
        renderCard();
    }
}

// ========== CARD TIMER FUNCTIONS ==========
function recordCardTime() {
    if (cardStartTime && !missionPaused) {
        const elapsed = (Date.now() - cardStartTime) / 1000;
        if (elapsed > 0 && cardTimes[currentCardIndex] !== undefined) {
            cardTimes[currentCardIndex] = elapsed;
        }
    }
}

function resetCardTimer() {
    cardStartTime = Date.now();
    if (missionActive && missionMode && !missionPaused) {
        updateCardTimerDisplay();
    }
}

function startMissionTimer() {
    if (missionStartTime || missionPaused || !missionActive) return;
    missionStartTime = Date.now();
    updateMissionTimerDisplay();
}

function updateMissionTimerDisplay() {
    if (!missionActive || missionPaused || !missionStartTime) return;
    const elapsed = (Date.now() - missionStartTime) / 1000;
    missionTimerSpan.innerText = elapsed.toFixed(2);
    requestAnimationFrame(updateMissionTimerDisplay);
}

let cardTimerRAF = null;
function updateCardTimerDisplay() {
    if (!missionActive || missionPaused || !cardStartTime) {
        if (cardTimerRAF) cancelAnimationFrame(cardTimerRAF);
        return;
    }
    const elapsed = (Date.now() - cardStartTime) / 1000;
    cardTimerSpan.innerText = elapsed.toFixed(2);
    cardTimerRAF = requestAnimationFrame(updateCardTimerDisplay);
}

function resetMissionTimers() {
    if (missionStartTime) {
        missionStartTime = Date.now();
    }
    if (cardStartTime) {
        cardStartTime = Date.now();
    }
}

function stopMissionTimers() {
    if (cardTimerRAF) cancelAnimationFrame(cardTimerRAF);
    cardTimerRAF = null;
}

// ========== MISSION MODE TOGGLE ==========
missionModeToggle.addEventListener('change', (e) => {
    missionMode = e.target.checked;
    
    if (missionMode) {
        modeIndicator.innerHTML = '🎯 Mission Mode (Recording)';
        startNewMission();
    } else {
        modeIndicator.innerHTML = '📖 Practice Mode';
        if (missionActive) {
            endMissionWithoutSaving();
        }
        missionStats.style.display = 'none';
        missionActive = false;
        missionPaused = false;
    }
});

function startNewMission() {
    // End any existing mission
    if (missionActive) {
        endMissionWithoutSaving();
    }
    
    // Start new mission
    missionActive = true;
    missionPaused = false;
    missionStartTime = null;
    cardTimes = new Array(currentDeckCards.length).fill(0);
    
    missionStats.style.display = 'block';
    
    // Reset current card to beginning of deck
    currentCardIndex = 0;
    showDetails = false;
    renderCard();
    
    // Start timers
    startMissionTimer();
    cardStartTime = Date.now();
    updateCardTimerDisplay();
    
    if (pauseMissionBtn) pauseMissionBtn.innerText = '⏸️ Pause';
}

function endMissionWithoutSaving() {
    stopMissionTimers();
    missionActive = false;
    missionPaused = false;
    missionStartTime = null;
    cardStartTime = null;
    missionStats.style.display = 'none';
}

// ========== PAUSE MISSION ==========
let missionPausedAt = null;
let cardPausedAt = null;

function pauseMission() {
    if (!missionActive || !missionMode) return;
    
    if (missionPaused) {
        // Resume
        missionPaused = false;
        pauseMissionBtn.innerText = '⏸️ Pause';
        
        // Adjust timers for pause duration
        const pauseDuration = Date.now() - missionPausedAt;
        if (missionStartTime) missionStartTime += pauseDuration;
        if (cardStartTime) cardStartTime += pauseDuration;
        
        startMissionTimer();
        updateCardTimerDisplay();
    } else {
        // Pause
        missionPaused = true;
        pauseMissionBtn.innerText = '▶️ Resume';
        missionPausedAt = Date.now();
        cardPausedAt = Date.now();
        
        stopMissionTimers();
        if (cardTimerRAF) cancelAnimationFrame(cardTimerRAF);
        cardTimerRAF = null;
    }
}

if (pauseMissionBtn) pauseMissionBtn.addEventListener('click', pauseMission);

// ========== COMPLETE MISSION ==========
function completeMission() {
    if (!missionActive || !missionMode) return;
    
    // Record final card time
    if (cardStartTime && !missionPaused) {
        const elapsed = (Date.now() - cardStartTime) / 1000;
        if (elapsed > 0 && cardTimes[currentCardIndex] !== undefined) {
            cardTimes[currentCardIndex] = elapsed;
        }
    }
    
    // Calculate total time
    let totalTime = 0;
    for (let i = 0; i < cardTimes.length; i++) {
        if (cardTimes[i] > 0) totalTime += cardTimes[i];
    }
    
    // Also include current card if not recorded
    if (cardStartTime && !missionPaused && showDetails) {
        const currentTime = (Date.now() - cardStartTime) / 1000;
        if (currentTime > 0) totalTime += currentTime;
    }
    
    const record = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        basis: currentConfigBasis,
        totalCards: currentDeckCards.length,
        totalTime: totalTime.toFixed(2),
        avgTime: (totalTime / currentDeckCards.length).toFixed(3),
        cardDetails: currentDeckCards.map((card, idx) => ({
            id: card.id,
            chinese: card.chinese,
            timeSpent: cardTimes[idx] || 0
        }))
    };
    
    globalHistory.unshift(record);
    saveHistoryToLocal();
    updateHistoryUI();
    
    // End mission
    stopMissionTimers();
    missionActive = false;
    missionPaused = false;
    missionStartTime = null;
    cardStartTime = null;
    missionStats.style.display = 'none';
    
    // Uncheck mission mode toggle
    missionModeToggle.checked = false;
    missionMode = false;
    modeIndicator.innerHTML = '📖 Practice Mode';
    
    alert(`✅ Mission Complete!\n${currentDeckCards.length} cards\nTotal time: ${totalTime.toFixed(2)}s\nAverage: ${(totalTime / currentDeckCards.length).toFixed(3)}s/card`);
}

if (completeMissionBtn) completeMissionBtn.addEventListener('click', completeMission);

// ========== APPLY CONFIGURATION ==========
applyConfigBtn.addEventListener('click', () => {
    const activeTab = document.querySelector('.customizer-tab.active').dataset.customTab;
    let selectedCards = [];
    let basisText = '';
    
    if (activeTab === 'range') {
        const start = parseInt(document.getElementById('rangeStart').value) || 1;
        const end = parseInt(document.getElementById('rangeEnd').value) || allCards.length;
        selectedCards = allCards.filter(card => card.id >= start && card.id <= end);
        basisText = `📊 Range: ${start} - ${end}`;
    } else if (activeTab === 'list') {
        const idsText = document.getElementById('customIdsList').value;
        const ids = idsText.split(/[ ,\n]+/).filter(s => s.trim()).map(Number).filter(n => !isNaN(n));
        selectedCards = allCards.filter(card => ids.includes(card.id));
        basisText = `📝 Custom IDs: ${ids.length} cards`;
    }
    
    if (selectedCards.length) {
        applyConfiguration(selectedCards, basisText);
        
        // If mission mode is active, restart mission with new deck
        if (missionMode && missionActive) {
            startNewMission();
        }
    } else {
        alert('No valid cards selected!');
    }
});

// Smart filters
document.querySelectorAll('.smart-filter').forEach(btn => {
    btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        let filteredCards = [];
        let basisText = '';
        
        switch(filter) {
            case 'time_gt_0.5':
                filteredCards = allCards.filter(card => getTotalTimeForCard(card.chinese) > 0.5);
                basisText = '⏱️ Time > 0.5s';
                break;
            case 'time_gt_1':
                filteredCards = allCards.filter(card => getTotalTimeForCard(card.chinese) > 1);
                basisText = '⏱️ Time > 1s';
                break;
            case 'time_lt_0.03':
                filteredCards = allCards.filter(card => {
                    const time = getTotalTimeForCard(card.chinese);
                    return time > 0 && time < 0.03;
                });
                basisText = '⚡ Time < 0.03s';
                break;
            case 'view_lt_5':
                filteredCards = allCards.filter(card => getViewCount(card.chinese) < 5);
                basisText = '👁️ Viewed < 5 times';
                break;
            case 'view_lt_3':
                filteredCards = allCards.filter(card => getViewCount(card.chinese) < 3);
                basisText = '👁️ Viewed < 3 times';
                break;
            case 'view_eq_0':
                filteredCards = allCards.filter(card => getViewCount(card.chinese) === 0);
                basisText = '🆕 Unseen Cards';
                break;
            case 'most_slow':
                filteredCards = [...allCards].sort((a, b) => 
                    getTotalTimeForCard(b.chinese) - getTotalTimeForCard(a.chinese)
                ).slice(0, 20);
                basisText = '🐢 Slowest 20 Cards';
                break;
            case 'most_speedy':
                filteredCards = [...allCards].filter(c => getTotalTimeForCard(c.chinese) > 0)
                    .sort((a, b) => 
                        getTotalTimeForCard(a.chinese) - getTotalTimeForCard(b.chinese)
                    ).slice(0, 20);
                basisText = '⚡ Fastest 20 Cards';
                break;
            case 'needs_practice':
                filteredCards = allCards.filter(card => {
                    const time = getTotalTimeForCard(card.chinese);
                    return time > 0.05 && time < 0.2;
                });
                basisText = '📖 Needs Practice (0.05-0.2s)';
                break;
        }
        
        if (filteredCards.length) {
            applyConfiguration(filteredCards, basisText);
            if (missionMode && missionActive) {
                startNewMission();
            }
        } else {
            alert('No cards match this filter!');
        }
    });
});

// Quick bookmark button
if (quickBookmarkBtn) {
    quickBookmarkBtn.addEventListener('click', () => {
        const bookmarkedCards = allCards.filter(card => bookmarkedIndices.has(card.id));
        if (bookmarkedCards.length) {
            applyConfiguration(bookmarkedCards, '⭐ Bookmarked Cards');
            if (missionMode && missionActive) {
                startNewMission();
            }
        } else {
            alert('No bookmarked cards found!');
        }
    });
}

// Random order toggle
if (randomOrderToggle) {
    randomOrderToggle.addEventListener('change', (e) => {
        randomOrderEnabled = e.target.checked;
        // Re-apply current configuration with new random setting
        if (currentConfigCards.length) {
            applyConfiguration(currentConfigCards, currentConfigBasis);
        }
    });
}

// Preset ranges
document.querySelectorAll('.preset-range').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('rangeStart').value = btn.dataset.start;
        document.getElementById('rangeEnd').value = btn.dataset.end;
    });
});

// Tab switching
document.querySelectorAll('.customizer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.customizer-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.customizer-panel').forEach(panel => panel.classList.remove('active'));
        const tabId = tab.dataset.customTab;
        if (tabId === 'range') document.getElementById('rangeTab').classList.add('active');
        if (tabId === 'list') document.getElementById('listTab').classList.add('active');
        if (tabId === 'smart') document.getElementById('smartTab').classList.add('active');
    });
});

// Helper functions for stats
function getTotalTimeForCard(chineseWord) {
    let totalTime = 0;
    globalHistory.forEach(mission => {
        const found = mission.cardDetails?.find(c => c.chinese === chineseWord);
        if (found) totalTime += found.timeSpent;
    });
    return totalTime;
}

function getViewCount(chineseWord) {
    return cardReviewCount.get(chineseWord) || 0;
}

// ========== BOOKMARK ==========
function toggleBookmark() {
    if (!currentDeckCards[currentCardIndex]) return;
    
    const cardToBookmark = currentDeckCards[currentCardIndex];
    
    if (bookmarkedIndices.has(cardToBookmark.id)) {
        bookmarkedIndices.delete(cardToBookmark.id);
        bookmarkBtn.innerText = '☆';
    } else {
        bookmarkedIndices.add(cardToBookmark.id);
        bookmarkBtn.innerText = '★';
    }
    saveBookmarks();
}

function updateBookmarkIcon() {
    if (currentDeckCards[currentCardIndex]) {
        bookmarkBtn.innerText = bookmarkedIndices.has(currentDeckCards[currentCardIndex].id) ? '★' : '☆';
    } else {
        bookmarkBtn.innerText = '☆';
    }
}

if (bookmarkBtn) bookmarkBtn.addEventListener('click', toggleBookmark);

// ========== HISTORY UI ==========
function updateHistoryUI() {
    if (!globalHistory.length) {
        historyListDiv.innerHTML = '<div class="empty-history">No missions yet</div>';
        return;
    }
    
    let html = '';
    globalHistory.forEach(mission => {
        html += `
            <div class="history-item" data-mission-id="${mission.id}">
                <div class="history-date">${mission.date}</div>
                <div class="history-basis">🎯 ${mission.basis || 'Custom'}</div>
                <div class="history-stats">
                    <span>📊 ${mission.totalCards} cards</span>
                    <span>⏱️ ${mission.totalTime}s</span>
                    <span>📈 ${mission.avgTime}s/avg</span>
                </div>
                <button class="delete-mission" data-id="${mission.id}">🗑️</button>
            </div>
        `;
    });
    historyListDiv.innerHTML = html;
    
    document.querySelectorAll('.delete-mission').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.id);
            deleteMissionById(id);
        });
    });
}

function deleteMissionById(id) {
    globalHistory = globalHistory.filter(m => m.id !== id);
    saveHistoryToLocal();
    updateHistoryUI();
}

// Clear all history
if (resetBtn) {
    resetBtn.addEventListener('click', () => resetModal.style.display = 'flex');
}

if (confirmResetBtn) {
    confirmResetBtn.addEventListener('click', () => {
        globalHistory = [];
        saveHistoryToLocal();
        updateHistoryUI();
        resetModal.style.display = 'none';
        alert('Mission history cleared!');
    });
}

if (cancelResetBtn) cancelResetBtn.addEventListener('click', () => resetModal.style.display = 'none');

// ========== DARK MODE ==========
if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme');
        if (currentTheme === 'light') {
            body.setAttribute('data-theme', 'dark');
            themeToggle.innerText = '☀️';
        } else {
            body.setAttribute('data-theme', 'light');
            themeToggle.innerText = '🌙';
        }
    });
}

// ========== NAVIGATION HANDLERS ==========
if (prevBtn) prevBtn.onclick = prevCard;
if (nextBtn) nextBtn.onclick = nextCard;

// Keyboard navigation
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextCard();
    } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        prevCard();
    }
});

// Flashcard click also shows details (but we already have next button logic)
document.getElementById('flashcard')?.addEventListener('click', (e) => {
    if (!e.target.closest('.bookmark-icon')) {
        if (!showDetails) {
            showDetails = true;
            renderCard();
        }
    }
});

// ========== LOCAL STORAGE ==========
function saveHistoryToLocal() { localStorage.setItem('speedcards_history', JSON.stringify(globalHistory)); }
function loadHistoryFromLocal() {
    const saved = localStorage.getItem('speedcards_history');
    if (saved) { globalHistory = JSON.parse(saved); updateHistoryUI(); }
}
function saveReviewCounts() { localStorage.setItem('speedcards_review_counts', JSON.stringify([...cardReviewCount])); }
function loadReviewCounts() {
    const saved = localStorage.getItem('speedcards_review_counts');
    if (saved) { cardReviewCount = new Map(JSON.parse(saved)); }
}
function saveBookmarks() { localStorage.setItem('speedcards_bookmarks', JSON.stringify([...bookmarkedIndices])); }
function loadBookmarks() {
    const saved = localStorage.getItem('speedcards_bookmarks');
    if (saved) { bookmarkedIndices = new Set(JSON.parse(saved)); }
}

// ========== MOBILE MENU ==========
const menuToggle = document.getElementById('menuToggle');
const menuOverlay = document.getElementById('menuOverlay');
const sidebar = document.getElementById('sidebar');
const closeMenu = document.getElementById('closeMenu');

if (menuToggle) {
    menuToggle.addEventListener('click', () => {
        sidebar.classList.add('open');
        menuOverlay.classList.add('active');
    });
}

function closeSidebar() {
    sidebar.classList.remove('open');
    menuOverlay.classList.remove('active');
}

if (closeMenu) closeMenu.addEventListener('click', closeSidebar);
if (menuOverlay) menuOverlay.addEventListener('click', closeSidebar);

// ========== INIT ==========
loadData();
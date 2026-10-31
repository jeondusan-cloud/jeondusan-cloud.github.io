/**
 * O's Dan — 메인 컨트롤러
 * - O's Dan 주제: 오늘의 단어 단독 표시 (좌우 < > 화살표 숨김)
 * - 그 외 주제(전체 무작위 ~ 시스템·패러다임): 가운데 사각형 좌우에 < > 화살표 표시 및 새로운 단어/주제 추출
 */
(function () {
  const SPECTRUM_LABELS = {
    osdan: "O's Dan · 오늘의 단어",
    all: '전체 무작위',
    word: '단어 · 낱말',
    wiki: '실시간 백과사전 (Wiki)',
    science: '과학 · 수학 · 자연',
    humanities: '철학 · 예술 · 사유',
    system: '시스템 · 패러다임'
  };

  let currentSpectrum = 'osdan';
  let currentEntry = null;
  let lastOsDanDateKey = '';

  // 스펙트럼별 이전 단어 기록 스택 (< 버튼 탐색 지원)
  const historyStacks = {
    all: [],
    word: [],
    wiki: [],
    science: [],
    humanities: [],
    system: []
  };

  function toggleMenu(forceOpen) {
    const btn = document.getElementById('hamburgerBtn');
    const dropdown = document.getElementById('topicDropdown');
    const backdrop = document.getElementById('menuBackdrop');
    if (!btn || !dropdown || !backdrop) return;

    const isOpen =
      typeof forceOpen === 'boolean' ? forceOpen : !dropdown.classList.contains('open');

    btn.classList.toggle('open', isOpen);
    btn.setAttribute('aria-expanded', String(isOpen));
    dropdown.classList.toggle('open', isOpen);
    backdrop.classList.toggle('open', isOpen);
  }

  function updateArrowVisibility(spectrum) {
    const prevBtn = document.getElementById('prevWordBtn');
    const nextBtn = document.getElementById('nextWordBtn');
    const showArrows = spectrum !== 'osdan';

    prevBtn?.classList.toggle('hidden', !showArrows);
    nextBtn?.classList.toggle('hidden', !showArrows);
  }

  function renderCardContent({ dotDate, spectrum, entry }) {
    currentEntry = entry;

    const dateEl = document.getElementById('todayDateText');
    const specPillEl = document.getElementById('todaySpectrumPill');
    const catEl = document.getElementById('todayCategoryText');
    const titleEl = document.getElementById('todayWordTitle');
    const subEl = document.getElementById('todayWordSub');
    const descEl = document.getElementById('todayWordDesc');

    if (dateEl) dateEl.textContent = dotDate;
    if (specPillEl) specPillEl.textContent = SPECTRUM_LABELS[spectrum] || SPECTRUM_LABELS.osdan;
    if (catEl) catEl.textContent = entry.domain || '오늘의 단어';
    if (titleEl) titleEl.textContent = entry.title;
    if (subEl) subEl.textContent = entry.subtitle || '';
    if (descEl) descEl.textContent = entry.summary;
  }

  async function runWithTransition(withTransition, taskFn) {
    const cardWrap = document.getElementById('todayCardWrap');
    if (withTransition && cardWrap) {
      cardWrap.classList.add('switching');
      await new Promise((resolve) => setTimeout(resolve, 160));
    }

    await taskFn();

    if (withTransition && cardWrap) {
      requestAnimationFrame(() => {
        cardWrap.classList.remove('switching');
      });
    }
  }

  async function selectSpectrum(spectrum, withTransition = true) {
    currentSpectrum = spectrum;

    // 햄버거 메뉴 내 활성 상태 표시 업데이트
    document.querySelectorAll('.topic-link').forEach((link) => {
      link.classList.toggle('active', link.getAttribute('data-spectrum') === spectrum);
    });

    // O's Dan 외의 주제에서만 좌우 < > 화살표 표시
    updateArrowVisibility(spectrum);

    await runWithTransition(withTransition, async () => {
      if (spectrum === 'osdan') {
        const todayData = window.dailyEngine.getOsDanTodayPick(new Date());
        lastOsDanDateKey = todayData.dateKey;
        renderCardContent({
          dotDate: todayData.dotDate,
          spectrum: 'osdan',
          entry: todayData.entry
        });
      } else {
        const drawn = await window.dailyEngine.drawRandomBySpectrum(
          spectrum,
          currentEntry ? currentEntry.title : ''
        );
        renderCardContent({
          dotDate: drawn.dotDate,
          spectrum,
          entry: drawn.entry
        });
      }
    });
  }

  // 오른쪽 화살표(>) 클릭: 현재 주제에서 새로운 단어·주제 추출
  async function handleNextWord() {
    if (currentSpectrum === 'osdan') return;

    if (currentEntry && historyStacks[currentSpectrum]) {
      historyStacks[currentSpectrum].push(currentEntry);
      if (historyStacks[currentSpectrum].length > 40) {
        historyStacks[currentSpectrum].shift();
      }
    }

    await runWithTransition(true, async () => {
      const drawn = await window.dailyEngine.drawRandomBySpectrum(
        currentSpectrum,
        currentEntry ? currentEntry.title : ''
      );
      renderCardContent({
        dotDate: drawn.dotDate,
        spectrum: currentSpectrum,
        entry: drawn.entry
      });
    });
  }

  // 왼쪽 화살표(<) 클릭: 이전 기록이 있으면 이전 단어, 없으면 새로운 단어 추출
  async function handlePrevWord() {
    if (currentSpectrum === 'osdan') return;

    const stack = historyStacks[currentSpectrum];
    await runWithTransition(true, async () => {
      if (stack && stack.length > 0) {
        const prevEntry = stack.pop();
        renderCardContent({
          dotDate: window.dailyEngine.formatDotDate(new Date()),
          spectrum: currentSpectrum,
          entry: prevEntry
        });
      } else {
        const drawn = await window.dailyEngine.drawRandomBySpectrum(
          currentSpectrum,
          currentEntry ? currentEntry.title : ''
        );
        renderCardContent({
          dotDate: drawn.dotDate,
          spectrum: currentSpectrum,
          entry: drawn.entry
        });
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (window.wikiService) {
      window.wikiService.init();
    }

    // 초기 화면: O's Dan (오늘의 단어)
    selectSpectrum('osdan', false);

    // 햄버거 버튼 클릭
    document.getElementById('hamburgerBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMenu();
    });

    // 배경 클릭 시 메뉴 닫기
    document.getElementById('menuBackdrop')?.addEventListener('click', () => {
      toggleMenu(false);
    });

    // 주제 항목 클릭 시 전환
    document.querySelectorAll('.topic-link').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetSpec = btn.getAttribute('data-spectrum') || 'osdan';
        toggleMenu(false);
        selectSpectrum(targetSpec, true);
      });
    });

    // 상단 O's Dan 로고 클릭 시 O's Dan(오늘의 단어)으로 이동
    document.getElementById('brandHomeBtn')?.addEventListener('click', () => {
      toggleMenu(false);
      selectSpectrum('osdan', true);
    });

    // 좌우 < > 화살표 클릭 이벤트
    document.getElementById('prevWordBtn')?.addEventListener('click', () => {
      handlePrevWord();
    });

    document.getElementById('nextWordBtn')?.addEventListener('click', () => {
      handleNextWord();
    });

    // 키보드 단축키 (좌우 방향키 및 Esc)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        toggleMenu(false);
      } else if (e.key === 'ArrowRight' && currentSpectrum !== 'osdan') {
        handleNextWord();
      } else if (e.key === 'ArrowLeft' && currentSpectrum !== 'osdan') {
        handlePrevWord();
      }
    });

    // 자정이 지나 날짜가 바뀌면 O's Dan 오늘의 단어 자동 갱신
    setInterval(() => {
      if (currentSpectrum === 'osdan') {
        const nowKey = window.dailyEngine.formatDateKey(new Date());
        if (nowKey !== lastOsDanDateKey) {
          selectSpectrum('osdan', false);
        }
      }
    }, 30000);
  });
})();

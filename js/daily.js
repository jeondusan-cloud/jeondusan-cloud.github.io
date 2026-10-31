/**
 * O's Dan — Daily & Spectrum Word Engine
 * - O's Dan 주제: 매일의 날짜(YYYY-MM-DD)를 고유 시드로 삼아 '오늘의 단어'를 고정 표시
 * - 그 외 주제(전체 무작위 ~ 시스템·패러다임): 해당 주제에 맞는 새로운 단어·주제를 자유롭게 추출
 */
class DailyEditionEngine {
  constructor() {
    this.seenTitles = new Set();
  }

  formatDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  formatDotDate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}. ${m}. ${d}`;
  }

  hashDateString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  createSeededRng(seed) {
    let a = seed >>> 0;
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  getAllLocalEntries() {
    return [
      ...window.OMNI_LEXICON.CURATED_ENTRIES,
      ...window.OMNI_LEXICON.INSTANT_WORD_BANK
    ];
  }

  /**
   * O's Dan 주제 전용: 오늘의 날짜에 해당하는 단 하나의 '오늘의 단어' 반환
   * - 연도별 고유 시드로 전체 단어장을 완벽히 섞은(Fisher-Yates Shuffle) 뒤,
   *   그해의 날짜 순서(Day of Year)에 따라 하루에 하나씩 꺼내므로 매일 겹치지 않고 새로운 단어가 나옵니다.
   */
  getOsDanTodayPick(dateObj = new Date()) {
    const dateKey = this.formatDateKey(dateObj);
    const dotDate = this.formatDotDate(dateObj);
    const allEntries = [...this.getAllLocalEntries()];

    const year = dateObj.getFullYear();
    const startOfYear = new Date(year, 0, 0);
    const dayOfYear = Math.floor((dateObj - startOfYear) / 86400000);

    // 해당 연도의 시드로 단어장 전체를 결정론적으로 셔플
    const rng = this.createSeededRng(this.hashDateString(`OSDAN-YEAR-${year}`));
    for (let i = allEntries.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [allEntries[i], allEntries[j]] = [allEntries[j], allEntries[i]];
    }

    const index = dayOfYear % allEntries.length;

    return {
      dateKey,
      dotDate,
      entry: allEntries[index]
    };
  }

  /**
   * O's Dan 외의 주제(all, word, wiki, science, humanities, system)에서
   * 해당 주제에 맞는 새로운 단어나 주제를 무작위로 추출합니다.
   */
  async drawRandomBySpectrum(spectrum = 'all', currentTitle = '') {
    const now = new Date();
    const dotDate = this.formatDotDate(now);

    // 1. 실시간 백과사전(wiki) 주제인 경우
    if (spectrum === 'wiki' && window.wikiService) {
      let wikiEntry = window.wikiService.popWikiEntry();
      if (!wikiEntry) {
        await window.wikiService.refillWikiQueue();
        wikiEntry = window.wikiService.popWikiEntry();
      }
      if (wikiEntry) {
        return { dotDate, entry: wikiEntry };
      }
    }

    // 2. 전체 무작위(all)일 때 일정 확률로 실시간 위키백과/위키낱말사전 결합
    if (spectrum === 'all' && window.wikiService) {
      const roll = Math.random();
      if (roll < 0.3) {
        const wikiEntry = window.wikiService.popWikiEntry();
        if (wikiEntry && wikiEntry.title !== currentTitle) {
          return { dotDate, entry: wikiEntry };
        }
      } else if (roll < 0.42) {
        const wiktEntry = window.wikiService.popWiktionaryEntry();
        if (wiktEntry && wiktEntry.title !== currentTitle) {
          return { dotDate, entry: wiktEntry };
        }
      }
    }

    // 3. 단어·낱말(word)일 때 일정 확률로 실시간 위키낱말사전 결합
    if (spectrum === 'word' && window.wikiService && Math.random() < 0.25) {
      const wiktEntry = window.wikiService.popWiktionaryEntry();
      if (wiktEntry && wiktEntry.title !== currentTitle) {
        return { dotDate, entry: wiktEntry };
      }
    }

    // 4. 내장 풀에서 스펙트럼에 맞게 필터링하여 무작위 추출
    const allEntries = this.getAllLocalEntries();
    let pool =
      spectrum === 'all' || spectrum === 'wiki'
        ? allEntries
        : allEntries.filter((item) => item.spectrum === spectrum);

    if (pool.length === 0) pool = allEntries;

    let candidates = pool.filter(
      (item) => item.title !== currentTitle && !this.seenTitles.has(item.title)
    );

    if (candidates.length === 0) {
      this.seenTitles.clear();
      candidates = pool.filter((item) => item.title !== currentTitle);
    }
    if (candidates.length === 0) {
      candidates = pool;
    }

    const picked = candidates[Math.floor(Math.random() * candidates.length)];
    this.seenTitles.add(picked.title);
    if (this.seenTitles.size > 50) {
      const oldest = this.seenTitles.values().next().value;
      this.seenTitles.delete(oldest);
    }

    return {
      dotDate,
      entry: picked
    };
  }
}

window.dailyEngine = new DailyEditionEngine();

/**
 * 실시간 위키백과(Wikipedia) & 위키낱말사전(Wiktionary) 엔트로피 스트림 엔진
 * - 백그라운드 프리패치 큐(Prefetch Buffer)를 운영하여 0.00초 즉시 추출을 보장합니다.
 * - 인류가 기록한 수백만 개의 표제어와 낱말에 실시간으로 접근합니다.
 */
class WikiEntropyService {
  constructor() {
    this.wikiQueue = [];
    this.wordQueue = [];
    this.isFetchingWiki = false;
    this.isFetchingWord = false;
    this.seenTitles = new Set();
    this.totalFetchedCount = 0;

    // 무의미한 단순 목록·동음이의어·행정구역 단신 필터 패턴
    this.noiseTitleRegex = /(동음이의|목록$|^분류:|^[0-9]+년|[0-9]+세기|선거구$|나들목$|분기점$|철도역$)/;
  }

  init() {
    this.refillWikiQueue();
    this.refillWordQueue();
  }

  /**
   * 한국어 위키백과에서 무작위 문서 묶음을 백그라운드로 가져옵니다.
   */
  async refillWikiQueue() {
    if (this.isFetchingWiki || this.wikiQueue.length >= 18) return;
    this.isFetchingWiki = true;

    try {
      const endpoint = new URL('https://ko.wikipedia.org/w/api.php');
      const params = {
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'random',
        grnnamespace: '0',
        grnlimit: '15',
        prop: 'extracts|pageimages|description|links',
        exintro: '1',
        explaintext: '1',
        exchars: '420',
        pithumbsize: '640',
        plnamespace: '0',
        pllimit: '40'
      };
      Object.entries(params).forEach(([k, v]) => endpoint.searchParams.set(k, v));

      const res = await fetch(endpoint.toString());
      if (!res.ok) throw new Error('Wiki API response not ok');
      const data = await res.json();

      if (data && data.query && data.query.pages) {
        const pages = Object.values(data.query.pages);
        for (const page of pages) {
          const parsed = this.normalizeWikiPage(page);
          if (parsed && !this.seenTitles.has(parsed.title)) {
            this.seenTitles.add(parsed.title);
            this.wikiQueue.push(parsed);
            this.totalFetchedCount++;
          }
        }
      }
      this.updateStatusIndicator();
    } catch (err) {
      // 네트워크 오프라인 등의 경우 내장 매트릭스가 폴백으로 동작
    } finally {
      this.isFetchingWiki = false;
    }
  }

  /**
   * 한국어 위키낱말사전(Wiktionary)에서 무작위 낱말을 백그라운드로 가져옵니다.
   */
  async refillWordQueue() {
    if (this.isFetchingWord || this.wordQueue.length >= 12) return;
    this.isFetchingWord = true;

    try {
      const endpoint = new URL('https://ko.wiktionary.org/w/api.php');
      const params = {
        action: 'query',
        format: 'json',
        origin: '*',
        generator: 'random',
        grnnamespace: '0',
        grnlimit: '12',
        prop: 'extracts',
        explaintext: '1',
        exchars: '320'
      };
      Object.entries(params).forEach(([k, v]) => endpoint.searchParams.set(k, v));

      const res = await fetch(endpoint.toString());
      if (!res.ok) throw new Error('Wiktionary API response not ok');
      const data = await res.json();

      if (data && data.query && data.query.pages) {
        const pages = Object.values(data.query.pages);
        for (const page of pages) {
          const parsed = this.normalizeWiktionaryPage(page);
          if (parsed && !this.seenTitles.has(parsed.title)) {
            this.seenTitles.add(parsed.title);
            this.wordQueue.push(parsed);
            this.totalFetchedCount++;
          }
        }
      }
    } catch (_) {
      // 폴백으로 내장 어휘 은행 사용
    } finally {
      this.isFetchingWord = false;
    }
  }

  normalizeWikiPage(page) {
    if (!page || !page.title || !page.extract) return null;
    const title = page.title.trim();
    if (this.noiseTitleRegex.test(title)) return null;

    let cleanExtract = page.extract
      .replace(/\s+/g, ' ')
      .replace(/\(\s*[,;]\s*\)/g, '')
      .trim();

    if (cleanExtract.length < 45) return null;

    // 연관 문서(Links) 추출
    const related = [];
    if (Array.isArray(page.links)) {
      for (const lk of page.links) {
        if (
          lk.title &&
          lk.title.length >= 2 &&
          lk.title.length <= 14 &&
          !this.noiseTitleRegex.test(lk.title) &&
          !/^[0-9]+/.test(lk.title)
        ) {
          related.push(lk.title);
          if (related.length >= 5) break;
        }
      }
    }

    const subtitle = page.description
      ? page.description
      : 'Wikipedia Live Knowledge · 실시간 백과사전 표제어';

    return {
      id: `wiki-${page.pageid || Math.random().toString(36).slice(2, 8)}`,
      title,
      subtitle,
      spectrum: 'wiki',
      domain: page.description ? `백과사전 · ${page.description.slice(0, 18)}` : '위키백과 실시간 추출',
      pos: '백과사전 표제어',
      summary: cleanExtract,
      spark: `세상에 실존하는 '${title}'의 구조나 역사를 전혀 다른 분야의 문제나 창작물에 대입해 본다면 어떤 연결고리가 보일까요?`,
      related: related.length > 0 ? related : ['우연성', '백과사전', '연상', '탐색'],
      wikiUrl: `https://ko.wikipedia.org/wiki/${encodeURIComponent(title)}`,
      thumbnail: page.thumbnail ? page.thumbnail.source : null,
      isLiveWiki: true
    };
  }

  normalizeWiktionaryPage(page) {
    if (!page || !page.title || !page.extract) return null;
    const title = page.title.trim();
    // 지나치게 긴 구절이나 특수문자 제외
    if (title.length < 1 || title.length > 12 || /[:/]/.test(title)) return null;

    const lines = page.extract
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 4 && !/^(발음|번역|유의어|반의어|파생어|합성어|참고|어원|한국어|명사|동사|형용사|부사)$/.test(l));

    const summaryText = lines.slice(0, 3).join(' ').slice(0, 240);
    if (summaryText.length < 18) return null;

    return {
      id: `wikt-${page.pageid || Math.random().toString(36).slice(2, 8)}`,
      title,
      subtitle: 'Wiktionary Live · 실시간 낱말사전 추출',
      spectrum: 'word',
      domain: '위키낱말사전 · 어휘',
      pos: '낱말 · 어휘',
      summary: summaryText,
      spark: `'${title}'라는 낱말이 가진 소리와 본래의 뜻을 낯선 맥락의 제목이나 핵심 열쇠로 사용해 본다면?`,
      related: ['어휘', '은유', '문장', '사전'],
      wikiUrl: `https://ko.wiktionary.org/wiki/${encodeURIComponent(title)}`,
      isLiveWiki: true
    };
  }

  /**
   * 큐에서 즉시 위키백과 항목 1개를 꺼내고, 큐가 부족하면 백그라운드 리필을 트리거합니다.
   */
  popWikiEntry() {
    if (this.wikiQueue.length <= 7) {
      this.refillWikiQueue();
    }
    return this.wikiQueue.shift() || null;
  }

  /**
   * 큐에서 즉시 위키낱말사전 항목 1개를 꺼냅니다.
   */
  popWiktionaryEntry() {
    if (this.wordQueue.length <= 5) {
      this.refillWordQueue();
    }
    return this.wordQueue.shift() || null;
  }

  /**
   * 특정 키워드(연관 태그 클릭 등)로 위키백과 문서를 실시간 조회합니다.
   */
  async fetchTopicByKeyword(keyword) {
    try {
      const endpoint = new URL('https://ko.wikipedia.org/w/api.php');
      const params = {
        action: 'query',
        format: 'json',
        origin: '*',
         prop: 'extracts|pageimages|description|links',
        titles: keyword,
        redirects: '1',
        exintro: '1',
        explaintext: '1',
        exchars: '460',
        pithumbsize: '640',
        plnamespace: '0',
        pllimit: '25'
      };
      Object.entries(params).forEach(([k, v]) => endpoint.searchParams.set(k, v));

      const res = await fetch(endpoint.toString());
      if (!res.ok) return null;
      const data = await res.json();
      if (!data?.query?.pages) return null;

      const page = Object.values(data.query.pages)[0];
      if (!page || page.missing !== undefined || !page.extract) {
        return await this.searchFallbackByKeyword(keyword);
      }

      const normalized = this.normalizeWikiPage(page);
      if (normalized) return normalized;

      return {
        id: `wiki-direct-${Date.now()}`,
        title: page.title || keyword,
        subtitle: page.description || 'Wikipedia 실시간 탐색 결과',
        spectrum: 'wiki',
        domain: '연쇄 탐색 · 백과사전',
        pos: '탐색 주제',
        summary: page.extract.replace(/\s+/g, ' ').trim(),
        spark: `'${keyword}'에서 시작된 생각의 사슬을 한 단계 더 밀어붙이면 어디에 닿을까요?`,
        related: Array.isArray(page.links)
          ? page.links.slice(0, 5).map((l) => l.title)
          : ['연상', '확장'],
        wikiUrl: `https://ko.wikipedia.org/wiki/${encodeURIComponent(page.title || keyword)}`,
        thumbnail: page.thumbnail ? page.thumbnail.source : null,
        isLiveWiki: true
      };
    } catch (_) {
      return null;
    }
  }

  async searchFallbackByKeyword(keyword) {
    try {
      const endpoint = new URL('https://ko.wikipedia.org/w/api.php');
      endpoint.searchParams.set('action', 'query');
      endpoint.searchParams.set('format', 'json');
      endpoint.searchParams.set('origin', '*');
      endpoint.searchParams.set('list', 'search');
      endpoint.searchParams.set('srsearch', keyword);
      endpoint.searchParams.set('srlimit', '1');

      const res = await fetch(endpoint.toString());
      const data = await res.json();
      const firstHit = data?.query?.search?.[0];
      if (firstHit && firstHit.title && firstHit.title !== keyword) {
        return await this.fetchTopicByKeyword(firstHit.title);
      }
      return null;
    } catch (_) {
      return null;
    }
  }

  updateStatusIndicator() {
    const el = document.getElementById('poolCountText');
    if (el) {
      el.textContent = `실시간 위키백과 69만+ 문서 & 만물 사전 연결됨 (버퍼 ${this.wikiQueue.length}개 대기 중)`;
    }
  }
}

window.wikiService = new WikiEntropyService();

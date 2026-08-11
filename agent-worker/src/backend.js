/**
 * my-atlas 백엔드 API 클라이언트 (에이전트 워커용).
 * 폴링 통신: claim → context → results(반복) → complete.
 */

export class BackendClient {
  /**
   * @param {string} baseUrl 백엔드 base URL
   */
  constructor(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = null;
    this.username = null;
    this.password = null;
  }

  async #request(method, path, body, retried = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // 토큰 만료·무효(401/403) → 재로그인 후 1회 재시도 (로그인 경로 자체는 제외해 무한루프 방지)
    if (
      (res.status === 401 || res.status === 403) &&
      !retried &&
      this.username &&
      path !== '/api/auth/login'
    ) {
      await this.login(this.username, this.password);
      return this.#request(method, path, body, true);
    }

    const text = await res.text();
    let json;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (!res.ok) {
      const msg = json?.message || text || res.statusText;
      throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
    }
    // ApiResponse<T> = { success, message, data }
    return json?.data ?? json;
  }

  /** seed admin 로그인 → JWT 저장 (자격증명도 보관해 만료 시 자동 재로그인) */
  async login(username, password) {
    this.username = username;
    this.password = password;
    const data = await this.#request('POST', '/api/auth/login', { username, password });
    this.token = data.token;
    return this.token;
  }

  /** Product별 Job 목록 (최신순) */
  listByProduct(productId) {
    return this.#request('GET', `/api/agent-executions?productId=${productId}`);
  }

  /** Job 점유: PENDING → RUNNING */
  claim(jobId) {
    return this.#request('POST', `/api/agent-executions/${jobId}/claim`);
  }

  /** 실행 컨텍스트(대상 TC + Product 실행 프로파일) */
  getContext(jobId) {
    return this.#request('GET', `/api/agent-executions/${jobId}/context`);
  }

  /** TC 1건 결과 보고 */
  recordResult(jobId, result) {
    return this.#request('POST', `/api/agent-executions/${jobId}/results`, result);
  }

  /** Job 종료 (DONE | FAILED) */
  complete(jobId, status, errorMessage) {
    return this.#request('POST', `/api/agent-executions/${jobId}/complete`, { status, errorMessage });
  }
}

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

  /** @param {string} [rawType] 지정하면 body(Buffer)를 JSON 변환 없이 이 Content-Type으로 그대로 보낸다 */
  async #request(method, path, body, retried = false, rawType) {
    const headers = { 'Content-Type': rawType || 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: rawType ? body : body ? JSON.stringify(body) : undefined,
      // 네트워크가 바뀌면 끊긴 keep-alive 연결에서 응답을 기본 5분까지 기다려 폴링이 멈춘다 (Job 40)
      signal: AbortSignal.timeout(30_000),
    });

    // 토큰 만료·무효(401/403) → 재로그인 후 1회 재시도 (로그인 경로 자체는 제외해 무한루프 방지)
    if (
      (res.status === 401 || res.status === 403) &&
      !retried &&
      this.username &&
      path !== '/api/auth/login'
    ) {
      await this.login(this.username, this.password);
      return this.#request(method, path, body, true, rawType);
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
      throw Object.assign(new Error(`${method} ${path} → ${res.status}: ${msg}`), { status: res.status });
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

  /** Job 단건 조회 (중단 여부 확인용) */
  getJob(jobId) {
    return this.#request('GET', `/api/agent-executions/${jobId}`);
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

  /** 라이브 뷰 프레임 전송. 409(Job이 RUNNING 아님)는 무시한다. */
  async pushFrame(jobId, data, contentType) {
    try {
      await this.#request('PUT', `/api/agent-executions/${jobId}/frame`, data, false, contentType);
    } catch (err) {
      if (err.status !== 409) throw err;
    }
  }

  /** 라이브 TC/step 진행 상황 전송. 409(Job이 RUNNING 아님)는 무시한다. */
  async pushProgress(jobId, payload) {
    try {
      await this.#request('PUT', `/api/agent-executions/${jobId}/progress`, payload);
    } catch (err) {
      if (err.status !== 409) throw err;
    }
  }

  /** Job 종료 (DONE | FAILED) */
  complete(jobId, status, errorMessage) {
    return this.#request('POST', `/api/agent-executions/${jobId}/complete`, { status, errorMessage });
  }
}

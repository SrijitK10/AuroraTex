import { app, shell } from 'electron';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';

// ─── Public Interfaces ──────────────────────────────────────────────────────

export interface GitHubUser {
  login: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface GitHubRepository {
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  url: string;
  cloneUrl: string;
  defaultBranch: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  state: string;
  author: string;
  createdAt: string;
  url: string;
}

export interface GitHubCredentials {
  token: string;
  username: string;
  authMethod?: 'browser' | 'token';
  scopes?: string[];
}

export interface GitHubBrowserAuthSession {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  interval: number;
}

export interface GitHubCollaboratorInvite {
  username: string;
  permission: string;
  status: 'already_collaborator' | 'invited';
  invitationUrl?: string;
}

export interface GitHubCollaborator {
  login: string;
  avatarUrl: string;
  permissions: {
    pull?: boolean;
    triage?: boolean;
    push?: boolean;
    maintain?: boolean;
    admin?: boolean;
  };
}

// ─── Error helper ────────────────────────────────────────────────────────────

/**
 * Extract a plain, IPC-serializable error message from any thrown value.
 * Electron's IPC cannot clone arbitrary Error objects across process
 * boundaries, so we always rethrow with a plain string message.
 */
function toSerializableError(err: unknown): Error {
  if (err instanceof Error) {
    // GitHub API errors from Octokit often have useful `.response.data.message`
    const apiMessage = (err as any)?.response?.data?.message;
    const status = (err as any)?.status || (err as any)?.response?.status;

    let msg = apiMessage || err.message || 'Unknown error';

    // Detect rate-limiting
    if (status === 403 && /rate limit/i.test(msg)) {
      msg = 'GitHub API rate limit exceeded. Please wait a few minutes and try again.';
    }
    // Detect bad credentials
    if (status === 401) {
      msg = 'GitHub authentication failed. Your token may be invalid or expired. Please sign in again.';
    }

    return new Error(msg);
  }
  return new Error(String(err));
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class GitHubService {
  private octokit: any = null;
  private credentials: GitHubCredentials | null = null;
  private credentialsFile: string;
  private OctokitClass: any = null;
  private readonly browserAuthScope = 'repo read:user user:email';
  private initPromise: Promise<void>;

  constructor() {
    this.credentialsFile = join(app.getPath('userData'), '.github-credentials.json');
    this.initPromise = this.loadCredentials();
  }

  // ─── Octokit loader ──────────────────────────────────────────────────────

  /**
   * Lazily load the Octokit class.
   *
   * `@octokit/rest` is an ESM-only package.  The main process is compiled to
   * CommonJS (tsconfig.main.json → "module": "commonjs"), so we use a dynamic
   * `import()` expression.  TypeScript compiles `import()` to `require()` for
   * CommonJS targets by default, but Electron's Node supports real ESM dynamic
   * import, so we use Function-based dynamic import to bypass TS compilation.
   */
  private async getOctokitClass(): Promise<any> {
    if (!this.OctokitClass) {
      try {
        // Use Function constructor to preserve the real dynamic import() for ESM
        // packages in an Electron CommonJS context.  This avoids the old eval()
        // hack and is safe because the module specifier is a static string.
        const dynamicImport = new Function('specifier', 'return import(specifier)');
        const module = await dynamicImport('@octokit/rest');
        this.OctokitClass = module.Octokit;
      } catch (importErr) {
        console.error('[GitHubService] Failed to import @octokit/rest:', importErr);
        throw new Error(
          'Failed to load GitHub integration. The @octokit/rest package may not be installed.'
        );
      }
    }
    return this.OctokitClass;
  }

  private createOctokitInstance(token: string): any {
    if (!this.OctokitClass) {
      throw new Error('Octokit not loaded yet. Call getOctokitClass() first.');
    }
    return new this.OctokitClass({ auth: token });
  }

  // ─── Credential persistence ──────────────────────────────────────────────

  /**
   * Load saved credentials and validate the token is still valid.
   */
  private async loadCredentials(): Promise<void> {
    try {
      if (!existsSync(this.credentialsFile)) return;

      const raw = readFileSync(this.credentialsFile, 'utf-8').trim();
      if (!raw || raw === '{}' || raw === '') return;

      const parsed = JSON.parse(raw) as GitHubCredentials;
      if (!parsed.token) return;

      // Load Octokit
      await this.getOctokitClass();
      this.octokit = this.createOctokitInstance(parsed.token);

      // Validate the token still works
      try {
        const { data: user } = await this.octokit.users.getAuthenticated();
        this.credentials = {
          ...parsed,
          username: user.login, // Update in case username changed
        };
        console.log('[GitHubService] Loaded and validated credentials for:', user.login);
      } catch (validationErr: any) {
        const status = validationErr?.status || validationErr?.response?.status;
        if (status === 401) {
          console.warn('[GitHubService] Saved token is invalid/expired — clearing credentials');
          this.clearCredentialFile();
          this.octokit = null;
          this.credentials = null;
        } else {
          // Network error or transient failure — keep the credentials, just skip validation
          console.warn('[GitHubService] Could not validate token (might be offline):', validationErr.message);
          this.credentials = parsed;
        }
      }
    } catch (error) {
      console.error('[GitHubService] Failed to load credentials:', error);
      this.credentials = null;
      this.octokit = null;
    }
  }

  private saveCredentials(): void {
    try {
      if (this.credentials) {
        writeFileSync(this.credentialsFile, JSON.stringify(this.credentials, null, 2), 'utf-8');
        console.log('[GitHubService] Saved credentials');
      }
    } catch (error) {
      console.error('[GitHubService] Failed to save credentials:', error);
    }
  }

  private clearCredentialFile(): void {
    try {
      if (existsSync(this.credentialsFile)) {
        // Overwrite with empty string then delete for security
        writeFileSync(this.credentialsFile, '', 'utf-8');
        unlinkSync(this.credentialsFile);
      }
    } catch (error) {
      console.error('[GitHubService] Failed to clear credential file:', error);
    }
  }

  // ─── OAuth helpers ───────────────────────────────────────────────────────

  private getOAuthClientId(): string {
    const clientId =
      process.env.GITHUB_OAUTH_CLIENT_ID ||
      process.env.GITHUB_CLIENT_ID ||
      process.env.VITE_GITHUB_CLIENT_ID ||
      '';

    if (!clientId.trim()) {
      throw new Error(
        'GitHub browser sign-in is not configured. Set GITHUB_CLIENT_ID in your .env file.'
      );
    }

    return clientId.trim();
  }

  /**
   * Check if browser auth is available (client ID is configured).
   */
  isBrowserAuthAvailable(): boolean {
    try {
      this.getOAuthClientId();
      return true;
    } catch {
      return false;
    }
  }

  private async postGitHubOAuth(url: string, params: Record<string, string>): Promise<any> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    });

    const data = (await response.json()) as any;

    if (!response.ok && !data.error) {
      throw new Error(
        data.error_description || data.message || `GitHub OAuth request failed (${response.status})`
      );
    }

    return data;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Authentication ──────────────────────────────────────────────────────

  /**
   * Start GitHub browser/device authorization.
   */
  async startBrowserAuth(): Promise<GitHubBrowserAuthSession> {
    try {
      const clientId = this.getOAuthClientId();
      const data = await this.postGitHubOAuth('https://github.com/login/device/code', {
        client_id: clientId,
        scope: this.browserAuthScope,
      });

      if (data.error) {
        throw new Error(data.error_description || data.error);
      }

      if (!data.device_code || !data.user_code || !data.verification_uri) {
        throw new Error('GitHub did not return a browser sign-in code.');
      }

      await shell.openExternal(data.verification_uri);

      return {
        deviceCode: data.device_code,
        userCode: data.user_code,
        verificationUri: data.verification_uri,
        expiresAt: new Date(Date.now() + Number(data.expires_in || 900) * 1000).toISOString(),
        interval: Number(data.interval || 5),
      };
    } catch (error) {
      console.error('[GitHubService] Failed to start browser auth:', error);
      throw toSerializableError(error);
    }
  }

  /**
   * Poll GitHub until the browser/device authorization has completed.
   */
  async completeBrowserAuth(
    deviceCode: string,
    interval: number = 5,
    expiresAt?: string
  ): Promise<GitHubUser> {
    try {
      const clientId = this.getOAuthClientId();
      const deadline = expiresAt ? new Date(expiresAt).getTime() : Date.now() + 15 * 60 * 1000;
      let pollInterval = Math.max(interval, 1);

      while (Date.now() < deadline) {
        const data = await this.postGitHubOAuth('https://github.com/login/oauth/access_token', {
          client_id: clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        });

        if (data.access_token) {
          return await this.authenticateWithToken(
            data.access_token,
            'browser',
            typeof data.scope === 'string' ? data.scope.split(',').filter(Boolean) : []
          );
        }

        if (data.error === 'authorization_pending') {
          await this.sleep(pollInterval * 1000);
          continue;
        }

        if (data.error === 'slow_down') {
          pollInterval += 5;
          await this.sleep(pollInterval * 1000);
          continue;
        }

        throw new Error(data.error_description || data.error || 'GitHub browser sign-in failed.');
      }

      throw new Error('GitHub browser sign-in expired. Please try again.');
    } catch (error) {
      console.error('[GitHubService] Browser auth completion failed:', error);
      throw toSerializableError(error);
    }
  }

  /**
   * Authenticate with a Personal Access Token.
   */
  async authenticateWithToken(
    token: string,
    authMethod: 'browser' | 'token' = 'token',
    scopes: string[] = []
  ): Promise<GitHubUser> {
    try {
      if (!token || !token.trim()) {
        throw new Error('Token cannot be empty.');
      }

      await this.getOctokitClass();
      this.octokit = this.createOctokitInstance(token.trim());

      // Verify token by getting user info
      const { data: user } = await this.octokit.users.getAuthenticated();

      this.credentials = {
        token: token.trim(),
        username: user.login,
        authMethod,
        scopes,
      };

      this.saveCredentials();

      console.log('[GitHubService] Authenticated as:', user.login);

      return {
        login: user.login,
        name: user.name || user.login,
        email: user.email || '',
        avatarUrl: user.avatar_url,
      };
    } catch (error) {
      console.error('[GitHubService] Authentication failed:', error);
      this.octokit = null;
      this.credentials = null;
      throw toSerializableError(error);
    }
  }

  /**
   * Sign out — clear all credentials and state.
   */
  signOut(): void {
    this.octokit = null;
    this.credentials = null;
    this.clearCredentialFile();
    console.log('[GitHubService] Signed out');
  }

  /**
   * Check if authenticated.
   */
  async isAuthenticated(): Promise<boolean> {
    await this.initPromise;
    return this.octokit !== null && this.credentials !== null;
  }

  // ─── User info ───────────────────────────────────────────────────────────

  async getCurrentUser(): Promise<GitHubUser | null> {
    await this.initPromise;
    if (!this.octokit) return null;

    try {
      const { data: user } = await this.octokit.users.getAuthenticated();
      return {
        login: user.login,
        name: user.name || user.login,
        email: user.email || '',
        avatarUrl: user.avatar_url,
      };
    } catch (error) {
      console.error('[GitHubService] Failed to get current user:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Repository operations ──────────────────────────────────────────────

  async getRepositories(page: number = 1, perPage: number = 100): Promise<GitHubRepository[]> {
    await this.initPromise;
    if (!this.octokit) throw new Error('Not authenticated with GitHub.');

    try {
      const { data: repos } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: perPage,
        page,
      });

      return repos.map((repo: any) => ({
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        private: repo.private,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
      }));
    } catch (error) {
      console.error('[GitHubService] Failed to get repositories:', error);
      throw toSerializableError(error);
    }
  }

  async createRepository(
    name: string,
    description: string,
    isPrivate: boolean
  ): Promise<GitHubRepository> {
    await this.initPromise;
    if (!this.octokit) throw new Error('Not authenticated with GitHub.');

    try {
      const { data: repo } = await this.octokit.repos.createForAuthenticatedUser({
        name,
        description,
        private: isPrivate,
        auto_init: false,
      });

      console.log('[GitHubService] Created repository:', repo.full_name);

      return {
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        private: repo.private,
        url: repo.html_url,
        cloneUrl: repo.clone_url,
        defaultBranch: repo.default_branch,
      };
    } catch (error) {
      console.error('[GitHubService] Failed to create repository:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Pull requests ──────────────────────────────────────────────────────

  async getPullRequests(
    owner: string,
    repo: string,
    state: 'open' | 'closed' | 'all' = 'open'
  ): Promise<GitHubPullRequest[]> {
    await this.initPromise;
    if (!this.octokit) throw new Error('Not authenticated with GitHub.');

    try {
      const { data: prs } = await this.octokit.pulls.list({
        owner,
        repo,
        state,
        per_page: 50,
      });

      return prs.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user?.login || 'unknown',
        createdAt: pr.created_at,
        url: pr.html_url,
      }));
    } catch (error) {
      console.error('[GitHubService] Failed to get pull requests:', error);
      throw toSerializableError(error);
    }
  }

  async createPullRequest(
    owner: string,
    repo: string,
    title: string,
    head: string,
    base: string,
    body?: string
  ): Promise<GitHubPullRequest> {
    await this.initPromise;
    if (!this.octokit) throw new Error('Not authenticated with GitHub.');

    try {
      const { data: pr } = await this.octokit.pulls.create({
        owner,
        repo,
        title,
        head,
        base,
        body,
      });

      console.log('[GitHubService] Created pull request:', pr.number);

      return {
        number: pr.number,
        title: pr.title,
        state: pr.state,
        author: pr.user?.login || 'unknown',
        createdAt: pr.created_at,
        url: pr.html_url,
      };
    } catch (error) {
      console.error('[GitHubService] Failed to create pull request:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Fork ────────────────────────────────────────────────────────────────

  async forkRepository(owner: string, repo: string): Promise<GitHubRepository> {
    await this.initPromise;
    if (!this.octokit) throw new Error('Not authenticated with GitHub.');

    try {
      const { data: fork } = await this.octokit.repos.createFork({ owner, repo });

      console.log('[GitHubService] Forked repository:', fork.full_name);

      return {
        name: fork.name,
        fullName: fork.full_name,
        description: fork.description || '',
        private: fork.private,
        url: fork.html_url,
        cloneUrl: fork.clone_url,
        defaultBranch: fork.default_branch,
      };
    } catch (error) {
      console.error('[GitHubService] Failed to fork repository:', error);
      throw toSerializableError(error);
    }
  }

  // ─── URL parsing ─────────────────────────────────────────────────────────

  parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    try {
      // SSH: git@github.com:owner/repo.git
      const sshMatch = url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
      if (sshMatch) {
        return { owner: sshMatch[1], repo: sshMatch[2].replace(/\.git$/, '') };
      }

      // HTTPS
      const normalized = url.includes('://') ? url : `https://${url}`;
      const parsed = new URL(normalized);
      if (parsed.hostname !== 'github.com') return null;

      const parts = parsed.pathname.replace(/^\/+/, '').replace(/\.git$/, '').split('/');
      if (parts.length >= 2 && parts[0] && parts[1]) {
        return { owner: parts[0], repo: parts[1] };
      }

      return null;
    } catch (error) {
      console.error('[GitHubService] Failed to parse GitHub URL:', error);
      return null;
    }
  }

  // ─── Collaboration ───────────────────────────────────────────────────────

  async inviteCollaborator(
    owner: string,
    repo: string,
    username: string,
    permission: 'pull' | 'triage' | 'push' | 'maintain' | 'admin' = 'push'
  ): Promise<GitHubCollaboratorInvite> {
    await this.initPromise;
    if (!this.octokit) throw new Error('Not authenticated with GitHub.');

    try {
      const response = await this.octokit.repos.addCollaborator({
        owner,
        repo,
        username,
        permission,
      });

      const invitation = response.data || null;
      const status = response.status === 204 ? 'already_collaborator' : 'invited';

      console.log('[GitHubService] Collaborator invite result:', username, status);

      return {
        username,
        permission,
        status,
        invitationUrl: invitation?.html_url,
      };
    } catch (error) {
      console.error('[GitHubService] Failed to invite collaborator:', error);
      throw toSerializableError(error);
    }
  }

  async getCollaborators(owner: string, repo: string): Promise<GitHubCollaborator[]> {
    await this.initPromise;
    if (!this.octokit) throw new Error('Not authenticated with GitHub.');

    try {
      const { data } = await this.octokit.repos.listCollaborators({
        owner,
        repo,
        per_page: 100,
      });

      return data.map((collaborator: any) => ({
        login: collaborator.login,
        avatarUrl: collaborator.avatar_url,
        permissions: collaborator.permissions || {},
      }));
    } catch (error) {
      console.error('[GitHubService] Failed to get collaborators:', error);
      throw toSerializableError(error);
    }
  }

  // ─── Credential access for GitService ────────────────────────────────────

  getCredentials(): GitHubCredentials | null {
    return this.credentials;
  }
}

export default new GitHubService();

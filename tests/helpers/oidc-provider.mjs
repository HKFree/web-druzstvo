import { createServer, request } from 'node:https';
import { generateKeyPairSync, randomBytes, createHash, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// Local OIDC provider for tests only. It uses real HTTPS, PKCE and signed ID tokens.
export async function createProvider(directory) {
  const certPath = join(directory, 'cert.pem');
  const keyPath = join(directory, 'key.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', keyPath, '-out', certPath], { stdio: 'ignore' });
  const cert = await readFile(certPath);
  const key = await readFile(keyPath);
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256', use: 'sig' };
  const codes = new Map();
  let issuer;
  const json = (response, status, value) => {
    response.writeHead(status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(value));
  };
  const server = createServer({ cert, key }, async (req, res) => {
    const url = new URL(req.url, issuer);
    if (url.pathname === '/.well-known/openid-configuration') return json(res, 200, {
      issuer, authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/token',
      jwks_uri: issuer + '/jwks', response_types_supported: ['code'], subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'], code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post'],
    });
    if (url.pathname === '/jwks') return json(res, 200, { keys: [jwk] });
    if (url.pathname === '/authorize') {
      const params = url.searchParams;
      const code = randomBytes(24).toString('hex');
      codes.set(code, Object.fromEntries(params));
      const redirect = new URL(params.get('redirect_uri'));
      redirect.searchParams.set('code', code);
      redirect.searchParams.set('state', params.get('state'));
      res.writeHead(302, { location: redirect.href }); return res.end();
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const params = new URLSearchParams(body);
      const auth = Buffer.from((req.headers.authorization ?? '').slice(6), 'base64').toString().split(':').map(decodeURIComponent).join(':');
      if (auth !== 'test-web:test-secret' && !(params.get('client_id') === 'test-web' && params.get('client_secret') === 'test-secret')) return json(res, 401, { error: 'invalid_client' });
      const transaction = codes.get(params.get('code'));
      codes.delete(params.get('code'));
      if (!transaction || transaction.redirect_uri !== params.get('redirect_uri')
        || createHash('sha256').update(params.get('code_verifier') ?? '').digest('base64url') !== transaction.code_challenge) {
        return json(res, 400, { error: 'invalid_grant' });
      }
      const now = Math.floor(Date.now() / 1000);
      const subject = transaction.test_subject || 'editor-1';
      const claims = {
        iss: issuer, sub: subject, aud: 'test-web', iat: now,
        exp: transaction.test_expired ? now - 600 : now + 300,
        nonce: transaction.test_nonce || transaction.nonce,
        email: `${subject}@example.test`, email_verified: true,
      };
      const data = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url')
        + '.' + Buffer.from(JSON.stringify(claims)).toString('base64url');
      const signature = transaction.test_signature === 'bad' ? randomBytes(256) : sign('RSA-SHA256', Buffer.from(data), privateKey);
      return json(res, 200, { access_token: randomBytes(24).toString('hex'), token_type: 'Bearer', expires_in: 300,
        id_token: data + '.' + signature.toString('base64url') });
    }
    json(res, 404, { error: 'not_found' });
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  issuer = `https://127.0.0.1:${server.address().port}`;
  function fetchLocal(url, options = {}) {
    return new Promise((done, reject) => {
      const req = request(url, { method: options.method ?? 'GET', headers: options.headers, ca: cert }, res => {
        const chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const headers = new Headers();
          for (let i = 0; i < res.rawHeaders.length; i += 2) headers.append(res.rawHeaders[i], res.rawHeaders[i + 1]);
          done(new Response(Buffer.concat(chunks), { status: res.statusCode, headers }));
        });
      });
      req.on('error', reject);
      req.end(options.body);
    });
  }
  return { issuer, certPath, keyPath, fetchLocal, close: () => new Promise(done => server.close(done)) };
}

export function cookieClient(fetchLocal) {
  const cookies = new Map();
  return {
    cookies,
    async request(url, options = {}) {
      const result = await fetchLocal(url, { ...options,
        headers: { cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...options.headers },
      });
      for (const cookie of result.headers.getSetCookie()) {
        const [pair] = cookie.split(';');
        const split = pair.indexOf('=');
        const key = pair.slice(0, split), value = pair.slice(split + 1);
        const expiry = /(?:^|;)\s*expires=([^;]+)/i.exec(cookie)?.[1];
        if (/max-age=(?:0|-\d+)/i.test(cookie) || !value || (expiry && Date.parse(expiry) <= Date.now())) cookies.delete(key);
        else cookies.set(key, value);
      }
      return result;
    },
  };
}

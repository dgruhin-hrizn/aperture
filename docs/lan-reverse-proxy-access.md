# LAN and reverse-proxy access

Aperture can serve the same installation at both a local address such as `http://192.168.1.8:3456` and a public reverse-proxy address such as `https://aperture.gru.digital`. Keep `APP_BASE_URL` set to the public URL. No additional origin list, database migration or preference change is needed.

## How access is checked

Browser requests are allowed when their `Origin` matches either:

- The canonical origin from `APP_BASE_URL` (scheme, hostname and port).
- The address serving that request: the actual connection scheme and HTTP `Host`, including its port.

This applies to JavaScript assets as well as API routes. Previously the production allowlist accepted only `APP_BASE_URL`, so loading a module from a LAN address could fail with `Not allowed by CORS` and HTTP 500. The LAN page's own requests now succeed. Other origins receive HTTP **403** with code `CORS_ORIGIN_DENIED`, before authentication or route handlers can change anything. Private network addresses are not a blanket cross-origin allowlist: another IP or port is still a different origin.

Normal navigations and non-browser clients without an `Origin` header continue to work. Protected endpoints still require authentication. Development retains the existing localhost/127.0.0.1 origins on ports 3456 and 3457.

The CORS decision uses the raw connection and `Host`, not `X-Forwarded-Host`, `X-Forwarded-For` or `X-Forwarded-Proto`. Aperture does not enable global proxy trust. A proxy terminating TLS is covered by the configured public origin, even when it forwards an internal `Host` to the app.

## Signing in at both addresses

Session cookies remain host-only, HttpOnly, `SameSite=Lax`, with a 30-day lifetime and `/` path. Sign in separately at the LAN IP/hostname and the public hostname. Both sessions use the same Aperture account and saved settings; logging out at one address does not revoke the other session.

- Direct HTTP at a separate LAN hostname or IP receives a cookie usable over HTTP.
- The configured HTTPS public hostname receives a `Secure` cookie. HTTPS public-origin requests also retain `Secure` when a proxy rewrites the backend host.
- A TLS connection or an exact `X-Forwarded-Proto: https` hint can add `Secure`. Forwarded `http` cannot downgrade a cookie for the configured HTTPS hostname.
- Cookies are shared across ports on the same hostname. Use the LAN IP or a separate LAN hostname for direct HTTP when the public hostname uses HTTPS; HTTP on a different port of that public hostname deliberately does not downgrade its Secure cookie.

HTTP LAN access does not encrypt credentials or sessions. Use a trusted local network or HTTPS for local access where encryption is needed. Existing HTTPS sessions keep their protection.

## Reverse proxy and OAuth

Keep the existing proxy destination and `APP_BASE_URL`. Preserve the original `Host` and send `X-Forwarded-Proto: https` when terminating HTTPS, as normal reverse proxies do. Do not change the public base URL to the LAN IP to work around CORS.

Trakt's registered redirect URI remains the public `APP_BASE_URL/api/trakt/callback`. This change does not make an OAuth provider accept additional callback addresses. Complete account linking through the public address, where that callback and browser session belong.

## Verification

Run `pnpm test:browser-access`. The suite covers LAN IPv4/IPv6/hostname requests, canonical HTTPS through a rewritten proxy host, module assets, preflight, production/development separation, malformed/untrusted origins, forwarding-header spoofing, cookie issuance/clearing, failed credentials, authenticated reads, and independent login/logout sessions through the real auth routes with stubbed Emby responses and an in-memory database fixture. It also runs in the Docker validation workflow.

Local validation passed lint, all workspace type checks, the production build, and 79 test executions across browser access (5), Upcoming Episodes (20), UI performance (27), Discovery (20) and appearance (7). A full built-server smoke check with `APP_BASE_URL=https://aperture.gru.digital` returned HTML and the real `/assets/index-Dx5tFPg1.js` module with HTTP 200 for both the LAN and public origins, preflight 204, unauthenticated protected reads 401 and an untrusted login 403. This check used no production database, account, settings or proxy changes; deployment verification remains separate.

For a deployed installation, verify both addresses load a page and its `/assets/*.js` module, sign in independently, and check authenticated API reads. Confirm a LAN logout leaves the public session signed in. Requesting a protected API without a session must still return 401. Requests with an unrelated `Origin` must return 403 without an `Access-Control-Allow-Origin` grant.

Implementation references: [Fastify CORS delegator](https://github.com/fastify/fastify-cors#options-delegator), [Fastify proxy trust](https://fastify.dev/docs/latest/Reference/Server/#trustproxy), and [cookie scope and Secure behavior](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

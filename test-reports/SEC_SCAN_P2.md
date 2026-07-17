# SEC_SCAN_P2 — SAST + 端口 + Web + Nuclei + 配置审计
Started: Wed Jul  1 10:38:46 AM CST 2026

## 1. Semgrep SAST Scan
Running semgrep on /home/ubuntu/aiops/server...
```
Paths that match both --include and --exclude will be skipped by Semgrep.
               
               
┌─────────────┐
│ Scan Status │
└─────────────┘
  Scanning 81 files tracked by git with 1074 Code rules:
                                                                                                                        
  Language      Rules   Files          Origin      Rules                                                                
 ─────────────────────────────        ───────────────────                                                               
  js              153      81          Community    1074                                                                
  <multilang>      47      81                                                                                           
                                                                                                                        
                    
                    
┌──────────────────┐
│ 38 Code Findings │
└──────────────────┘
          
    app.js
     ❱ javascript.express.security.audit.express-check-csurf-middleware-usage.express-check-csurf-middleware-usage
          ❰❰ Blocking ❱❱
          A CSRF middleware was not detected in your express application. Ensure you are either using one such
          as `csurf` or `csrf` (see rule references) and/or you are properly doing CSRF validation in your    
          routes with a token or cookies.                                                                     
          Details: https://sg.run/BxzR                                                                        
                                                                                                              
           21┆ const app = express();
          
    db.cjs
    ❯❱ javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
          ❰❰ Blocking ❱❱
          Detected possible user input going into a `path.join` or `path.resolve` function. This could   
          possibly lead to a path traversal vulnerability,  where the attacker can access arbitrary files
          stored in the file system. Instead, be sure to sanitize or validate user input first.          
          Details: https://sg.run/OPqk                                                                   
                                                                                                         
            8┆ function dbPath(name) { return path.join(DATA_DIR, name + '.json'); }
          
    jwt.js
    ❯❱ javascript.jsonwebtoken.security.audit.jwt-exposed-data.jwt-exposed-data
          ❰❰ Blocking ❱❱
          The object is passed strictly to jsonwebtoken.sign(...) Make sure that sensitive information is not
          exposed through JWT token payload.                                                                 
          Details: https://sg.run/5Qkj                                                                       
                                                                                                             
           12┆ return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
            ⋮┆----------------------------------------
           16┆ return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
                 
    lib/crypto.js
   ❯❯❱ javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length
          ❰❰ Blocking ❱❱
          The call to 'createDecipheriv' with the Galois Counter Mode (GCM) mode of operation is missing an 
          expected authentication tag length. If the expected authentication tag length is not specified or 
          otherwise checked, the application might be tricked into verifying a shorter-than-expected        
          authentication tag. This can be abused by an attacker to spoof ciphertexts or recover the implicit
          authentication key of GCM, allowing arbitrary forgeries.                                          
          Details: https://sg.run/NbGG1                                                                     
                                                                                                            
           25┆ const decipher = crypto.createDecipheriv(ALGORITHM, KEY, Buffer.from(ivHex, 'hex'));
                  
    poster-api.cjs
    ❯❱ javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
          ❰❰ Blocking ❱❱
          Detected possible user input going into a `path.join` or `path.resolve` function. This could   
          possibly lead to a path traversal vulnerability,  where the attacker can access arbitrary files
          stored in the file system. Instead, be sure to sanitize or validate user input first.          
          Details: https://sg.run/OPqk                                                                   
                                                                                                         
          104┆ const filepath = path.join(DATA_DIR, filename);
   
   ❯❯❱ javascript.lang.security.detect-child-process.detect-child-process
          ❰❰ Blocking ❱❱
          Detected calls to child_process from a function argument `imagePath`. This could lead to a command
          injection if the input is user controllable. Try to avoid calls to child_process, and if it is    
          needed ensure user input is correctly sanitized or sandboxed.                                     
          Details: https://sg.run/l2lo                                                                      
                                                                                                            
          130┆ execSync(cmd, { encoding: 'utf8' });
                       
    routes/accounts.cjs
   ❯❯❱ javascript.express.security.audit.remote-property-injection.remote-property-injection
          ❰❰ Blocking ❱❱
          Bracket object notation with user input is present, this might allow an attacker to access all
          properties of the object and even it's prototype. Use literal values for object properties.   
          Details: https://sg.run/Z4gn                                                                  
                                                                                                        
          109┆ account[field] = req.body[field];
                     
    routes/content.js
   ❯❯❱ javascript.express.security.audit.remote-property-injection.remote-property-injection
          ❰❰ Blocking ❱❱
          Bracket object notation with user input is present, this might allow an attacker to access all
          properties of the object and even it's prototype. Use literal values for object properties.   
          Details: https://sg.run/Z4gn                                                                  
                                                                                                        
          232┆ updateData[field] = req.body[field];
                       
    routes/contents.cjs
   ❯❯❱ javascript.express.security.audit.remote-property-injection.remote-property-injection
          ❰❰ Blocking ❱❱
          Bracket object notation with user input is present, this might allow an attacker to access all
          properties of the object and even it's prototype. Use literal values for object properties.   
          Details: https://sg.run/Z4gn                                                                  
                                                                                                        
           63┆ contents[idx][field] = req.body[field];
                               
    routes/operator/api-keys.js
    ❯❱ javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
          ❰❰ Blocking ❱❱
          RegExp() called with a `req` function argument, this might allow an attacker to cause a Regular     
          Expression Denial-of-Service (ReDoS) within your application as RegExP blocks the main thread. For  
          this reason, it is recommended to use hardcoded regexes instead. If your regex is run on user-      
          controlled input, consider performing input validation or use a regex checking/sanitization library 
          such as https://www.npmjs.com/package/recheck to verify that the regex does not appear vulnerable to
          ReDoS.                                                                                              
          Details: https://sg.run/gr65                                                                        
                                                                                                              
           77┆ const regex = new RegExp(`^${mapping.env}=.*$`, 'm');
                               
    routes/operator/settings.js
    ❯❱ javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
          ❰❰ Blocking ❱❱
          RegExp() called with a `key` function argument, this might allow an attacker to cause a Regular     
          Expression Denial-of-Service (ReDoS) within your application as RegExP blocks the main thread. For  
          this reason, it is recommended to use hardcoded regexes instead. If your regex is run on user-      
          controlled input, consider performing input validation or use a regex checking/sanitization library 
          such as https://www.npmjs.com/package/recheck to verify that the regex does not appear vulnerable to
          ReDoS.                                                                                              
          Details: https://sg.run/gr65                                                                        
                                                                                                              
           53┆ const regex = new RegExp(`^${key}=.*$`, 'm');
                       
    routes/settings.cjs
    ❯❱ javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
          ❰❰ Blocking ❱❱
          RegExp() called with a `req` function argument, this might allow an attacker to cause a Regular     
          Expression Denial-of-Service (ReDoS) within your application as RegExP blocks the main thread. For  
          this reason, it is recommended to use hardcoded regexes instead. If your regex is run on user-      
          controlled input, consider performing input validation or use a regex checking/sanitization library 
          such as https://www.npmjs.com/package/recheck to verify that the regex does not appear vulnerable to
          ReDoS.                                                                                              
          Details: https://sg.run/gr65                                                                        
                                                                                                              
          130┆ const regex = new RegExp('^' + key + '=.*', 'm');
   
    ❯❱ javascript.express.security.audit.express-path-join-resolve-traversal.express-path-join-resolve-traversal
          ❰❰ Blocking ❱❱
          Possible writing outside of the destination, make sure that the target path is nested in the
          intended destination                                                                        
          Details: https://sg.run/weRn                                                                
                                                                                                      
          234┆ const logoFile = path.join(DATA_DIR, path.basename(logoUrl));
   
    ❯❱ javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
          ❰❰ Blocking ❱❱
          Detected possible user input going into a `path.join` or `path.resolve` function. This could   
          possibly lead to a path traversal vulnerability,  where the attacker can access arbitrary files
          stored in the file system. Instead, be sure to sanitize or validate user input first.          
          Details: https://sg.run/OPqk                                                                   
                                                                                                         
          234┆ const logoFile = path.join(DATA_DIR, path.basename(logoUrl));
   
   ❯❯❱ javascript.lang.security.detect-child-process.detect-child-process
          ❰❰ Blocking ❱❱
          Detected calls to child_process from a function argument `req`. This could lead to a command  
          injection if the input is user controllable. Try to avoid calls to child_process, and if it is
          needed ensure user input is correctly sanitized or sandboxed.                                 
          Details: https://sg.run/l2lo                                                                  
                                                                                                        
          248┆ execSync(cmd, { encoding: 'utf8' });
                   
    routes/team.cjs
     ❱ javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring
          ❰❰ Blocking ❱❱
          Detected string concatenation with a non-literal variable in a util.format / console.log function.
          If an attacker injects a format specifier in the string, it will forge the log message. Try to use
          constant values for the format string.                                                            
          Details: https://sg.run/7Y5R                                                                      
                                                                                                            
          618┆ console.error(`[team] Poster gen failed for article ${ai}:`, e.message);
                 
    routes/tts.js
    ❯❱ javascript.express.security.audit.express-path-join-resolve-traversal.express-path-join-resolve-traversal
          ❰❰ Blocking ❱❱
          Possible writing outside of the destination, make sure that the target path is nested in the
          intended destination                                                                        
          Details: https://sg.run/weRn                                                                
                                                                                                      
          349┆ const mp3Path = path.join(PREVIEW_DIR, `${voiceId}.mp3`);
   
    ❯❱ javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
          ❰❰ Blocking ❱❱
          Detected possible user input going into a `path.join` or `path.resolve` function. This could   
          possibly lead to a path traversal vulnerability,  where the attacker can access arbitrary files
          stored in the file system. Instead, be sure to sanitize or validate user input first.          
          Details: https://sg.run/OPqk                                                                   
                                                                                                         
          349┆ const mp3Path = path.join(PREVIEW_DIR, `${voiceId}.mp3`);
```

## 2. Nmap Port Scan
Scanning 43.156.78.59...
```
Starting Nmap 7.94SVN ( https://nmap.org ) at 2026-07-01 10:39 CST
Nmap scan report for 43.156.78.59
Host is up (0.00078s latency).
Not shown: 96 filtered tcp ports (no-response)
PORT     STATE  SERVICE VERSION
22/tcp   open   ssh     OpenSSH 8.9p1 Ubuntu 3ubuntu0.6 (Ubuntu Linux; protocol 2.0)
80/tcp   open   http    nginx
5190/tcp closed aol
8080/tcp open   http    nginx
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 8.28 seconds
```

SPAWN 2 base complete: Wed Jul  1 10:39:25 AM CST 2026

## 3. Nuclei Web Vulnerability Scan
Scanning http://43.156.78.59:5290 ...
Note: ZAP skipped due to Docker unavailability (环境受限)
```
```

## 4. CORS Header Check
```
=== CORS check via curl ===
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self';script-src 'self' 'unsafe-inline' 'unsafe-eval';style-src 'self' 'unsafe-inline';img-src 'self' data: https:;connect-src 'self' https://api.deepseek.com ws: wss:;media-src 'self' blob:;font-src 'self' data:
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: SAMEORIGIN
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
Allow: GET,HEAD
Content-Type: text/html; charset=utf-8
Content-Length: 8
ETag: W/"8-ZRAf8oNBS3Bjb/SU2GYZCmbtmXg"
Date: Wed, 01 Jul 2026 02:39:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5


=== Security Headers ===
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self';script-src 'self' 'unsafe-inline' 'unsafe-eval';style-src 'self' 'unsafe-inline';img-src 'self' data: https:;connect-src 'self' https://api.deepseek.com ws: wss:;media-src 'self' blob:;font-src 'self' data:
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: SAMEORIGIN
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
Vary: Origin
Access-Control-Allow-Credentials: true
Accept-Ranges: bytes
Cache-Control: public, max-age=0
Last-Modified: Tue, 30 Jun 2026 22:55:50 GMT
ETag: W/"245-19f1abef80e"
Content-Type: text/html; charset=UTF-8
Content-Length: 581
Date: Wed, 01 Jul 2026 02:39:56 GMT
Connection: keep-alive
Keep-Alive: timeout=5

```

## 5. API Endpoint Discovery / Fuzzing
```
=== Common endpoints test ===
```

## 6. httpx Technology Detection
```
```

SPAWN 2 complete: Wed Jul  1 10:39:57 AM CST 2026

## 3b. Nuclei Scan (corrected)
```
```

## 7. CORS Preflight Test (evil origin)
```
Sending OPTIONS with Origin: https://evil.com
HTTP/1.1 404 Not Found
Content-Security-Policy: default-src 'self';script-src 'self' 'unsafe-inline' 'unsafe-eval';style-src 'self' 'unsafe-inline';img-src 'self' data: https:;connect-src 'self' https://api.deepseek.com ws: wss:;media-src 'self' blob:;font-src 'self' data:
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: SAMEORIGIN
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
Content-Type: application/json; charset=utf-8
Content-Length: 21
ETag: W/"15-bm7tJgu8FHlq5QU+Y6gDxOGPfRc"
Date: Wed, 01 Jul 2026 02:41:51 GMT
Connection: keep-alive
Keep-Alive: timeout=5


Sending GET with Origin: https://evil.com
HTTP/1.1 200 OK
Content-Security-Policy: default-src 'self';script-src 'self' 'unsafe-inline' 'unsafe-eval';style-src 'self' 'unsafe-inline';img-src 'self' data: https:;connect-src 'self' https://api.deepseek.com ws: wss:;media-src 'self' blob:;font-src 'self' data:
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Resource-Policy: same-origin
Origin-Agent-Cluster: ?1
Referrer-Policy: no-referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
X-Frame-Options: SAMEORIGIN
X-Permitted-Cross-Domain-Policies: none
X-XSS-Protection: 0
Accept-Ranges: bytes
Cache-Control: public, max-age=0
Last-Modified: Tue, 30 Jun 2026 22:55:50 GMT
ETag: W/"245-19f1abef80e"
Content-Type: text/html; charset=UTF-8
Content-Length: 581
Date: Wed, 01 Jul 2026 02:41:51 GMT
```

## 8. Port 8080 Web Service Check
```
=== http://43.156.78.59:8080 ===
HTTP/1.1 200 OK
Server: nginx
Date: Wed, 01 Jul 2026 02:41:51 GMT
Content-Type: text/html
Content-Length: 581
Last-Modified: Fri, 26 Jun 2026 23:21:14 GMT
Connection: keep-alive
ETag: "6a3f096a-245"
Accept-Ranges: bytes


=== http://43.156.78.59:8080 (body) ===
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0f0f1a" />
    <meta name="description" content="AI 内容运营平台 — 从文案到视频，AI 全链路创作工具" />
    <title>Aiops — AI 内容运营平台</title>
    <script type="module" crossorigin src="/assets/index-E2HjQnWT.js"></script>
    <link rel="stylesheet" crossorigin href="/assets/index-DRKBlOJ1.css">
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
```

SPAWN 2 continued: Wed Jul  1 10:41:51 AM CST 2026

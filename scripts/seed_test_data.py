#!/usr/bin/env python3
"""
Seed test data for aiops — 测试数据初始化
用法: python3 scripts/seed_test_data.py [--server http://127.0.0.1:5289]
"""

import json, os, sys, time, uuid

BASE = 'http://127.0.0.1:5289'
if '--server' in sys.argv:
    i = sys.argv.index('--server')
    BASE = sys.argv[i + 1]

def post(path, data, token=''):
    import urllib.request
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(f'{BASE}{path}', data=json.dumps(data).encode(), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f'  [ERR] {path}: {e.code} {body[:80]}')
        return None

def get(path, token=''):
    import urllib.request
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(f'{BASE}{path}', headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f'  [ERR] {path}: {e.code}')
        return None

def main():
    print('🔧 Seeding test data for aiops...')
    
    # 1. Register a test user
    test_user = f'test_{int(time.time())}@test.com'
    test_pass = 'test1234'
    print(f'   Registering test user: {test_user}')
    r = post('/api/auth/register', {'username': 'qa_tester', 'password': test_pass, 'email': test_user})
    token = r.get('token', '') if r else ''
    if not token:
        print('   ⚠️  Register failed, trying login...')
        r = post('/api/auth/login', {'username': 'qa_tester', 'password': test_pass})
        token = r.get('token', '') if r else ''
    if not token:
        print('   ❌ Cannot get auth token. Server may need running.')
        sys.exit(1)
    print(f'   ✅ Token obtained ({token[:20]}...)')
    
    # 2. Create a team task entry for today
    print('   Creating today task via GET...')
    t = get('/api/team-tasks/today', token)
    if t:
        print(f'   ✅ Today task: {t["_id"]}')
    
    # 3. Test script generation
    print('   Testing script generation...')
    r = post('/api/videos/scripts', {'subject': 'AI 改变生活', 'duration': 5}, token)
    if r and r.get('script'):
        print(f'   ✅ Script generated ({len(r["script"])} chars)')
    
    # 4. Test stats
    print('   Testing stats...')
    r = get('/api/stats', token)
    if r is not None:
        print(f'   ✅ Stats OK')
    
    print('\n✅ Seed complete. Token for smoke test:')
    print(token)

if __name__ == '__main__':
    main()

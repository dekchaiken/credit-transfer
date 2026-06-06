// End-to-end test: login as admin, then PUT /api/users/[id] with assignedYears
// to confirm the actual HTTP path works.
import 'dotenv/config';

const BASE = 'http://localhost:3000';

async function main() {
  // 1. Get CSRF
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookie = csrfRes.headers.get('set-cookie') || '';

  // 2. Login as admin
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: csrfCookie },
    body: new URLSearchParams({
      csrfToken,
      username: 'admin',
      password: 'admin1234',
      callbackUrl: `${BASE}/admin`,
      json: 'true',
    }).toString(),
    redirect: 'manual',
  });

  // gather all cookies from the response (next-auth sets session cookie via Set-Cookie)
  const setCookies = loginRes.headers.getSetCookie?.() || [loginRes.headers.get('set-cookie') || ''];
  const cookieJar = setCookies.concat([csrfCookie])
    .filter(Boolean)
    .map(c => c.split(';')[0])
    .join('; ');

  console.log('Login status:', loginRes.status);
  console.log('Cookies:', cookieJar.length, 'chars');

  // 3. GET users — should return list when authed
  const usersRes = await fetch(`${BASE}/api/users`, { headers: { cookie: cookieJar } });
  console.log('GET /api/users status:', usersRes.status);
  if (usersRes.status !== 200) {
    console.log('  body:', await usersRes.text());
    return;
  }
  const users = await usersRes.json();
  const teacher = users.find((u: any) => u.username === 'teacher1');
  if (!teacher) { console.log('no teacher1 in API response'); return; }
  console.log('teacher1 BEFORE:', { id: teacher._id, assignedYears: teacher.assignedYears });

  // 4. PUT — set assignedYears to [2569, 2571]
  const putRes = await fetch(`${BASE}/api/users/${teacher._id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', cookie: cookieJar },
    body: JSON.stringify({
      fullName: teacher.fullName,
      role: teacher.role,
      studentId: null,
      assignedYears: [2569, 2571],
    }),
  });
  console.log('PUT status:', putRes.status);
  console.log('PUT body:', await putRes.text());

  // 5. Re-GET to verify
  const usersRes2 = await fetch(`${BASE}/api/users`, { headers: { cookie: cookieJar } });
  const users2 = await usersRes2.json();
  const teacher2 = users2.find((u: any) => u.username === 'teacher1');
  console.log('teacher1 AFTER:', { id: teacher2?._id, assignedYears: teacher2?.assignedYears });
}
main().catch(e => { console.error(e); process.exit(1); });

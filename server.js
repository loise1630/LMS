/**
 * ITPE PROJECT - System Administration & Maintenance Learning Management System
 * Fully self-contained Node.js server (zero external dependencies required)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const { Pool } = require('pg');
const AdmZip = require('adm-zip');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');

// Read .env if present
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  try {
    const envLines = fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/);
    for (const line of envLines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const k = trimmed.slice(0, eqIdx).trim();
          let v = trimmed.slice(eqIdx + 1).trim();
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
          }
          if (!process.env[k]) process.env[k] = v;
        }
      }
    }
  } catch (e) {}
}

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/itpe_portal';
let pgPool = null;
let usePostgres = false;
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_UPLOAD_BASE64_LENGTH = Math.ceil(MAX_UPLOAD_BYTES / 3) * 4;
const MAX_UPLOAD_REQUEST_BYTES = MAX_UPLOAD_BASE64_LENGTH + 1024 * 1024;

// Ensure directories exist
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// In-memory cache; PostgreSQL stores the durable application state.
let db = null;
let saveQueue = Promise.resolve();

function getInitialDB() {
  return {
    subject: {
      name: "System Administration and Maintenance",
      code: "SYS-ADMIN",
      term: "1st Semester, A.Y. 2026-2027",
      yearLevel: "3rd Year - BSIT / Engineering"
    },
    settings: { passingPercentage: 50 },
    users: [],
    // Topics start EMPTY - Professor uploads topics and materials
    topics: [],
    // Submissions start EMPTY
    submissions: []
  };
}

function derivePassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const digest = await derivePassword(password, salt);
  return `scrypt$16384$${salt.toString('hex')}$${digest.toString('hex')}`;
}

async function verifyPassword(password, storedValue) {
  if (typeof storedValue !== 'string') return false;
  const parts = storedValue.split('$');
  if (parts.length !== 4 || parts[0] !== 'scrypt' || parts[1] !== '16384') {
    return storedValue === password;
  }
  try {
    const salt = Buffer.from(parts[2], 'hex');
    const expected = Buffer.from(parts[3], 'hex');
    if (salt.length !== 16 || expected.length !== 64) return false;
    const actual = await derivePassword(password, salt);
    return crypto.timingSafeEqual(actual, expected);
  } catch (error) {
    return false;
  }
}

async function loadDB() {
  let pgSuccess = false;

  try {
    const candidatePool = new Pool({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 2500
    });
    const client = await candidatePool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          id SMALLINT PRIMARY KEY CHECK (id = 1),
          state JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);

      const result = await client.query('SELECT state FROM app_state WHERE id = 1');
      pgPool = candidatePool;
      usePostgres = true;
      pgSuccess = true;

      if (result.rows.length) {
        db = result.rows[0].state;
      } else if (fs.existsSync(DB_FILE)) {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        await saveDB();
        console.log('[PostgreSQL] Migrated data/db.json into PostgreSQL table app_state.');
      } else {
        db = getInitialDB();
        await saveDB();
      }
    } finally {
      client.release();
    }
  } catch (pgErr) {
    console.warn(`[Database] PostgreSQL unavailable (${pgErr.message || 'connection failed'}).`);
    console.warn(`[Database] Falling back seamlessly to local storage: data/db.json`);
    usePostgres = false;
    pgPool = null;
  }

  if (!pgSuccess) {
    if (fs.existsSync(DB_FILE)) {
      try {
        db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      } catch (e) {
        console.error('Error reading data/db.json, initializing default DB state:', e);
        db = getInitialDB();
        await saveDB();
      }
    } else {
      db = getInitialDB();
      await saveDB();
    }
  }

  // Remove untouched demo accounts from existing databases; keep actual registrations.
  const demoStudents = new Map([
    ['usr_stu_1', ['Juan', 'Dela Cruz', 'TUPT-23-1096']],
    ['usr_stu_2', ['Maria Carmela', 'Alvarez', 'TUPT-23-1097']],
    ['usr_stu_3', ['Carlo', 'Reyes', 'TUPT-23-1098']],
    ['usr_stu_4', ['Kimberly', 'Tan', 'TUPT-23-1099']],
    ['usr_stu_5', ['Mark Anthony', 'Bautista', 'TUPT-23-1100']]
  ]);
  const defaultFaculty = user => user.id === 'usr_fac_1' && user.idNumber === 'TUPT-FAC-001' &&
    user.password === 'faculty123' && user.firstName === 'Maria Teresa' && user.lastName === 'Santos';
  const userCountBeforeDemoCleanup = db.users.length;
  db.users = db.users.filter(user => {
    const seed = demoStudents.get(user.id);
    return !defaultFaculty(user) && (!seed || user.firstName !== seed[0] || user.lastName !== seed[1] ||
      user.idNumber !== seed[2] || user.password !== 'student123');
  });
  const registeredUserIds = new Set(db.users.map(user => user.id));
  const submissionCountBeforeCleanup = db.submissions.length;
  db.submissions = db.submissions.filter(submission => registeredUserIds.has(submission.userId));
  const hasUnmarkedRegisteredStudents = db.users.some(user => user.role === 'student' && !user.registeredAt);
  const hasUnmarkedEnrollment = db.users.some(user => user.role === 'student' && user.enrollmentStatus !== 'enrolled');
  const hasLegacyFacultyRoles = db.users.some(user => user.role === 'faculty' && String(user.idNumber || '').toUpperCase() !== ADMIN_ID);
  let passwordsMigrated = false;
  for (const user of db.users) {
    if (String(user.idNumber || '').toUpperCase() === ADMIN_ID) user.role = 'faculty';
    else if (user.role === 'faculty') user.role = 'student';
    if (user.role === 'student' && !user.registeredAt) {
      user.registeredAt = user.privacyAgreedAt || new Date().toISOString();
    }
    if (user.role === 'student') {
      user.enrollmentStatus = 'enrolled';
      if (!user.enrolledAt) user.enrolledAt = user.registeredAt;
    }
    if (typeof user.password === 'string' && !user.password.startsWith('scrypt$')) {
      user.password = await hashPassword(user.password);
      passwordsMigrated = true;
    }
  }
  if (db.users.length !== userCountBeforeDemoCleanup || db.submissions.length !== submissionCountBeforeCleanup ||
      hasUnmarkedRegisteredStudents || hasUnmarkedEnrollment || hasLegacyFacultyRoles || passwordsMigrated) await saveDB();

  // Backfill application settings for databases created before admin settings existed.
  if (!db.settings) {
    db.settings = { passingPercentage: 50 };
    await saveDB();
  } else if (!Number.isFinite(Number(db.settings.passingPercentage))) {
    db.settings.passingPercentage = 50;
    await saveDB();
  }

  if (db.subject && (db.subject.name === 'Numerical Methods' || db.subject.name === 'Systems Integration' ||
      db.subject.code === 'MATH 313 / NUM-MET')) {
    db.subject.name = 'System Administration and Maintenance';
    db.subject.code = 'SYS-ADMIN';
    db.subject.yearLevel = '3rd Year - BSIT';
    await saveDB();
  }
  return db;
}

function saveDB() {
  // Always persist to local DB_FILE as reliable backup
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving local JSON database:', err);
  }

  // If PostgreSQL is active, also persist to PostgreSQL
  if (usePostgres && pgPool) {
    const snapshot = JSON.stringify(db);
    saveQueue = saveQueue
      .then(() => pgPool.query(
        `INSERT INTO app_state (id, state, updated_at) VALUES (1, $1::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()`,
        [snapshot]
      ))
      .catch(err => console.error('Error saving PostgreSQL state:', err));
    return saveQueue;
  }

  return Promise.resolve();
}

// Active sessions: token -> user
const sessions = new Map();
const ADMIN_ID = 'TUPT-23-1096';

function hasFacultyAccess(user) {
  return !!user && (
    user.role === 'faculty' ||
    String(user.idNumber || '').trim().toUpperCase() === ADMIN_ID
  );
}

function effectiveRole(user) {
  return hasFacultyAccess(user) ? 'faculty' : user.role;
}

function createSession(user) {
  const token = 'tok_' + crypto.randomBytes(24).toString('hex');
  sessions.set(token, {
    userId: user.id,
    role: user.role,
    idNumber: user.idNumber,
    createdAt: Date.now()
  });
  return token;
}

function authenticate(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = sessions.get(token);
    if (session) {
      const user = db.users.find(u => u.id === session.userId);
      if (user) return user;
    }
  }
  return null;
}

// MIME Types for static files
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.mjs': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain; charset=UTF-8',
  '.csv': 'text/csv; charset=UTF-8'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function parseBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bodyBytes = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      bodyBytes += chunk.length;
      if (bodyBytes > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      if (!tooLarge) chunks.push(chunk);
    });
    req.on('end', () => {
      if (tooLarge) {
        const error = new Error('Request is too large. Upload files up to 20 MB.');
        error.statusCode = 413;
        return reject(error);
      }
      const body = Buffer.concat(chunks).toString('utf8');
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        resolve({ raw: body });
      }
    });
    req.on('error', reject);
  });
}

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));
}

async function extractUploadedDocument(filename, buffer) {
  const extension = path.extname(filename).toLowerCase();
  if (extension === '.txt') {
    return { text: buffer.toString('utf8').slice(0, 80000), sections: 1, format: 'TXT' };
  }

  if (extension === '.pptx') {
    const zip = new AdmZip(buffer);
    const slides = zip.getEntries()
      .filter(entry => /^ppt\/slides\/slide\d+\.xml$/i.test(entry.entryName) && entry.header.size <= 500000)
      .sort((a, b) => {
        const pageA = Number(a.entryName.match(/slide(\d+)/i)[1]);
        const pageB = Number(b.entryName.match(/slide(\d+)/i)[1]);
        return pageA - pageB;
      });
    const extracted = slides.map((slide, index) => {
      const xml = slide.getData().toString('utf8');
      const paragraphs = [...xml.matchAll(/<a:p(?:\s[^>]*)?>([\s\S]*?)<\/a:p>/g)]
        .map(paragraph => [...paragraph[1].matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
          .map(match => decodeXmlText(match[1]).trim())
          .filter(Boolean)
          .join(' '))
        .filter(Boolean);
      return paragraphs.map(text => `[Slide ${index + 1}] ${text}`).join('\n');
    }).filter(Boolean).join('\n');
    const imageEntries = zip.getEntries()
      .filter(entry => /^ppt\/media\/.+\.(?:png|jpe?g|gif|bmp|webp)$/i.test(entry.entryName) && entry.header.size <= 1024 * 1024)
      .slice(0, 12);
    let imageBytes = 0;
    const embeddedImages = [];
    for (const entry of imageEntries) {
      const data = entry.getData();
      if (imageBytes + data.length > 3 * 1024 * 1024) break;
      imageBytes += data.length;
      const ext = path.extname(entry.entryName).toLowerCase();
      const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : `image/${ext.slice(1)}`;
      embeddedImages.push({ dataBase64: data.toString('base64'), mimeType });
    }
    return { text: extracted.slice(0, 80000), sections: slides.length, format: 'PowerPoint', embeddedImages };
  }

  if (extension === '.pdf') {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
      verbosity: 0
    });
    const document = await loadingTask.promise;
    const pages = [];
    const pageCount = Math.min(document.numPages, 100);
    for (let pageNumber = 1; pageNumber <= pageCount; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const lineGroups = [];
      for (const item of content.items) {
        const text = (item.str || '').trim();
        if (!text) continue;
        const y = item.transform ? item.transform[5] : 0;
        let line = lineGroups[lineGroups.length - 1];
        if (!line || Math.abs(line.y - y) > 2.5) {
          line = { y, text: '' };
          lineGroups.push(line);
        }
        line.text += `${line.text ? ' ' : ''}${text}`;
      }
      const text = lineGroups.map(line => `[Page ${pageNumber}] ${line.text}`).join('\n').trim();
      if (text) pages.push(text);
      if (pages.join('\n').length >= 80000) break;
    }
    await loadingTask.destroy();
    return { text: pages.join('\n').slice(0, 80000), sections: pageCount, format: 'PDF' };
  }

  if (extension === '.ppt') {
    throw new Error('Legacy .ppt files are not supported yet. Save the presentation as .pptx and upload it again.');
  }
  throw new Error('Unsupported file type. Upload a text-based PDF, PPTX, or TXT file.');
}

// Helper to determine student progression lock status for all topics
function computeStudentProgress(studentId) {
  const topics = [...db.topics].sort((a, b) => a.order - b.order);
  const submissions = db.submissions.filter(s => s.userId === studentId);

  const results = [];
  let previousTopicPassed = true; // Topic 1 is unlocked by default

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const topicSubs = submissions.filter(s => s.topicId === topic.id);
    const passingThreshold = Number(db.settings?.passingPercentage) || 50;
    const latestPassed = topicSubs.some(s => Number(s.percentage) >= passingThreshold);
    const hasAttempt = topicSubs.length > 0;
    const latestAttempt = topicSubs[topicSubs.length - 1] || null;

    let isLocked = false;
    let status = 'unlocked'; // 'locked', 'unlocked', 'completed', 'failed'

    if (i === 0) {
      isLocked = false;
    } else {
      isLocked = !previousTopicPassed;
    }

    if (isLocked) {
      status = 'locked';
    } else if (latestPassed) {
      status = 'completed';
    } else if (hasAttempt && !latestPassed) {
      status = 'failed'; // Failed! Can't proceed to next topic; repeat topic
    } else {
      status = 'unlocked';
    }

    results.push({
      topicId: topic.id,
      order: topic.order,
      title: topic.title,
      isLocked,
      status,
      attemptsCount: topicSubs.length,
      latestPassed,
      bestScore: topicSubs.reduce((max, s) => s.score > max ? s.score : max, 0),
      totalQuestions: topic.quizQuestions ? topic.quizQuestions.length : 0,
      latestAttempt
    });

    // Progression condition: Next topic is only unlocked if THIS topic was passed!
    previousTopicPassed = latestPassed;
  }

  return results;
}

// Start HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    return res.end();
  }

  // API Endpoints
  if (pathname.startsWith('/api/')) {
    try {
      if (pathname === '/api/extract-document' && method === 'POST') {
        const user = authenticate(req);
        if (!hasFacultyAccess(user)) {
          return sendJson(res, 403, { success: false, message: 'Faculty authorization required.' });
        }

        const body = await parseBody(req, MAX_UPLOAD_REQUEST_BYTES);
        if (!body.filename || typeof body.dataBase64 !== 'string' || !body.dataBase64) {
          return sendJson(res, 400, { success: false, message: 'Choose a document to extract.' });
        }
        if (body.dataBase64.length > MAX_UPLOAD_BASE64_LENGTH) {
          return sendJson(res, 413, { success: false, message: 'Choose a document smaller than 20 MB.' });
        }

        try {
          const buffer = Buffer.from(body.dataBase64, 'base64');
          if (buffer.length > MAX_UPLOAD_BYTES) {
            return sendJson(res, 400, { success: false, message: 'Choose a document smaller than 20 MB.' });
          }
          const result = await extractUploadedDocument(path.basename(body.filename), buffer);
          if (!result.text.trim()) {
            if (result.format === 'PDF') {
              return sendJson(res, 200, { success: true, ...result, requiresOCR: true });
            }
            return sendJson(res, 422, {
              success: false,
              message: 'No selectable text was found. This may be a scanned PDF; add OCR text or paste the lecture content before generating a quiz.'
            });
          }
          return sendJson(res, 200, { success: true, ...result });
        } catch (error) {
          return sendJson(res, 422, { success: false, message: error.message || 'Could not read the uploaded document.' });
        }
      }

      // 1. Auth: Login USING ID NUMBER (NO USERNAME)
      // Accepts idNumber (e.g. TUPT-23-1096 or TUPT-FAC-001)
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseBody(req);
        const searchId = (body.idNumber || body.username || '').trim().toUpperCase();
        const password = typeof body.password === 'string' ? body.password : '';

        if (!searchId || !password || password.length > 256) {
          return sendJson(res, 400, { success: false, message: 'Student / Faculty ID and password are required.' });
        }

        const user = db.users.find(u => u.idNumber && u.idNumber.toUpperCase() === searchId);

        if (!user || !(await verifyPassword(password, user.password))) {
          return sendJson(res, 401, {
            success: false,
            message: 'Invalid ID Number or password. Please verify your Student ID (e.g. TUPT-23-1096).'
          });
        }

        if (String(user.idNumber || '').trim().toUpperCase() === ADMIN_ID && user.role !== 'faculty') {
          user.role = 'faculty';
          saveDB();
        }

        const token = createSession(user);
        return sendJson(res, 200, {
          success: true,
          token,
          user: {
            id: user.id,
            idNumber: user.idNumber,
            role: effectiveRole(user),
            firstName: user.firstName,
            lastName: user.lastName,
            privacyAgreed: user.privacyAgreed,
            privacyAgreedAt: user.privacyAgreedAt
          }
        });
      }

      // 2. Auth: Register USING ID NUMBER (NO USERNAME)
      if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await parseBody(req);
        const { idNumber, password, firstName, lastName, privacyAgreed } = body;

        const cleanId = (idNumber || '').trim().toUpperCase();
        const cleanFirst = (firstName || '').trim();
        const cleanLast = (lastName || '').trim();
        const cleanPass = typeof password === 'string' ? password : '';

        if (!cleanFirst) {
          return sendJson(res, 400, { success: false, message: 'First name is required.' });
        }
        if (!cleanLast) {
          return sendJson(res, 400, { success: false, message: 'Last name is required.' });
        }
        if (!cleanId) {
          return sendJson(res, 400, { success: false, message: 'Student / Faculty ID is required (e.g. TUPT-23-1096).' });
        }
        if (!cleanPass) {
          return sendJson(res, 400, { success: false, message: 'Password is required.' });
        }
        if (cleanPass.length > 256) {
          return sendJson(res, 400, { success: false, message: 'Password must be 256 characters or fewer.' });
        }
        if (!privacyAgreed) {
          return sendJson(res, 400, { success: false, message: 'You must agree to the Data Privacy Notice to register.' });
        }

        const existingUser = db.users.find(u => u.idNumber && u.idNumber.toUpperCase() === cleanId);
        if (existingUser) {
          return sendJson(res, 409, { success: false, message: 'This ID is already registered. Please log in instead.' });
        }

        const newUser = {
          id: 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          idNumber: cleanId,
          password: await hashPassword(cleanPass),
          role: cleanId === ADMIN_ID ? 'faculty' : 'student',
          firstName: cleanFirst,
          lastName: cleanLast,
          privacyAgreed: true,
          privacyAgreedAt: new Date().toISOString(),
          registeredAt: new Date().toISOString(),
          ...(cleanId === ADMIN_ID ? {} : { enrollmentStatus: 'enrolled', enrolledAt: new Date().toISOString() })
        };

        db.users.push(newUser);
        saveDB();

        const token = createSession(newUser);
        return sendJson(res, 201, {
          success: true,
          token,
          user: {
            id: newUser.id,
            idNumber: newUser.idNumber,
            role: effectiveRole(newUser),
            enrollmentStatus: newUser.enrollmentStatus || null,
            enrolledAt: newUser.enrolledAt || null,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
            privacyAgreed: newUser.privacyAgreed,
            privacyAgreedAt: newUser.privacyAgreedAt
          }
        });
      }

      // 3. Auth: Current User Check
      if (pathname === '/api/auth/me' && method === 'GET') {
        const user = authenticate(req);
        if (!user) {
          return sendJson(res, 401, { success: false, message: 'Unauthorized' });
        }
        return sendJson(res, 200, {
          success: true,
          user: {
            id: user.id,
            idNumber: user.idNumber,
            role: effectiveRole(user),
            firstName: user.firstName,
            lastName: user.lastName,
            privacyAgreed: user.privacyAgreed,
            privacyAgreedAt: user.privacyAgreedAt
          }
        });
      }

      // 4. Subject Info (Get & Update)
      if (pathname === '/api/subject') {
        if (method === 'GET') {
          return sendJson(res, 200, { success: true, subject: db.subject, settings: db.settings });
        }
        if (method === 'PUT') {
          const user = authenticate(req);
          if (!hasFacultyAccess(user)) {
            return sendJson(res, 403, { success: false, message: 'Only faculty can edit subject details.' });
          }
          const body = await parseBody(req);
          if (body.name) db.subject.name = body.name.trim();
          if (body.code) db.subject.code = body.code.trim();
          if (body.term) db.subject.term = body.term.trim();
          if (body.yearLevel) db.subject.yearLevel = body.yearLevel.trim();
          if (body.passingPercentage !== undefined) {
            const passingPercentage = Number(body.passingPercentage);
            if (!Number.isFinite(passingPercentage) || passingPercentage < 1 || passingPercentage > 100) {
              return sendJson(res, 400, { success: false, message: 'Passing grade must be from 1% to 100%.' });
            }
            db.settings = { ...(db.settings || {}), passingPercentage };
            // The admin standard is the course-wide passing threshold for all quizzes.
            for (const topic of db.topics) {
              topic.quizSettings = { ...(topic.quizSettings || {}), passingPercentage };
            }
          }
          saveDB();
          return sendJson(res, 200, { success: true, subject: db.subject, settings: db.settings, message: 'Settings updated successfully.' });
        }
      }

      // 5. Topics / TOC List with progression state
      // Dynamic: Depende sa prof kung ilan ang topics!
      if (pathname === '/api/topics' && method === 'GET') {
        const user = authenticate(req);
        const sortedTopics = [...db.topics].sort((a, b) => a.order - b.order);

        if (!user || hasFacultyAccess(user)) {
          const topicList = sortedTopics.map(t => ({
            id: t.id,
            order: t.order,
            title: t.title,
            isLocked: false,
            status: 'unlocked',
            questionCount: t.quizQuestions ? t.quizQuestions.length : 0,
            hasPresentation: !!(t.presentation && (t.presentation.fileUrl || t.presentation.title)),
            slidesCount: t.slides ? t.slides.length : 0
          }));
          return sendJson(res, 200, { success: true, topics: topicList, isFaculty: true, totalTopics: topicList.length });
        }

        // Student: compute strict progression lock
        const studentProgress = computeStudentProgress(user.id);
        const topicsWithStatus = sortedTopics.map(t => {
          const prog = studentProgress.find(p => p.topicId === t.id);
          return {
            id: t.id,
            order: t.order,
            title: t.title,
            isLocked: prog ? prog.isLocked : false,
            status: prog ? prog.status : 'unlocked',
            attemptsCount: prog ? prog.attemptsCount : 0,
            latestPassed: prog ? prog.latestPassed : false,
            bestScore: prog ? prog.bestScore : 0,
            totalQuestions: prog ? prog.totalQuestions : 0,
            hasPresentation: !!(t.presentation && (t.presentation.fileUrl || t.presentation.title)),
            slidesCount: t.slides ? t.slides.length : 0
          };
        });

        return sendJson(res, 200, { success: true, topics: topicsWithStatus, isFaculty: false, totalTopics: topicsWithStatus.length });
      }

      // 6. Topic Detail by ID (Text, Presentation, Slides, Summary)
      const topicMatch = pathname.match(/^\/api\/topics\/([^\/]+)$/);
      if (topicMatch) {
        const topicId = topicMatch[1];
        const topic = db.topics.find(t => t.id === topicId);
        if (!topic) {
          return sendJson(res, 404, { success: false, message: 'Topic not found.' });
        }

        if (method === 'GET') {
          const user = authenticate(req);
          if (!user) {
            return sendJson(res, 401, { success: false, message: 'Authentication required to view topic materials.' });
          }
          if (!hasFacultyAccess(user)) {
            const studentProg = computeStudentProgress(user.id);
            const myTopicProg = studentProg.find(p => p.topicId === topicId);
            if (myTopicProg && myTopicProg.isLocked) {
              return sendJson(res, 403, {
                success: false,
                isLocked: true,
                message: `This topic is locked. You must pass the previous topic quiz with at least ${db.settings.passingPercentage}% to proceed.`
              });
            }
          }

          return sendJson(res, 200, {
            success: true,
            topic: {
              id: topic.id,
              order: topic.order,
              title: topic.title,
              lessonText: topic.lessonText || '',
              presentation: topic.presentation || { title: '', fileUrl: '' },
              slides: topic.slides || [],
              summary: topic.summary || '',
              quizSettings: { timeLimitMinutes: 10, maxQuestions: 20, ...(topic.quizSettings || {}), passingPercentage: Number(db.settings.passingPercentage) || 50 },
              questionCount: topic.quizQuestions ? topic.quizQuestions.length : 0
            }
          });
        }

        // Faculty: Update Topic (Text, Slides, Presentation, Summary)
        if (method === 'PUT') {
          const user = authenticate(req);
          if (!hasFacultyAccess(user)) {
            return sendJson(res, 403, { success: false, message: 'Faculty authorization required.' });
          }
          const body = await parseBody(req);
          if (body.title !== undefined) topic.title = body.title.trim();
          if (body.lessonText !== undefined) topic.lessonText = body.lessonText;
          if (body.presentation !== undefined) topic.presentation = body.presentation;
          if (body.slides !== undefined) topic.slides = body.slides;
          if (body.summary !== undefined) topic.summary = body.summary;
          if (body.quizSettings !== undefined) topic.quizSettings = body.quizSettings;
          saveDB();
          return sendJson(res, 200, { success: true, message: 'Topic content saved successfully.', topic });
        }

        // Faculty: Delete Topic & re-number remaining topics dynamically
        if (method === 'DELETE') {
          const user = authenticate(req);
          if (!hasFacultyAccess(user)) {
            return sendJson(res, 403, { success: false, message: 'Faculty authorization required.' });
          }
          db.topics = db.topics.filter(t => t.id !== topicId);
          // Re-sequence orders
          db.topics.sort((a, b) => a.order - b.order).forEach((t, i) => {
            t.order = i + 1;
            // update title if starts with Topic X
            t.title = t.title.replace(/^Topic\s+\d+:/i, `Topic ${i + 1}:`);
          });
          // Also remove associated submissions
          db.submissions = db.submissions.filter(s => s.topicId !== topicId);
          saveDB();
          return sendJson(res, 200, { success: true, message: 'Topic removed and curriculum re-indexed.' });
        }
      }

      // 7. Add New Topic (Faculty) - Dynamic topic creation
      if (pathname === '/api/topics' && method === 'POST') {
        const user = authenticate(req);
        if (!hasFacultyAccess(user)) {
          return sendJson(res, 403, { success: false, message: 'Faculty authorization required.' });
        }
        const body = await parseBody(req);
        const requestedTimeLimit = Number(body.quizSettings?.timeLimitMinutes ?? 10);
        if (!Number.isInteger(requestedTimeLimit) || requestedTimeLimit < 1 || requestedTimeLimit > 180) {
          return sendJson(res, 400, { success: false, message: 'Quiz time limit must be between 1 and 180 minutes.' });
        }
        const newOrder = db.topics.length + 1;
        const newTopic = {
          id: 'top_' + Date.now(),
          order: newOrder,
          title: body.title || `Topic ${newOrder}: System Administration and Maintenance`,
          lessonText: body.lessonText || '<p>Enter System Administration and Maintenance course content here...</p>',
          presentation: {
            title: body.presentationTitle || (body.presentation ? body.presentation.title : ''),
            fileUrl: body.presentationFileUrl || (body.presentation ? body.presentation.fileUrl : ''),
            isUploaded: !!(body.presentationFileUrl || (body.presentation && body.presentation.fileUrl))
          },
          slides: Array.isArray(body.slides) ? body.slides : [
            { title: `Slide 1: Topic ${newOrder} Overview`, content: "• System concepts and administration tasks\n• Maintenance procedures\n• Security and troubleshooting practices" }
          ],
          summary: body.summary !== undefined ? body.summary : '<p>Summary of system administration concepts, maintenance procedures, and troubleshooting practices.</p>',
          quizSettings: {
            timeLimitMinutes: requestedTimeLimit,
            maxQuestions: 20,
            ...(body.quizSettings || {}),
            passingPercentage: Number(db.settings.passingPercentage) || 50
          },
          quizQuestions: []
        };
        db.topics.push(newTopic);
        saveDB();
        return sendJson(res, 201, { success: true, topic: newTopic, message: 'Topic created successfully.' });
      }

      // 8. Presentation Upload / File Upload endpoint
      if (pathname === '/api/upload' && method === 'POST') {
        const user = authenticate(req);
        if (!hasFacultyAccess(user)) {
          return sendJson(res, 403, { success: false, message: 'Faculty authorization required to upload presentations.' });
        }
        const body = await parseBody(req, MAX_UPLOAD_REQUEST_BYTES);
        if (!body.filename || typeof body.dataBase64 !== 'string' || !body.dataBase64) {
          return sendJson(res, 400, { success: false, message: 'Missing filename or file data.' });
        }
        if (body.dataBase64.length > MAX_UPLOAD_BASE64_LENGTH) {
          return sendJson(res, 413, { success: false, message: 'Choose a file smaller than 20 MB.' });
        }

        const safeFilename = Date.now() + '_' + path.basename(body.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = path.join(UPLOADS_DIR, safeFilename);
        const buffer = Buffer.from(body.dataBase64, 'base64');
        if (buffer.length > MAX_UPLOAD_BYTES) {
          return sendJson(res, 400, { success: false, message: 'Choose a file smaller than 20 MB.' });
        }
        fs.writeFileSync(filePath, buffer);

        const fileUrl = '/uploads/' + safeFilename;
        if (body.topicId) {
          const topic = db.topics.find(t => t.id === body.topicId);
          if (topic) {
            topic.presentation = {
              title: body.filename,
              fileUrl: fileUrl,
              isUploaded: true,
              uploadedAt: new Date().toISOString()
            };
            saveDB();
          }
        }

        return sendJson(res, 200, {
          success: true,
          message: 'Presentation uploaded successfully.',
          fileUrl,
          filename: body.filename
        });
      }

      // 9. Get Topic Quiz (Questions)
      const quizMatch = pathname.match(/^\/api\/quizzes\/([^\/]+)$/);
      if (quizMatch) {
        const topicId = quizMatch[1];
        const topic = db.topics.find(t => t.id === topicId);
        if (!topic) {
          return sendJson(res, 404, { success: false, message: 'Topic not found.' });
        }

        if (method === 'GET') {
          const user = authenticate(req);
          if (!user) {
            return sendJson(res, 401, { success: false, message: 'Authentication required to access quizzes.' });
          }
          if (!hasFacultyAccess(user)) {
            const prog = computeStudentProgress(user.id);
            const thisProg = prog.find(p => p.topicId === topicId);
            if (thisProg && thisProg.isLocked) {
              return sendJson(res, 403, {
                success: false,
                isLocked: true,
                message: 'Topic is locked. You must pass previous topic quizzes first.'
              });
            }

            const sanitizedQuestions = (topic.quizQuestions || []).map(q => ({
              id: q.id,
              question: q.question,
              options: q.options
            }));

            const studentSubs = db.submissions.filter(s => s.userId === user.id && s.topicId === topicId);
            const latestSub = studentSubs[studentSubs.length - 1] || null;

            return sendJson(res, 200, {
              success: true,
              topicTitle: topic.title,
              quizSettings: { timeLimitMinutes: 10, maxQuestions: 20, ...(topic.quizSettings || {}), passingPercentage: Number(db.settings.passingPercentage) || 50 },
              questions: sanitizedQuestions,
              totalQuestions: sanitizedQuestions.length,
              previousAttemptsCount: studentSubs.length,
              latestAttempt: latestSub
            });
          }

          return sendJson(res, 200, {
            success: true,
            topicTitle: topic.title,
            quizSettings: { timeLimitMinutes: 10, maxQuestions: 20, ...(topic.quizSettings || {}), passingPercentage: Number(db.settings.passingPercentage) || 50 },
            questions: topic.quizQuestions || [],
            isFaculty: true
          });
        }

        // Faculty: Update Quiz questions / settings
        if (method === 'PUT' || method === 'POST') {
          const user = authenticate(req);
          if (!hasFacultyAccess(user)) {
            return sendJson(res, 403, { success: false, message: 'Faculty authorization required.' });
          }
          const body = await parseBody(req);
          if (body.quizSettings) {
            const timeLimitMinutes = Number(body.quizSettings.timeLimitMinutes);
            if (!Number.isInteger(timeLimitMinutes) || timeLimitMinutes < 1 || timeLimitMinutes > 180) {
              return sendJson(res, 400, { success: false, message: 'Quiz time limit must be between 1 and 180 minutes.' });
            }
            topic.quizSettings = {
              timeLimitMinutes,
              maxQuestions: Number(body.quizSettings.maxQuestions) || 20,
              passingPercentage: Number(db.settings.passingPercentage) || 50
            };
          }
          if (Array.isArray(body.questions)) {
            const oldQuestions = topic.quizQuestions || [];
            const oldById = new Map(oldQuestions.map(question => [question.id, JSON.stringify(question)]));
            const isDeletionOnly = body.questions.every(question => oldById.get(question.id) === JSON.stringify(question));
            if (!isDeletionOnly) {
              return sendJson(res, 400, { success: false, message: 'Quiz questions must come from an uploaded quiz file.' });
            }
            topic.quizQuestions = body.questions;
          }
          saveDB();
          return sendJson(res, 200, { success: true, message: 'Quiz saved successfully.', topic });
        }
      }

      // 10. Bulk Import Quiz Questions
      const generatedMatch = pathname.match(/^\/api\/quizzes\/([^/]+)\/generated$/);
      if (generatedMatch && method === 'POST') {
        const user = authenticate(req);
        if (!hasFacultyAccess(user)) {
          return sendJson(res, 403, { success: false, message: 'Faculty authorization required.' });
        }
        const topic = db.topics.find(t => t.id === generatedMatch[1]);
        if (!topic) return sendJson(res, 404, { success: false, message: 'Topic not found.' });
        const body = await parseBody(req);
        if (!Array.isArray(body.questions) || body.questions.length < 4 || body.questions.length > 20) {
          return sendJson(res, 400, { success: false, message: 'Generated quiz must contain 4 to 20 readable questions.' });
        }
        const questions = body.questions.map((question, index) => ({
          id: `gen_${Date.now()}_${index}`,
          question: String(question.question || '').trim().slice(0, 1000),
          options: Array.isArray(question.options) ? question.options.map(option => String(option).trim().slice(0, 500)) : [],
          correctAnswer: Number(question.correctAnswer),
          explanation: String(question.explanation || '').trim().slice(0, 1500),
          source: 'Uploaded course material'
        }));
        if (questions.some(question => !question.question || question.options.length < 2 || question.options.length > 6 ||
            question.options.some(option => !option) || !Number.isInteger(question.correctAnswer) ||
            question.correctAnswer < 0 || question.correctAnswer >= question.options.length)) {
          return sendJson(res, 400, { success: false, message: 'Generated quiz contains an invalid question or answer.' });
        }
        topic.quizQuestions = questions;
        saveDB();
        return sendJson(res, 200, { success: true, message: `Saved ${questions.length} questions generated from the uploaded material.`, count: questions.length });
      }

      const importMatch = pathname.match(/^\/api\/quizzes\/([^\/]+)\/import$/);
      if (importMatch && method === 'POST') {
        const topicId = importMatch[1];
        const topic = db.topics.find(t => t.id === topicId);
        if (!topic) {
          return sendJson(res, 404, { success: false, message: 'Topic not found.' });
        }
        const user = authenticate(req);
        if (!hasFacultyAccess(user)) {
          return sendJson(res, 403, { success: false, message: 'Faculty authorization required.' });
        }

        const body = await parseBody(req);
        let importedQuestions = [];
        let skippedQuestionCount = 0;

        if (typeof body.rawText === 'string') {
          const lines = body.rawText.split('\n').map(l => l.trim()).filter(Boolean);
          let currentQ = null;
          const addValidQuestion = () => {
            if (!currentQ) return;
            if (!currentQ.question || currentQ.options.length < 2 || !Number.isInteger(currentQ.correctAnswer) ||
                currentQ.correctAnswer < 0 || currentQ.correctAnswer >= currentQ.options.length) {
              skippedQuestionCount++;
              return;
            }
            importedQuestions.push(currentQ);
          };

          for (const line of lines) {
            if (/^\d+[\.\)]\s*(.*)/.test(line)) {
              addValidQuestion();
              const match = line.match(/^\d+[\.\)]\s*(.*)/);
              currentQ = {
                id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                question: match[1],
                options: [],
                correctAnswer: null,
                explanation: ''
              };
            } else if (/^[a-dA-D][\.\)]\s*(.*)/.test(line) && currentQ) {
              const optMatch = line.match(/^([a-dA-D])[\.\)]\s*(.*)/);
              currentQ.options.push(optMatch[2]);
            } else if (/^(?:Correct\s+)?Answer:\s*([a-dA-D]|\d+)/i.test(line) && currentQ) {
              const ansMatch = line.match(/^(?:Correct\s+)?Answer:\s*([a-dA-D]|\d+)/i);
              const val = ansMatch[1];
              if (isNaN(val)) {
                currentQ.correctAnswer = val.toUpperCase().charCodeAt(0) - 65;
              } else {
                const numericAnswer = parseInt(val, 10);
                currentQ.correctAnswer = numericAnswer > 0 ? numericAnswer - 1 : numericAnswer;
              }
            }
          }
          addValidQuestion();
        }

        if (importedQuestions.length === 0) {
          return sendJson(res, 400, { success: false, message: 'No valid questions found. Add numbered questions, at least two options, and a valid Answer: line.' });
        }

        const existingQuestions = body.mode === 'replace' ? [] : (topic.quizQuestions || []);
        const seenQuestionTexts = new Set(existingQuestions.map(question =>
          String(question.question || '').trim().toLowerCase().replace(/\s+/g, ' ')
        ));
        const newQuestions = importedQuestions.filter(question => {
          const key = String(question.question || '').trim().toLowerCase().replace(/\s+/g, ' ');
          if (!key || seenQuestionTexts.has(key)) {
            skippedQuestionCount++;
            return false;
          }
          seenQuestionTexts.add(key);
          return true;
        });
        topic.quizQuestions = body.mode === 'replace' ? newQuestions : existingQuestions.concat(newQuestions);
        saveDB();

        return sendJson(res, 200, {
          success: true,
          message: `Added ${newQuestions.length} questions${skippedQuestionCount ? `; skipped ${skippedQuestionCount} invalid or duplicate questions` : ''}.`,
          count: topic.quizQuestions.length
        });
      }

      // 11. Student Quiz Submission & Progression Gating (Admin-configured threshold)
      const submitMatch = pathname.match(/^\/api\/quizzes\/([^\/]+)\/submit$/);
      if (submitMatch && method === 'POST') {
        const topicId = submitMatch[1];
        const topic = db.topics.find(t => t.id === topicId);
        if (!topic) {
          return sendJson(res, 404, { success: false, message: 'Topic not found.' });
        }
        const user = authenticate(req);
        if (!user) {
          return sendJson(res, 401, { success: false, message: 'Authentication required to submit quiz.' });
        }
        if (hasFacultyAccess(user) || user.role !== 'student') {
          return sendJson(res, 403, { success: false, message: 'Only enrolled students can submit quizzes.' });
        }
        if (!Array.isArray(topic.quizQuestions) || topic.quizQuestions.length === 0) {
          return sendJson(res, 400, { success: false, message: 'This topic has no uploaded quiz yet.' });
        }

        const body = await parseBody(req);
        const studentAnswers = body.answers && typeof body.answers === 'object' && !Array.isArray(body.answers) ? body.answers : {};

        let score = 0;
        const total = (topic.quizQuestions || []).length;
        for (const q of (topic.quizQuestions || [])) {
          const selected = studentAnswers[q.id];
          const answerIndex = Number(selected);
          const isCorrect = selected !== undefined && selected !== null && Number.isInteger(answerIndex) &&
            answerIndex >= 0 && answerIndex < q.options.length && answerIndex === q.correctAnswer;
          if (isCorrect) score++;
        }

        const passingThreshold = Number(db.settings.passingPercentage) || 50;
        const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
        const passed = percentage >= passingThreshold;

        const priorAttempts = db.submissions.filter(s => s.userId === user.id && s.topicId === topicId).length;
        const newAttemptNumber = priorAttempts + 1;

        const submissionRecord = {
          id: 'sub_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          userId: user.id,
          topicId: topic.id,
          score,
          totalQuestions: total,
          percentage,
          passed,
          attempt: newAttemptNumber,
          submittedAt: new Date().toISOString()
        };

        db.submissions.push(submissionRecord);
        saveDB();

        const nextTopic = db.topics.find(t => t.order === topic.order + 1);

        return sendJson(res, 200, {
          success: true,
          score,
          totalQuestions: total,
          percentage,
          passingThreshold,
          passed,
          attempt: newAttemptNumber,
          canProceed: passed,
          nextTopicTitle: nextTopic ? nextTopic.title : null,
          message: passed
            ? `CONGRATULATIONS! You passed with ${percentage}%! You may now proceed to the next topic.`
            : `FAILED QUIZ - You scored ${percentage}% (Passing is ${passingThreshold}%). You CANNOT proceed to the next topic. Please repeat and review ${topic.title} before retaking the quiz.`
        });
      }

      // 12. Topic Quiz Summary & Reports
      // Supports: sorted by surname, sorted by score, CSV export
      const topicReportMatch = pathname.match(/^\/api\/reports\/topic\/([^\/]+)$/);
      if (topicReportMatch && method === 'GET') {
        const requester = authenticate(req);
        if (!hasFacultyAccess(requester)) {
          return sendJson(res, requester ? 403 : 401, { success: false, message: 'Faculty authorization required to view student grades.' });
        }
        const topicId = topicReportMatch[1];
        const topic = db.topics.find(t => t.id === topicId);
        if (!topic) {
          return sendJson(res, 404, { success: false, message: 'Topic not found.' });
        }

        const sortBy = parsedUrl.query.sort || 'surname';
        const order = parsedUrl.query.order || 'asc';

        const students = db.users.filter(u => u.role === 'student' && u.registeredAt);
        const rows = [];

        for (const student of students) {
          const studentSubs = db.submissions.filter(s => s.userId === student.id && s.topicId === topicId);
          if (studentSubs.length > 0) {
            const bestSub = studentSubs.reduce((prev, curr) => (curr.score > prev.score ? curr : prev), studentSubs[0]);
            const latestSub = studentSubs[studentSubs.length - 1];

            rows.push({
              studentId: student.id,
              idNumber: student.idNumber,
              lastName: student.lastName,
              firstName: student.firstName,
              fullName: `${student.lastName}, ${student.firstName}`,
              score: bestSub.score,
              totalQuestions: bestSub.totalQuestions,
              percentage: bestSub.percentage,
              passed: Number(bestSub.percentage) >= (Number(db.settings.passingPercentage) || 50),
              attempts: studentSubs.length,
              latestSubmittedAt: latestSub.submittedAt
            });
          } else {
            rows.push({
              studentId: student.id,
              idNumber: student.idNumber,
              lastName: student.lastName,
              firstName: student.firstName,
              fullName: `${student.lastName}, ${student.firstName}`,
              score: 0,
              totalQuestions: (topic.quizQuestions || []).length,
              percentage: 0,
              passed: false,
              attempts: 0,
              latestSubmittedAt: null,
              notTaken: true
            });
          }
        }

        if (sortBy === 'score') {
          rows.sort((a, b) => order === 'asc' ? a.percentage - b.percentage : b.percentage - a.percentage);
        } else {
          rows.sort((a, b) => {
            const comp = a.lastName.localeCompare(b.lastName);
            return order === 'desc' ? -comp : comp;
          });
        }

        if (parsedUrl.query.format === 'csv') {
          let csv = `Topic Quiz Summary Report\r\n`;
          csv += `Subject: "${db.subject.name}" (${db.subject.code})\r\n`;
          csv += `Term: "${db.subject.term}" | Year Level: "${db.subject.yearLevel}"\r\n`;
          csv += `Topic: "${topic.title}"\r\n`;
          csv += `Passing Score: ${Number(db.settings.passingPercentage) || 50}%\r\n`;
          csv += `Generated On: "${new Date().toLocaleString()}"\r\n\r\n`;
          csv += `Student ID,Surname,First Name,Score,Total Items,Percentage,Status,Attempts,Last Submitted\r\n`;

          for (const r of rows) {
            const statusStr = r.notTaken ? 'NOT TAKEN' : (r.passed ? 'PASSED' : 'FAILED');
            const dateStr = r.latestSubmittedAt ? new Date(r.latestSubmittedAt).toLocaleDateString() : 'N/A';
            csv += `"${r.idNumber}","${r.lastName}","${r.firstName}",${r.score},${r.totalQuestions},"${r.percentage}%","${statusStr}",${r.attempts},"${dateStr}"\r\n`;
          }

          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=UTF-8',
            'Content-Disposition': `attachment; filename="System_Administration_Quiz_${topic.id}.csv"`
          });
          return res.end(csv);
        }

        return sendJson(res, 200, {
          success: true,
          subject: db.subject,
          topic: {
            id: topic.id,
            order: topic.order,
            title: topic.title,
              passingPercentage: Number(db.settings.passingPercentage) || 50
          },
          sortBy,
          order,
          records: rows
        });
      }

      // 13. Master Summary of ALL Quiz Scores per Student
      // Dynamic: Displays all topics that currently exist in the curriculum
      if (pathname === '/api/reports/all' && method === 'GET') {
        const requester = authenticate(req);
        if (!hasFacultyAccess(requester)) {
          return sendJson(res, requester ? 403 : 401, { success: false, message: 'Faculty authorization required to view the gradebook.' });
        }
        const sortedTopics = [...db.topics].sort((a, b) => a.order - b.order);
        const students = db.users.filter(u => u.role === 'student' && u.registeredAt);

        const studentRows = [];

        for (const student of students) {
          const topicScores = {};
          let totalEarned = 0;
          let totalPossible = 0;
          let passedAll = true;

          for (const t of sortedTopics) {
            const studentSubs = db.submissions.filter(s => s.userId === student.id && s.topicId === t.id);
            if (studentSubs.length > 0) {
              const best = studentSubs.reduce((max, s) => s.score > max.score ? s : max, studentSubs[0]);
              topicScores[t.id] = {
                score: best.score,
                total: best.totalQuestions,
                percentage: best.percentage,
                passed: Number(best.percentage) >= (Number(db.settings.passingPercentage) || 50),
                attempts: studentSubs.length
              };
              totalEarned += best.score;
              totalPossible += best.totalQuestions;
              if (Number(best.percentage) < (Number(db.settings.passingPercentage) || 50)) passedAll = false;
            } else {
              topicScores[t.id] = {
                score: 0,
                total: t.quizQuestions ? t.quizQuestions.length : 0,
                percentage: 0,
                passed: false,
                attempts: 0,
                notTaken: true
              };
              totalPossible += (t.quizQuestions ? t.quizQuestions.length : 0);
              passedAll = false;
            }
          }

          const overallPercentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
          const quizAttempts = db.submissions.filter(s => s.userId === student.id).length;
          const overallStatus = quizAttempts === 0
            ? 'NOT STARTED'
            : overallPercentage >= (Number(db.settings.passingPercentage) || 50) && passedAll
              ? 'PASSED'
              : overallPercentage >= (Number(db.settings.passingPercentage) || 50)
                ? 'IN PROGRESS'
                : 'NEEDS RETAKE';

          studentRows.push({
            studentId: student.id,
            idNumber: student.idNumber,
            lastName: student.lastName,
            firstName: student.firstName,
            fullName: `${student.lastName}, ${student.firstName}`,
            topicScores,
            totalEarned,
            totalPossible,
            overallPercentage,
            quizAttempts,
            overallStatus
          });
        }

        studentRows.sort((a, b) => a.lastName.localeCompare(b.lastName));

        if (parsedUrl.query.format === 'csv') {
          let csv = `Master Summary of All Quiz Scores per Student\r\n`;
          csv += `Subject: "${db.subject.name}" (${db.subject.code})\r\n`;
          csv += `Term: "${db.subject.term}" | Year Level: "${db.subject.yearLevel}"\r\n`;
          csv += `Generated On: "${new Date().toLocaleString()}"\r\n\r\n`;

          let header = `Student ID,Surname,First Name`;
          for (const t of sortedTopics) {
            header += `,"Topic ${t.order} Score","Topic ${t.order} %","Topic ${t.order} Status"`;
          }
          header += `,Quiz Attempts,Total Earned,Total Items,Overall %,Overall Standing\r\n`;
          csv += header;

          for (const s of studentRows) {
            let row = `"${s.idNumber}","${s.lastName}","${s.firstName}"`;
            for (const t of sortedTopics) {
              const sc = s.topicScores[t.id];
              if (sc.notTaken) {
                row += `,"0 / ${sc.total}","0%","NOT TAKEN"`;
              } else {
                row += `,"${sc.score} / ${sc.total}","${sc.percentage}%","${sc.passed ? 'PASSED' : 'FAILED'}"`;
              }
            }
            row += `,${s.quizAttempts},${s.totalEarned},${s.totalPossible},"${s.overallPercentage}%","${s.overallStatus}"\r\n`;
            csv += row;
          }

          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=UTF-8',
            'Content-Disposition': `attachment; filename="System_Administration_Master_Gradebook.csv"`
          });
          return res.end(csv);
        }

        return sendJson(res, 200, {
          success: true,
          subject: db.subject,
          passingPercentage: Number(db.settings.passingPercentage) || 50,
          topics: sortedTopics.map(t => ({ id: t.id, order: t.order, title: t.title })),
          students: studentRows
        });
      }

      // 14. Reset Demo Data
      if (pathname === '/api/system/reset' && method === 'POST') {
        db = getInitialDB();
        saveDB();
        return sendJson(res, 200, { success: true, message: 'System Administration and Maintenance database reset to its default state.' });
      }

      return sendJson(res, 404, { success: false, message: 'API route not found' });
    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, err.statusCode || 500, { success: false, message: err.message || 'Server error.' });
    }
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (pathname.startsWith('/vendor/pdfjs/')) {
    const pdfjsRoot = path.join(__dirname, 'node_modules', 'pdfjs-dist');
    const relativeAsset = decodeURIComponent(pathname.slice('/vendor/pdfjs/'.length));
    const candidate = path.resolve(pdfjsRoot, relativeAsset);
    if (!candidate.startsWith(pdfjsRoot + path.sep) || !/\.(?:mjs|bcmap|pfb|ttf|wasm)$/i.test(candidate)) {
      res.writeHead(403);
      return res.end('Access denied');
    }
    filePath = candidate;
  }

  if (pathname.startsWith('/vendor/ogl/')) {
    const oglRoot = path.join(__dirname, 'node_modules', 'ogl', 'src');
    const relativeAsset = decodeURIComponent(pathname.slice('/vendor/ogl/'.length));
    const candidate = path.resolve(oglRoot, relativeAsset);
    if (!candidate.startsWith(oglRoot + path.sep) || !/\.js$/i.test(candidate)) {
      res.writeHead(403);
      return res.end('Access denied');
    }
    filePath = candidate;
  }

  if (pathname.startsWith('/uploads/')) {
    filePath = path.join(__dirname, pathname);
  }

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end('Access denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      if (!path.extname(pathname)) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('File Not Found');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// Initialize database before accepting requests.
loadDB().then(() => {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`System Administration and Maintenance Portal running on http://localhost:${PORT}`);
    console.log(`Storage: ${usePostgres ? 'PostgreSQL (' + DATABASE_URL.replace(/:[^:@/]+@/, ':****@') + ')' : 'Local JSON file (data/db.json)'}`);
    console.log(`Authentication Mode: Student ID (Format: TUPT-23-1096)`);
    console.log(`=======================================================`);
  });
}).catch(err => {
  console.error('Could not initialize database:', err);
  process.exit(1);
});

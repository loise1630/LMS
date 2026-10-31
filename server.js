/**
 * ITPE PROJECT - Numerical Methods Learning Management & Assessment System
 * Fully self-contained Node.js server (zero external dependencies required)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'db.json');
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/itpe_portal';
const pgPool = new Pool({ connectionString: DATABASE_URL });
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const PUBLIC_DIR = path.join(__dirname, 'public');

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
      name: "Numerical Methods",
      code: "MATH 313 / NUM-MET",
      term: "1st Semester, A.Y. 2026-2027",
      yearLevel: "3rd Year - BSIT / Engineering"
    },
    users: [
      {
        id: "usr_fac_1",
        idNumber: "TUPT-FAC-001",
        password: "faculty123",
        role: "faculty",
        firstName: "Maria Teresa",
        lastName: "Santos",
        privacyAgreed: true,
        privacyAgreedAt: "2026-08-15T08:00:00.000Z"
      },
      {
        id: "usr_stu_1",
        idNumber: "TUPT-23-1096",
        password: "student123",
        role: "student",
        firstName: "Juan",
        lastName: "Dela Cruz",
        privacyAgreed: true,
        privacyAgreedAt: "2026-08-20T09:15:00.000Z"
      },
      {
        id: "usr_stu_2",
        idNumber: "TUPT-23-1097",
        password: "student123",
        role: "student",
        firstName: "Maria Carmela",
        lastName: "Alvarez",
        privacyAgreed: true,
        privacyAgreedAt: "2026-08-20T09:20:00.000Z"
      },
      {
        id: "usr_stu_3",
        idNumber: "TUPT-23-1098",
        password: "student123",
        role: "student",
        firstName: "Carlo",
        lastName: "Reyes",
        privacyAgreed: true,
        privacyAgreedAt: "2026-08-20T09:30:00.000Z"
      },
      {
        id: "usr_stu_4",
        idNumber: "TUPT-23-1099",
        password: "student123",
        role: "student",
        firstName: "Kimberly",
        lastName: "Tan",
        privacyAgreed: true,
        privacyAgreedAt: "2026-08-20T10:05:00.000Z"
      },
      {
        id: "usr_stu_5",
        idNumber: "TUPT-23-1100",
        password: "student123",
        role: "student",
        firstName: "Mark Anthony",
        lastName: "Bautista",
        privacyAgreed: true,
        privacyAgreedAt: "2026-08-20T10:15:00.000Z"
      }
    ],
    // Topics start EMPTY - Professor uploads topics and materials
    topics: [],
    // Submissions start EMPTY
    submissions: []
  };
}

async function loadDB() {
  await pgPool.query(`
    CREATE TABLE IF NOT EXISTS app_state (
      id SMALLINT PRIMARY KEY CHECK (id = 1),
      state JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const result = await pgPool.query('SELECT state FROM app_state WHERE id = 1');
  if (result.rows.length) {
    db = result.rows[0].state;
  } else if (fs.existsSync(DB_FILE)) {
    // One-time migration from the previous JSON database.
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    await saveDB();
    console.log('Migrated data/db.json into PostgreSQL.');
  } else {
    db = getInitialDB();
    await saveDB();
  }

  if (db.subject && db.subject.name.includes('Systems Integration')) {
    db.subject.name = 'Numerical Methods';
    db.subject.code = 'MATH 313 / NUM-MET';
    await saveDB();
  }
  return db;
}

function saveDB() {
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
  const customId = req.headers['x-user-id'];
  if (customId) {
    const user = db.users.find(u => u.id === customId || (u.idNumber && u.idNumber.toUpperCase() === customId.toUpperCase()));
    if (user) return user;
  }
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

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 10 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
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

// Helper to determine student progression lock status for all topics
function computeStudentProgress(studentId) {
  const topics = [...db.topics].sort((a, b) => a.order - b.order);
  const submissions = db.submissions.filter(s => s.userId === studentId);

  const results = [];
  let previousTopicPassed = true; // Topic 1 is unlocked by default

  for (let i = 0; i < topics.length; i++) {
    const topic = topics[i];
    const topicSubs = submissions.filter(s => s.topicId === topic.id);
    const latestPassed = topicSubs.some(s => s.passed);
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
      // 1. Auth: Login USING ID NUMBER (NO USERNAME)
      // Accepts idNumber (e.g. TUPT-23-1096 or TUPT-FAC-001)
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseBody(req);
        const searchId = (body.idNumber || body.username || '').trim().toUpperCase();
        const password = body.password;

        if (!searchId || !password) {
          return sendJson(res, 400, { success: false, message: 'Student / Faculty ID and password are required.' });
        }

        const user = db.users.find(u =>
          (u.idNumber && u.idNumber.toUpperCase() === searchId) && u.password === password
        );

        if (!user) {
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
        const { idNumber, password, role, firstName, lastName, privacyAgreed } = body;

        const cleanId = (idNumber || '').trim().toUpperCase();
        const cleanFirst = (firstName || '').trim();
        const cleanLast = (lastName || '').trim();
        const cleanPass = (password || '');

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
        if (!privacyAgreed) {
          return sendJson(res, 400, { success: false, message: 'You must agree to the Data Privacy Notice to register.' });
        }

        let existingUser = db.users.find(u => u.idNumber && u.idNumber.toUpperCase() === cleanId);
        if (existingUser) {
          existingUser.firstName = cleanFirst;
          existingUser.lastName = cleanLast;
          existingUser.password = cleanPass;
          existingUser.role = cleanId === ADMIN_ID || role === 'faculty' ? 'faculty' : 'student';
          saveDB();
          const token = createSession(existingUser);
          return sendJson(res, 200, {
            success: true,
            token,
            user: {
              id: existingUser.id,
              idNumber: existingUser.idNumber,
              role: effectiveRole(existingUser),
              firstName: existingUser.firstName,
              lastName: existingUser.lastName,
              privacyAgreed: true,
              privacyAgreedAt: existingUser.privacyAgreedAt || new Date().toISOString()
            }
          });
        }

        const newUser = {
          id: 'usr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
          idNumber: cleanId,
          password: cleanPass,
          role: cleanId === ADMIN_ID || role === 'faculty' ? 'faculty' : 'student',
          firstName: cleanFirst,
          lastName: cleanLast,
          privacyAgreed: true,
          privacyAgreedAt: new Date().toISOString()
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

      // 4. Subject Info (Get & Update) - Numerical Methods
      if (pathname === '/api/subject') {
        if (method === 'GET') {
          return sendJson(res, 200, { success: true, subject: db.subject });
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
          saveDB();
          return sendJson(res, 200, { success: true, subject: db.subject, message: 'Subject details updated successfully.' });
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
          if (user && !hasFacultyAccess(user)) {
            const studentProg = computeStudentProgress(user.id);
            const myTopicProg = studentProg.find(p => p.topicId === topicId);
            if (myTopicProg && myTopicProg.isLocked) {
              return sendJson(res, 403, {
                success: false,
                isLocked: true,
                message: 'This topic is locked. You must pass the previous topic quiz with at least 75% to proceed.'
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
              quizSettings: topic.quizSettings || { timeLimitMinutes: 10, maxQuestions: 20, passingPercentage: 75 },
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
        const newOrder = db.topics.length + 1;
        const newTopic = {
          id: 'top_' + Date.now(),
          order: newOrder,
          title: body.title || `Topic ${newOrder}: Numerical Methods Module`,
          lessonText: body.lessonText || '<p>Enter Numerical Methods lecture content here...</p>',
          presentation: {
            title: body.presentationTitle || (body.presentation ? body.presentation.title : ''),
            fileUrl: body.presentationFileUrl || (body.presentation ? body.presentation.fileUrl : ''),
            isUploaded: !!(body.presentationFileUrl || (body.presentation && body.presentation.fileUrl))
          },
          slides: body.slides || [
            { title: `Slide 1: Topic ${newOrder} Overview`, content: "• Core mathematical formulation\n• Algorithm steps\n• Numerical error analysis" }
          ],
          summary: body.summary || '<p>Summary of algorithms, convergence criteria, and formulas.</p>',
          quizSettings: body.quizSettings || {
            timeLimitMinutes: 10,
            maxQuestions: 20,
            passingPercentage: 75
          },
          quizQuestions: Array.isArray(body.quizQuestions) ? body.quizQuestions : []
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
        const body = await parseBody(req);
        if (!body.filename || !body.dataBase64) {
          return sendJson(res, 400, { success: false, message: 'Missing filename or file data.' });
        }

        const safeFilename = Date.now() + '_' + path.basename(body.filename).replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = path.join(UPLOADS_DIR, safeFilename);
        const buffer = Buffer.from(body.dataBase64, 'base64');
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
          if (user && !hasFacultyAccess(user)) {
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
              quizSettings: topic.quizSettings || { timeLimitMinutes: 10, maxQuestions: 20, passingPercentage: 75 },
              questions: sanitizedQuestions,
              totalQuestions: sanitizedQuestions.length,
              previousAttemptsCount: studentSubs.length,
              latestAttempt: latestSub
            });
          }

          return sendJson(res, 200, {
            success: true,
            topicTitle: topic.title,
            quizSettings: topic.quizSettings || { timeLimitMinutes: 10, maxQuestions: 20, passingPercentage: 75 },
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
            topic.quizSettings = {
              timeLimitMinutes: Number(body.quizSettings.timeLimitMinutes) || 10,
              maxQuestions: Number(body.quizSettings.maxQuestions) || 20,
              passingPercentage: Number(body.quizSettings.passingPercentage) || 75
            };
          }
          if (Array.isArray(body.questions)) {
            topic.quizQuestions = body.questions;
          }
          saveDB();
          return sendJson(res, 200, { success: true, message: 'Quiz saved successfully.', topic });
        }
      }

      // 10. Bulk Import Quiz Questions
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

        if (Array.isArray(body.questions)) {
          importedQuestions = body.questions;
        } else if (typeof body.rawText === 'string') {
          const lines = body.rawText.split('\n').map(l => l.trim()).filter(Boolean);
          let currentQ = null;

          for (const line of lines) {
            if (/^\d+[\.\)]\s*(.*)/.test(line)) {
              if (currentQ && currentQ.question && currentQ.options.length >= 2) {
                importedQuestions.push(currentQ);
              }
              const match = line.match(/^\d+[\.\)]\s*(.*)/);
              currentQ = {
                id: 'q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                question: match[1],
                options: [],
                correctAnswer: 0,
                explanation: ''
              };
            } else if (/^[a-dA-D][\.\)]\s*(.*)/.test(line) && currentQ) {
              const optMatch = line.match(/^([a-dA-D])[\.\)]\s*(.*)/);
              currentQ.options.push(optMatch[2]);
            } else if (/^Answer:\s*([a-dA-D]|\d+)/i.test(line) && currentQ) {
              const ansMatch = line.match(/^Answer:\s*([a-dA-D]|\d+)/i);
              const val = ansMatch[1];
              if (isNaN(val)) {
                currentQ.correctAnswer = val.toUpperCase().charCodeAt(0) - 65;
              } else {
                currentQ.correctAnswer = parseInt(val, 10);
              }
            }
          }
          if (currentQ && currentQ.question && currentQ.options.length >= 2) {
            importedQuestions.push(currentQ);
          }
        }

        if (importedQuestions.length === 0) {
          return sendJson(res, 400, { success: false, message: 'No valid questions found to import. Check format.' });
        }

        if (body.mode === 'replace') {
          topic.quizQuestions = importedQuestions;
        } else {
          topic.quizQuestions = (topic.quizQuestions || []).concat(importedQuestions);
        }
        saveDB();

        return sendJson(res, 200, {
          success: true,
          message: `Successfully imported ${importedQuestions.length} questions.`,
          count: topic.quizQuestions.length
        });
      }

      // 11. Student Quiz Submission & Progression Gating (75% Threshold)
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

        const body = await parseBody(req);
        const studentAnswers = body.answers || {};

        let score = 0;
        const total = (topic.quizQuestions || []).length;
        const itemResults = [];

        for (const q of (topic.quizQuestions || [])) {
          const selected = studentAnswers[q.id];
          const isCorrect = (selected !== undefined && selected !== null && Number(selected) === q.correctAnswer);
          if (isCorrect) score++;

          itemResults.push({
            questionId: q.id,
            question: q.question,
            options: q.options,
            selectedAnswer: selected !== undefined ? Number(selected) : null,
            correctAnswer: q.correctAnswer,
            isCorrect,
            explanation: q.explanation || ''
          });
        }

        const passingThreshold = (topic.quizSettings && topic.quizSettings.passingPercentage) || 75;
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
          submittedAt: new Date().toISOString(),
          answers: studentAnswers
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
            : `FAILED QUIZ - You scored ${percentage}% (Passing is ${passingThreshold}%). You CANNOT proceed to the next topic. Please repeat and review ${topic.title} before retaking the quiz.`,
          itemResults
        });
      }

      // 12. Topic Quiz Summary & Reports
      // Supports: sorted by surname, sorted by score, CSV export
      const topicReportMatch = pathname.match(/^\/api\/reports\/topic\/([^\/]+)$/);
      if (topicReportMatch && method === 'GET') {
        const topicId = topicReportMatch[1];
        const topic = db.topics.find(t => t.id === topicId);
        if (!topic) {
          return sendJson(res, 404, { success: false, message: 'Topic not found.' });
        }

        const sortBy = parsedUrl.query.sort || 'surname';
        const order = parsedUrl.query.order || 'asc';

        const students = db.users.filter(u => u.role === 'student');
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
              passed: bestSub.passed,
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
          csv += `Passing Score: ${topic.quizSettings?.passingPercentage || 75}%\r\n`;
          csv += `Generated On: "${new Date().toLocaleString()}"\r\n\r\n`;
          csv += `Student ID,Surname,First Name,Score,Total Items,Percentage,Status,Attempts,Last Submitted\r\n`;

          for (const r of rows) {
            const statusStr = r.notTaken ? 'NOT TAKEN' : (r.passed ? 'PASSED' : 'FAILED');
            const dateStr = r.latestSubmittedAt ? new Date(r.latestSubmittedAt).toLocaleDateString() : 'N/A';
            csv += `"${r.idNumber}","${r.lastName}","${r.firstName}",${r.score},${r.totalQuestions},"${r.percentage}%","${statusStr}",${r.attempts},"${dateStr}"\r\n`;
          }

          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=UTF-8',
            'Content-Disposition': `attachment; filename="Numerical_Methods_Quiz_${topic.id}.csv"`
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
            passingPercentage: topic.quizSettings?.passingPercentage || 75
          },
          sortBy,
          order,
          records: rows
        });
      }

      // 13. Master Summary of ALL Quiz Scores per Student
      // Dynamic: Displays all topics that currently exist in the curriculum
      if (pathname === '/api/reports/all' && method === 'GET') {
        const sortedTopics = [...db.topics].sort((a, b) => a.order - b.order);
        const students = db.users.filter(u => u.role === 'student');

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
                passed: best.passed,
                attempts: studentSubs.length
              };
              totalEarned += best.score;
              totalPossible += best.totalQuestions;
              if (!best.passed) passedAll = false;
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
            overallStatus: overallPercentage >= 75 && passedAll ? 'PASSED' : (overallPercentage >= 75 ? 'IN PROGRESS' : 'NEEDS RETAKE')
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
          header += `,Total Earned,Total Items,Overall %,Overall Standing\r\n`;
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
            row += `,${s.totalEarned},${s.totalPossible},"${s.overallPercentage}%","${s.overallStatus}"\r\n`;
            csv += row;
          }

          res.writeHead(200, {
            'Content-Type': 'text/csv; charset=UTF-8',
            'Content-Disposition': `attachment; filename="Numerical_Methods_Master_Gradebook.csv"`
          });
          return res.end(csv);
        }

        return sendJson(res, 200, {
          success: true,
          subject: db.subject,
          topics: sortedTopics.map(t => ({ id: t.id, order: t.order, title: t.title })),
          students: studentRows
        });
      }

      // 14. Reset Demo Data
      if (pathname === '/api/system/reset' && method === 'POST') {
        db = getInitialDB();
        saveDB();
        return sendJson(res, 200, { success: true, message: 'Numerical Methods database reset to standard default state.' });
      }

      return sendJson(res, 404, { success: false, message: 'API route not found' });
    } catch (err) {
      console.error('API Error:', err);
      return sendJson(res, 500, { success: false, message: 'Server error: ' + err.message });
    }
  }

  // Static File Serving
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

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

// Connect to the local PostgreSQL database before accepting requests.
loadDB().then(() => {
  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`Numerical Methods Portal running on http://localhost:${PORT}`);
    console.log(`Database: PostgreSQL (${DATABASE_URL.replace(/:[^:@/]+@/, ':****@')})`);
    console.log(`Authentication Mode: Student ID (Format: TUPT-23-1096)`);
    console.log(`=======================================================`);
  });
}).catch(err => {
  console.error('Could not initialize PostgreSQL. Check that PostgreSQL is running and DATABASE_URL is correct.', err);
  process.exit(1);
});

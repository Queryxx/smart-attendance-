/* eslint-env node */
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import bodyParser from 'body-parser';
import multer from 'multer';
import pkg from 'pg';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const { Pool } = pkg;
dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Increased limit for face encodings
app.use(bodyParser.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
const uploadsDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database setup
const pool = new Pool();

// Improved database connection handling
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

// Routes
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    console.error('Database health check failed:', err);
    res.status(500).json({ error: 'database_error' });
  }
});
// Register a student with face encoding - ENHANCED DEBUGGING VERSION
app.post('/api/register', async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    console.log('=== REGISTER ENDPOINT HIT ===');
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Request body content:', {
      student_id: req.body.student_id,
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      face_encoding_type: typeof req.body.face_encoding,
      face_encoding_is_array: Array.isArray(req.body.face_encoding),
      face_encoding_length: req.body.face_encoding ? req.body.face_encoding.length : 'none'
    });

    const { 
      student_id, 
      first_name, 
      last_name, 
      middle_name, 
      course, 
      year_level, 
      section, 
      email, 
      face_encoding 
    } = req.body;

    // Normalize face_encoding: accept array or JSON string
    let normalizedFaceEncoding = face_encoding;
    if (typeof normalizedFaceEncoding === 'string') {
      try {
        const parsed = JSON.parse(normalizedFaceEncoding);
        normalizedFaceEncoding = parsed;
      } catch (e) {
        console.log('❌ face_encoding string is not valid JSON');
        return res.status(400).json({ error: 'face_encoding must be a JSON array' });
      }
    }

    // Enhanced validation with detailed logging
    console.log('Validating fields...');
    console.log('student_id:', student_id, 'type:', typeof student_id);
    console.log('first_name:', first_name, 'type:', typeof first_name);
    console.log('last_name:', last_name, 'type:', typeof last_name);
    console.log('face_encoding:', face_encoding ? `Array(${face_encoding.length})` : 'missing', 'type:', typeof face_encoding);

    if (!student_id) {
      console.log('❌ Validation failed: student_id missing');
      return res.status(400).json({ 
        error: 'student_id is required' 
      });
    }
    if (!first_name) {
      console.log('❌ Validation failed: first_name missing');
      return res.status(400).json({ 
        error: 'first_name is required' 
      });
    }
    if (!last_name) {
      console.log('❌ Validation failed: last_name missing');
      return res.status(400).json({ 
        error: 'last_name is required' 
      });
    }
    if (!normalizedFaceEncoding) {
      console.log('❌ Validation failed: face_encoding missing');
      return res.status(400).json({ 
        error: 'face_encoding is required' 
      });
    }
    if (!Array.isArray(normalizedFaceEncoding)) {
      console.log('❌ Validation failed: face_encoding is not an array');
      return res.status(400).json({ 
        error: 'face_encoding must be an array' 
      });
    }
    if (normalizedFaceEncoding.length === 0) {
      console.log('❌ Validation failed: face_encoding array is empty');
      return res.status(400).json({ 
        error: 'face_encoding array cannot be empty' 
      });
    }
    // Ensure numeric values
    if (!normalizedFaceEncoding.every((v) => typeof v === 'number')) {
      console.log('❌ Validation failed: face_encoding contains non-number values');
      return res.status(400).json({ error: 'face_encoding values must be numbers' });
    }

    console.log('✅ All validations passed');

    await client.query('BEGIN');
    
    // Test database connection first
    console.log('Testing database connection...');
    const testResult = await client.query('SELECT NOW()');
    console.log('Database connection OK:', testResult.rows[0]);
    
    // Insert student data
    console.log('Inserting into database...');
    // Ensure JSONB receives valid JSON string from driver
    const faceEncodingJson = JSON.stringify(normalizedFaceEncoding);

    const result = await client.query(
      `INSERT INTO students (
        student_id, first_name, last_name, middle_name,
        course, year_level, section, email, face_encoding
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CAST($9 AS JSONB))
      ON CONFLICT (student_id)
      DO UPDATE SET
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        middle_name = EXCLUDED.middle_name,
        course = EXCLUDED.course,
        year_level = EXCLUDED.year_level,
        section = EXCLUDED.section,
        email = EXCLUDED.email,
        face_encoding = EXCLUDED.face_encoding
      RETURNING id, student_id`,
      [
        student_id,
        first_name,
        last_name,
        middle_name || null,
        course || null,
        year_level || null,
        section || null,
        email || null,
        faceEncodingJson
      ]
    );

    await client.query('COMMIT');
    
    console.log(`✅ Successfully registered student:`, {
      id: result.rows[0].id,
      student_id: result.rows[0].student_id,
      timestamp: new Date().toISOString()
    });
    
    res.json({ 
      success: true, 
      id: result.rows[0].id, 
      student_id: result.rows[0].student_id 
    });

  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('❌ Registration error:', err);
    console.error('Error details:', {
      message: err.message,
      code: err.code,
      stack: err.stack
    });
    
    // Provide more specific error messages
    if (err.code === '23505') { // Unique violation
      res.status(400).json({ error: 'Student ID already exists' });
    } else {
      res.status(500).json({ error: 'Internal server error: ' + err.message });
    }
  } finally {
    if (client) client.release();
  }
});
// Handle student photo uploads - FIXED VERSION
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Use student ID in filename if available
    const prefix = req.body.student_id || Date.now();
    const extension = file.mimetype.split('/')[1] || 'jpg';
    cb(null, `${prefix}-photo.${extension}`);
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Upload student photo - FIXED VERSION
app.post('/api/upload-photo', upload.single('photo'), async (req, res) => {
  let client;
  try {
    client = await pool.connect();
    const { student_id } = req.body;
    if (!student_id) {
      return res.status(400).json({ error: 'student_id is required' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'photo file is required' });
    }

    const photoPath = req.file.filename;

    // Update student photo path in database
    const result = await client.query(
      'UPDATE students SET photo = $1 WHERE student_id = $2 RETURNING id',
      [photoPath, student_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({ 
      success: true, 
      photo: photoPath,
      message: 'Photo uploaded successfully'
    });
  } catch (err) {
    console.error('Photo upload error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) client.release();
  }
});

// Get students with face encodings for detection
app.get('/api/students', async (_req, res) => {
  let client;
  try {
    client = await pool.connect();
    const result = await client.query(
      `SELECT 
         student_id, first_name, last_name, middle_name,
         course, year_level, section, email, photo, face_encoding
       FROM students
       WHERE status = 'active'`
    );

    const students = result.rows.map((row) => {
      let encoding = row.face_encoding;
      if (typeof encoding === 'string') {
        try { encoding = JSON.parse(encoding); } catch { encoding = []; }
      }
      if (!Array.isArray(encoding)) {
        encoding = [];
      }
      return {
        student_id: row.student_id,
        first_name: row.first_name,
        last_name: row.last_name,
        middle_name: row.middle_name,
        course: row.course,
        year_level: row.year_level,
        section: row.section,
        email: row.email,
        photo: row.photo,
        face_encoding: encoding
      };
    }).filter((s) => Array.isArray(s.face_encoding) && s.face_encoding.length === 128);

    res.json({ success: true, students });
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// Record attendance (time in/out)
app.post('/api/attendance', async (req, res) => {
  const { student_id, type } = req.body;
  if (!student_id || !type || !['in', 'out'].includes(type)) {
    return res.status(400).json({ error: 'student_id and type (in|out) required' });
  }

  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');

    // Resolve internal student primary key
    const s = await client.query('SELECT id FROM students WHERE student_id = $1', [student_id]);
    if (s.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'student_not_found' });
    }
    const internalId = s.rows[0].id;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

    const existing = await client.query(
      'SELECT id, time_in, time_out FROM attendance WHERE student_id = $1 AND date = $2',
      [internalId, dateStr]
    );

    if (existing.rows.length === 0) {
      // Create new attendance row
      const cols = ['student_id', 'date'];
      const vals = [internalId, dateStr];
      if (type === 'in') {
        cols.push('time_in');
        vals.push(timeStr);
      } else {
        cols.push('time_out');
        vals.push(timeStr);
      }
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      await client.query(
        `INSERT INTO attendance (${cols.join(', ')}) VALUES (${placeholders})`,
        vals
      );
    } else {
      // Update existing row
      const row = existing.rows[0];
      if (type === 'in' && !row.time_in) {
        await client.query(
          'UPDATE attendance SET time_in = $1 WHERE id = $2',
          [timeStr, row.id]
        );
      } else if (type === 'out' && !row.time_out) {
        await client.query(
          'UPDATE attendance SET time_out = $1 WHERE id = $2',
          [timeStr, row.id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('Error recording attendance:', err);
    res.status(500).json({ error: 'internal_error' });
  } finally {
    if (client) client.release();
  }
});

// Get attendance report
app.get('/api/attendance-report', async (req, res) => {
  try {
    const { start_date, end_date, student_id } = req.query;
    
    let query = `
      SELECT 
        s.student_id,
        s.first_name,
        s.last_name,
        a.date,
        a.time_in,
        a.time_out,
        a.status,
        a.remarks
      FROM attendance a
      JOIN students s ON s.id = a.student_id
      WHERE a.date BETWEEN $1 AND $2
    `;
    
    const params = [start_date || new Date().toISOString().split('T')[0], end_date || new Date().toISOString().split('T')[0]];
    
    if (student_id) {
      query += ' AND s.student_id = $3';
      params.push(student_id);
    }
    
    query += ' ORDER BY a.date DESC, s.last_name, s.first_name';
    
    const result = await pool.query(query, params);
    
    res.json({ 
      success: true, 
      attendance: result.rows 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});

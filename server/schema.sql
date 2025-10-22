-- =========================
-- TABLE: students
-- =========================
CREATE TABLE students (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100),
    course VARCHAR(100),
    year_level VARCHAR(20),
    section VARCHAR(50),
    email VARCHAR(150),
    photo VARCHAR(255),
    face_encoding JSONB, -- Store facial embeddings as JSON array
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- =========================
-- TABLE: attendance
-- =========================
CREATE TABLE attendance (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    time_in TIME,
    time_out TIME,
    status VARCHAR(20) DEFAULT 'present' CHECK (status IN ('present', 'late', 'absent')),
    remarks TEXT
);

-- Optional index to speed up attendance lookups
CREATE INDEX idx_attendance_student_date ON attendance (student_id, date);
/* 
-- =========================
-- TABLE: subjects (optional)
-- =========================
CREATE TABLE subjects (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_code VARCHAR(50) UNIQUE NOT NULL,
    subject_name VARCHAR(100) NOT NULL,
    teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
    schedule_time VARCHAR(100)
);

-- =========================
-- TABLE: teachers (optional)
-- =========================
CREATE TABLE teachers (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);
 */
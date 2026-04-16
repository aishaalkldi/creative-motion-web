import logging

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import psycopg2

from config import check_db_connection, get_connection, settings, settings_load_error

logger = logging.getLogger(__name__)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def init_db():
    try:
        conn = get_connection()
    except ConnectionError as e:
        raise RuntimeError(
            "Database schema initialization could not open a connection. " + str(e)
        ) from e

    try:
        cursor = conn.cursor()

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS patients (
            id SERIAL PRIMARY KEY,
            patient_code TEXT NOT NULL,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            age TEXT,
            gender TEXT,
            diagnosis TEXT NOT NULL,
            condition TEXT,
            status TEXT NOT NULL
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS results (
            id SERIAL PRIMARY KEY,
            patient_id TEXT NOT NULL,
            test TEXT NOT NULL,
            score REAL NOT NULL
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS assessments (
            id SERIAL PRIMARY KEY,
            patient_code TEXT NOT NULL,
            assessment_id TEXT NOT NULL,
            test_type TEXT NOT NULL,
            score REAL NOT NULL,
            summary TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        """)

        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_assessments_patient_code ON assessments (patient_code);"
        )

        conn.commit()
    except psycopg2.Error as e:
        conn.rollback()
        raise RuntimeError(
            "Database schema initialization failed while applying DDL. "
            "Review the SQL migration statements and database permissions. "
            f"Details: {e}"
        ) from e
    finally:
        conn.close()


db_init_ok = False
db_init_error: str | None = None

if settings is not None:
    try:
        init_db()
        db_init_ok = True
    except (RuntimeError, ConnectionError) as e:
        db_init_error = str(e)
        logger.error("Database schema initialization failed.", exc_info=True)
    except Exception as e:
        db_init_error = str(e)
        logger.error("Database schema initialization failed with an unexpected error.", exc_info=True)
else:
    logger.warning(
        "Database schema initialization was skipped: %s",
        settings_load_error or "DATABASE_URL is not configured.",
    )


@app.get("/health")
def health():
    """Liveness and database readiness-style signal for operators and probes."""
    configured = settings is not None
    connected = False
    connect_err: str | None = None
    if configured:
        connected, connect_err = check_db_connection(settings.database_url)

    all_ok = configured and connected and db_init_ok
    body: dict = {
        "status": "ok" if all_ok else "degraded",
        "app": "creative-motion-backend",
        "database_url_configured": configured,
        "database_connected": connected if configured else False,
        "database_initialized": db_init_ok,
    }
    if settings_load_error and not configured:
        body["configuration_error"] = settings_load_error
    if connect_err:
        body["database_error"] = connect_err
    if db_init_error:
        body["database_init_error"] = db_init_error
    return body


@app.get("/")
def root():
    return {"message": "Creative Motion Backend Running on PostgreSQL 🚀"}

class Result(BaseModel):
    patient_id: str
    test: str
    score: float

class Patient(BaseModel):
    patient_code: str
    name: str
    phone: str
    age: str | None = ""
    gender: str | None = ""
    diagnosis: str
    condition: str | None = ""
    status: str = "Active"


class AssessmentCreate(BaseModel):
    patient_code: str
    assessment_id: str
    test_type: str
    score: float
    summary: str = ""


@app.post("/results")
def save_result(result: Result):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO results (patient_id, test, score) VALUES (%s, %s, %s)",
        (result.patient_id, result.test, result.score)
    )

    conn.commit()
    conn.close()

    return {
        "status": "saved_to_postgresql",
        "data": result.dict()
    }

@app.get("/results")
def get_results():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, patient_id, test, score
        FROM results
        ORDER BY id DESC
    """)
    rows = cursor.fetchall()

    conn.close()

    return [
        {
            "id": row[0],
            "patient_id": row[1],
            "test": row[2],
            "score": float(row[3]),
        }
        for row in rows
    ]

@app.get("/results/{patient_id}")
def get_results_by_patient(patient_id: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, patient_id, test, score
        FROM results
        WHERE patient_id = %s
        ORDER BY id DESC
    """, (patient_id,))
    rows = cursor.fetchall()

    conn.close()

    return [
        {
            "id": row[0],
            "patient_id": row[1],
            "test": row[2],
            "score": float(row[3]),
        }
        for row in rows
    ]

@app.post("/patients")
def save_patient(patient: Patient):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO patients (
            patient_code, name, phone, age, gender, diagnosis, condition, status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            patient.patient_code,
            patient.name,
            patient.phone,
            patient.age,
            patient.gender,
            patient.diagnosis,
            patient.condition,
            patient.status
        )
    )

    conn.commit()
    conn.close()

    return {
        "status": "patient_saved_to_postgresql",
        "data": patient.dict()
    }

@app.get("/patients")
def get_patients():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, patient_code, name, phone, age, gender, diagnosis, condition, status
        FROM patients
        ORDER BY id DESC
    """)
    rows = cursor.fetchall()

    conn.close()

    return [
        {
            "id": row[0],
            "patient_code": row[1],
            "name": row[2],
            "phone": row[3],
            "age": row[4] or "",
            "gender": row[5] or "",
            "diagnosis": row[6],
            "condition": row[7] or "",
            "status": row[8],
        }
        for row in rows
    ]

@app.get("/patients/{patient_code}")
def get_patient_by_code(patient_code: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, patient_code, name, phone, age, gender, diagnosis, condition, status
        FROM patients
        WHERE patient_code = %s
    """, (patient_code,))
    row = cursor.fetchone()

    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")

    return {
        "id": row[0],
        "patient_code": row[1],
        "name": row[2],
        "phone": row[3],
        "age": row[4] or "",
        "gender": row[5] or "",
        "diagnosis": row[6],
        "condition": row[7] or "",
        "status": row[8],
    }


@app.post("/assessments")
def save_assessment(assessment: AssessmentCreate):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO assessments (
            patient_code, assessment_id, test_type, score, summary
        ) VALUES (%s, %s, %s, %s, %s)
        """,
        (
            assessment.patient_code.strip(),
            assessment.assessment_id.strip(),
            assessment.test_type.strip(),
            assessment.score,
            assessment.summary or "",
        ),
    )

    conn.commit()
    conn.close()

    return {"status": "assessment_saved", "data": assessment.dict()}


@app.get("/patients/{patient_code}/assessments")
def list_patient_assessments(patient_code: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, patient_code, assessment_id, test_type, score, summary, created_at
        FROM assessments
        WHERE patient_code = %s
        ORDER BY created_at DESC, id DESC
        """,
        (patient_code.strip(),),
    )
    rows = cursor.fetchall()
    conn.close()

    return [
        {
            "id": row[0],
            "patient_code": row[1],
            "assessment_id": row[2],
            "test_type": row[3],
            "score": float(row[4]),
            "summary": row[5] or "",
            "created_at": row[6].isoformat() if row[6] else "",
        }
        for row in rows
    ]


@app.delete("/cleanup/patients")
def cleanup_fake_patients():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        DELETE FROM patients
        WHERE patient_code = 'string'
           OR name = 'string'
           OR phone = 'string'
    """)

    deleted_count = cursor.rowcount

    conn.commit()
    conn.close()

    return {
        "status": "cleanup_done",
        "deleted_patients": deleted_count
    }
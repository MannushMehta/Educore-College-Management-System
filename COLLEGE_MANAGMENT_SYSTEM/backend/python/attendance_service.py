#!/usr/bin/env python3
"""
attendance_service.py
─────────────────────
Python micro-service for advanced attendance analytics and reporting.

Endpoints  (run with: uvicorn attendance_service:app --port 8001 --reload)
  GET  /health
  GET  /attendance/low-attendance?threshold=75&semester_id=1
  GET  /attendance/monthly-trend?course_id=1&year=2024
  POST /attendance/bulk-import        body: JSON array of {roll_number, course_code, date, status}
  GET  /attendance/export/csv?course_id=1
  GET  /attendance/heatmap?course_id=1
"""

import os
import csv
import io
from datetime import date, datetime, timedelta
from typing import Optional

import mysql.connector
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, validator

# ── Config ────────────────────────────────────────────────────
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASS", ""),
    "database": os.getenv("DB_NAME", "college_cms"),
    "charset": "utf8mb4",
}

app = FastAPI(
    title="EduCore Attendance Service",
    description="Analytics microservice for the College Management System",
    version="1.0.0",
)

# ── DB helper ─────────────────────────────────────────────────
def get_db():
    conn = mysql.connector.connect(**DB_CONFIG)
    return conn


def query(sql: str, params: tuple = (), fetchall: bool = True):
    conn = get_db()
    cur = conn.cursor(dictionary=True)
    cur.execute(sql, params)
    result = cur.fetchall() if fetchall else cur.fetchone()
    conn.close()
    return result


# ── Health ────────────────────────────────────────────────────
@app.get("/health")
def health():
    try:
        query("SELECT 1", fetchall=False)
        return {"status": "ok", "db": "connected", "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


# ── Low Attendance Alert ──────────────────────────────────────
@app.get("/attendance/low-attendance")
def low_attendance(
    threshold: float = Query(75.0, ge=0, le=100),
    semester_id: Optional[int] = Query(None),
    department_id: Optional[int] = Query(None),
):
    """
    Return all students whose attendance percentage in any enrolled course
    falls below the given threshold.
    """
    sql = """
        SELECT
            s.id          AS student_id,
            s.roll_number,
            u.full_name,
            u.email,
            d.name        AS department,
            c.id          AS course_id,
            c.code        AS course_code,
            c.title       AS course_title,
            COUNT(a.id)   AS total_classes,
            SUM(a.status IN ('present','late')) AS attended,
            ROUND(SUM(a.status IN ('present','late')) / COUNT(a.id) * 100, 1) AS attendance_pct
        FROM enrollments e
        JOIN students  s ON e.student_id  = s.id
        JOIN users     u ON s.user_id     = u.id
        LEFT JOIN departments d ON s.department_id = d.id
        JOIN courses   c ON e.course_id   = c.id
        LEFT JOIN attendance a ON a.student_id = s.id AND a.course_id = c.id
        WHERE COUNT(a.id) > 0
    """
    args = []
    if semester_id:
        sql += " AND e.semester_id = %s"
        args.append(semester_id)
    if department_id:
        sql += " AND s.department_id = %s"
        args.append(department_id)

    sql += """
        GROUP BY s.id, c.id
        HAVING attendance_pct < %s
        ORDER BY attendance_pct ASC, u.full_name
    """
    args.append(threshold)

    rows = query(sql, tuple(args))
    return {
        "threshold": threshold,
        "count": len(rows),
        "students": rows,
    }


# ── Monthly Trend ─────────────────────────────────────────────
@app.get("/attendance/monthly-trend")
def monthly_trend(
    course_id: int = Query(...),
    year: int = Query(date.today().year),
):
    """
    Return month-by-month attendance percentage for a course in a given year.
    """
    sql = """
        SELECT
            DATE_FORMAT(a.date, '%Y-%m')             AS month,
            COUNT(a.id)                               AS total_records,
            SUM(a.status IN ('present','late'))       AS attended,
            ROUND(SUM(a.status IN ('present','late'))
                  / COUNT(a.id) * 100, 1)             AS avg_pct
        FROM attendance a
        WHERE a.course_id = %s
          AND YEAR(a.date) = %s
        GROUP BY month
        ORDER BY month
    """
    rows = query(sql, (course_id, year))

    # Fill months with no data
    all_months = {}
    for m in range(1, 13):
        key = f"{year}-{m:02d}"
        all_months[key] = {"month": key, "total_records": 0, "attended": 0, "avg_pct": None}
    for r in rows:
        all_months[r["month"]] = r

    return {
        "course_id": course_id,
        "year": year,
        "trend": list(all_months.values()),
    }


# ── Attendance Heatmap ────────────────────────────────────────
@app.get("/attendance/heatmap")
def attendance_heatmap(
    course_id: int = Query(...),
    weeks: int = Query(12, ge=1, le=52),
):
    """
    Return a day-level heatmap for the last N weeks for a course.
    Useful for rendering a GitHub-style contribution graph on the frontend.
    """
    end_date   = date.today()
    start_date = end_date - timedelta(weeks=weeks)

    sql = """
        SELECT
            a.date,
            COUNT(*)                               AS total,
            SUM(a.status = 'present')              AS present_count,
            SUM(a.status = 'late')                 AS late_count,
            SUM(a.status = 'absent')               AS absent_count,
            ROUND(SUM(a.status IN ('present','late')) / COUNT(*) * 100, 1) AS pct
        FROM attendance a
        WHERE a.course_id = %s
          AND a.date BETWEEN %s AND %s
        GROUP BY a.date
        ORDER BY a.date
    """
    rows = query(sql, (course_id, start_date.isoformat(), end_date.isoformat()))

    # Convert dates to strings
    for r in rows:
        if isinstance(r["date"], (date, datetime)):
            r["date"] = r["date"].isoformat()

    return {
        "course_id": course_id,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "heatmap": rows,
    }


# ── Bulk Import ───────────────────────────────────────────────
class AttendanceRecord(BaseModel):
    roll_number: str
    course_code: str
    date: str          # YYYY-MM-DD
    status: str        # present | absent | late

    @validator("status")
    def validate_status(cls, v):
        if v not in ("present", "absent", "late"):
            raise ValueError("status must be present, absent, or late")
        return v

    @validator("date")
    def validate_date(cls, v):
        datetime.strptime(v, "%Y-%m-%d")
        return v


@app.post("/attendance/bulk-import")
def bulk_import(records: list[AttendanceRecord]):
    """
    Import attendance records from an external CSV export or data migration.
    Accepts a JSON array; resolves roll_number → student_id and
    course_code → course_id, then upserts.
    """
    if not records:
        raise HTTPException(status_code=400, detail="Empty records list")

    conn = get_db()
    cur  = conn.cursor(dictionary=True)

    inserted = updated = skipped = 0
    errors   = []

    for idx, rec in enumerate(records):
        # Resolve roll_number → student_id
        cur.execute("SELECT id FROM students WHERE roll_number = %s LIMIT 1", (rec.roll_number,))
        stu = cur.fetchone()
        if not stu:
            errors.append({"row": idx, "error": f"Unknown roll_number: {rec.roll_number}"})
            skipped += 1
            continue

        # Resolve course_code → course_id
        cur.execute("SELECT id FROM courses WHERE code = %s LIMIT 1", (rec.course_code,))
        crs = cur.fetchone()
        if not crs:
            errors.append({"row": idx, "error": f"Unknown course_code: {rec.course_code}"})
            skipped += 1
            continue

        upsert_sql = """
            INSERT INTO attendance (student_id, course_id, date, status)
            VALUES (%s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE status = VALUES(status)
        """
        cur.execute(upsert_sql, (stu["id"], crs["id"], rec.date, rec.status))
        if cur.rowcount == 1:
            inserted += 1
        else:
            updated += 1

    conn.commit()
    conn.close()

    return {
        "inserted": inserted,
        "updated":  updated,
        "skipped":  skipped,
        "errors":   errors,
    }


# ── Export CSV ────────────────────────────────────────────────
@app.get("/attendance/export/csv")
def export_csv(course_id: int = Query(...)):
    """
    Stream a CSV file of all attendance records for a course.
    """
    rows = query(
        """
        SELECT
            s.roll_number,
            u.full_name,
            c.code  AS course_code,
            c.title AS course_title,
            a.date,
            a.status
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        JOIN users    u ON s.user_id    = u.id
        JOIN courses  c ON a.course_id  = c.id
        WHERE a.course_id = %s
        ORDER BY a.date, u.full_name
        """,
        (course_id,),
    )

    output = io.StringIO()
    writer = csv.DictWriter(
        output,
        fieldnames=["roll_number", "full_name", "course_code",
                    "course_title", "date", "status"],
    )
    writer.writeheader()
    for r in rows:
        if isinstance(r.get("date"), (date, datetime)):
            r["date"] = r["date"].isoformat()
        writer.writerow(r)

    output.seek(0)
    filename = f"attendance_course_{course_id}_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.read()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Run directly ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("attendance_service:app", host="0.0.0.0", port=8001, reload=True)

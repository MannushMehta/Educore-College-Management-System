#!/usr/bin/env python3
"""
grade_processing.py
────────────────────
Python micro-service for grade analytics, GPA computation, and reporting.

Endpoints (run with: uvicorn grade_processing:app --port 8002 --reload)
  GET  /health
  GET  /grades/course-stats?course_id=1&semester_id=1
  GET  /grades/semester-report?semester_id=1
  GET  /grades/student-transcript?student_id=1
  GET  /grades/topper-list?course_id=1&semester_id=1&top_n=10
  GET  /grades/export/csv?course_id=1&semester_id=1
  POST /grades/recalculate          recalculate letter grades + CGPA for a semester
"""

import os
import csv
import io
import statistics
from datetime import date, datetime
from typing import Optional

import mysql.connector
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse

# ── Config ────────────────────────────────────────────────────
DB_CONFIG = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASS", ""),
    "database": os.getenv("DB_NAME", "college_cms"),
    "charset": "utf8mb4",
}

app = FastAPI(
    title="EduCore Grade Processing Service",
    description="Analytics and transcript microservice for the College Management System",
    version="1.0.0",
)

# ── Grading scale ─────────────────────────────────────────────
GRADE_SCALE = [
    (90, "O",  10.0),
    (80, "A+",  9.0),
    (70, "A",   8.0),
    (60, "B+",  7.0),
    (50, "B",   6.0),
    (40, "C",   5.0),
    ( 0, "F",   0.0),
]

def total_to_grade(total: Optional[float]) -> tuple[str, float]:
    """Return (letter, grade_point) for a given total marks."""
    if total is None:
        return ("N/A", 0.0)
    for threshold, letter, points in GRADE_SCALE:
        if total >= threshold:
            return (letter, points)
    return ("F", 0.0)


# ── DB helpers ────────────────────────────────────────────────
def get_db():
    return mysql.connector.connect(**DB_CONFIG)


def query(sql: str, params: tuple = (), fetchall: bool = True):
    conn = get_db()
    cur  = conn.cursor(dictionary=True)
    cur.execute(sql, params)
    result = cur.fetchall() if fetchall else cur.fetchone()
    conn.close()
    return result


# ── Health ────────────────────────────────────────────────────
@app.get("/health")
def health():
    try:
        query("SELECT 1", fetchall=False)
        return {"status": "ok", "service": "grade_processing",
                "timestamp": datetime.utcnow().isoformat()}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


# ── Course Statistics ─────────────────────────────────────────
@app.get("/grades/course-stats")
def course_stats(
    course_id: int = Query(...),
    semester_id: Optional[int] = Query(None),
):
    """
    Compute mean, median, std-dev, pass/fail rate, and grade distribution
    for a single course.
    """
    sql = """
        SELECT g.total_marks, g.grade
        FROM grades g
        WHERE g.course_id = %s
    """
    args = [course_id]
    if semester_id:
        sql += " AND g.semester_id = %s"
        args.append(semester_id)

    rows = query(sql, tuple(args))
    if not rows:
        return {"course_id": course_id, "count": 0, "message": "No grades found"}

    totals = [float(r["total_marks"]) for r in rows if r["total_marks"] is not None]
    grades = [r["grade"] for r in rows]

    dist = {}
    for g in grades:
        dist[g] = dist.get(g, 0) + 1

    return {
        "course_id":   course_id,
        "count":       len(totals),
        "mean":        round(statistics.mean(totals), 2) if totals else None,
        "median":      round(statistics.median(totals), 2) if totals else None,
        "std_dev":     round(statistics.stdev(totals), 2) if len(totals) > 1 else 0,
        "min":         round(min(totals), 2) if totals else None,
        "max":         round(max(totals), 2) if totals else None,
        "pass_rate":   round(sum(1 for g in grades if g != "F") / len(grades) * 100, 1),
        "fail_rate":   round(sum(1 for g in grades if g == "F") / len(grades) * 100, 1),
        "distinction_rate": round(
            sum(1 for g in grades if g in ("O", "A+", "A")) / len(grades) * 100, 1
        ),
        "grade_distribution": dist,
    }


# ── Semester Report ───────────────────────────────────────────
@app.get("/grades/semester-report")
def semester_report(semester_id: int = Query(...)):
    """
    Per-course statistics for an entire semester.
    """
    sql = """
        SELECT c.id AS course_id, c.code, c.title,
               COUNT(g.id) AS graded_students
        FROM courses c
        LEFT JOIN grades g ON g.course_id = c.id AND g.semester_id = %s
        GROUP BY c.id
        ORDER BY c.title
    """
    courses = query(sql, (semester_id,))

    report = []
    for crs in courses:
        stats = course_stats.__wrapped__(crs["course_id"], semester_id) \
                if hasattr(course_stats, "__wrapped__") \
                else _compute_course_stats(crs["course_id"], semester_id)
        report.append({**crs, **stats})

    return {"semester_id": semester_id, "courses": report}


def _compute_course_stats(course_id: int, semester_id: Optional[int]):
    sql = "SELECT total_marks, grade FROM grades WHERE course_id = %s"
    args = [course_id]
    if semester_id:
        sql += " AND semester_id = %s"
        args.append(semester_id)
    rows = query(sql, tuple(args))
    if not rows:
        return {"count": 0}
    totals = [float(r["total_marks"]) for r in rows if r["total_marks"] is not None]
    grades = [r["grade"] for r in rows]
    dist   = {}
    for g in grades:
        dist[g] = dist.get(g, 0) + 1
    return {
        "count":     len(totals),
        "mean":      round(statistics.mean(totals), 2) if totals else None,
        "pass_rate": round(sum(1 for g in grades if g != "F") / len(grades) * 100, 1),
        "grade_distribution": dist,
    }


# ── Student Transcript ────────────────────────────────────────
@app.get("/grades/student-transcript")
def student_transcript(student_id: int = Query(...)):
    """
    Full academic transcript: all grades grouped by semester, with SGPA and CGPA.
    """
    rows = query(
        """
        SELECT
            g.semester_id, sm.name AS semester_name, sm.start_date,
            c.code, c.title, c.credits,
            g.internal_marks, g.external_marks, g.total_marks, g.grade
        FROM grades g
        JOIN courses   c  ON g.course_id   = c.id
        JOIN semesters sm ON g.semester_id = sm.id
        WHERE g.student_id = %s
        ORDER BY sm.start_date, c.title
        """,
        (student_id,),
    )

    # Group by semester
    semesters: dict[int, dict] = {}
    for r in rows:
        sid = r["semester_id"]
        if sid not in semesters:
            semesters[sid] = {
                "semester_id":   sid,
                "semester_name": r["semester_name"],
                "courses":       [],
                "sgpa":          0.0,
                "total_credits": 0,
            }
        letter, gp = total_to_grade(
            float(r["total_marks"]) if r["total_marks"] is not None else None
        )
        semesters[sid]["courses"].append({
            "code":           r["code"],
            "title":          r["title"],
            "credits":        r["credits"],
            "internal":       r["internal_marks"],
            "external":       r["external_marks"],
            "total":          r["total_marks"],
            "grade":          r["grade"] or letter,
            "grade_point":    gp,
        })

    # Calculate SGPA per semester
    for sem in semesters.values():
        total_credits  = sum(c["credits"] for c in sem["courses"])
        weighted_sum   = sum(c["credits"] * c["grade_point"] for c in sem["courses"])
        sem["total_credits"] = total_credits
        sem["sgpa"] = round(weighted_sum / total_credits, 2) if total_credits else 0.0

    # CGPA across all semesters
    all_credits  = sum(s["total_credits"] for s in semesters.values())
    weighted_all = sum(
        sum(c["credits"] * c["grade_point"] for c in s["courses"])
        for s in semesters.values()
    )
    cgpa = round(weighted_all / all_credits, 2) if all_credits else 0.0

    return {
        "student_id": student_id,
        "cgpa":       cgpa,
        "semesters":  list(semesters.values()),
    }


# ── Topper List ───────────────────────────────────────────────
@app.get("/grades/topper-list")
def topper_list(
    course_id: int = Query(...),
    semester_id: Optional[int] = Query(None),
    top_n: int = Query(10, ge=1, le=100),
):
    """
    Return top N students for a given course ordered by total_marks DESC.
    """
    sql = """
        SELECT
            s.roll_number,
            u.full_name,
            g.internal_marks,
            g.external_marks,
            g.total_marks,
            g.grade,
            RANK() OVER (ORDER BY g.total_marks DESC) AS `rank`
        FROM grades g
        JOIN students s ON g.student_id = s.id
        JOIN users    u ON s.user_id    = u.id
        WHERE g.course_id = %s AND g.total_marks IS NOT NULL
    """
    args = [course_id]
    if semester_id:
        sql += " AND g.semester_id = %s"
        args.append(semester_id)
    sql += " ORDER BY g.total_marks DESC LIMIT %s"
    args.append(top_n)

    rows = query(sql, tuple(args))
    return {"course_id": course_id, "top_n": top_n, "toppers": rows}


# ── Export CSV ────────────────────────────────────────────────
@app.get("/grades/export/csv")
def export_grades_csv(
    course_id: int = Query(...),
    semester_id: Optional[int] = Query(None),
):
    """
    Stream a CSV of all grades for a course.
    """
    sql = """
        SELECT
            s.roll_number,
            u.full_name,
            c.code  AS course_code,
            c.title AS course_title,
            sm.name AS semester,
            g.internal_marks,
            g.external_marks,
            g.total_marks,
            g.grade
        FROM grades g
        JOIN students  s  ON g.student_id  = s.id
        JOIN users     u  ON s.user_id     = u.id
        JOIN courses   c  ON g.course_id   = c.id
        JOIN semesters sm ON g.semester_id = sm.id
        WHERE g.course_id = %s
    """
    args = [course_id]
    if semester_id:
        sql += " AND g.semester_id = %s"
        args.append(semester_id)
    sql += " ORDER BY g.total_marks DESC"

    rows = query(sql, tuple(args))

    output = io.StringIO()
    fields = ["roll_number", "full_name", "course_code", "course_title",
              "semester", "internal_marks", "external_marks", "total_marks", "grade"]
    writer = csv.DictWriter(output, fieldnames=fields, extrasaction="ignore")
    writer.writeheader()
    writer.writerows(rows)

    output.seek(0)
    fn = f"grades_course_{course_id}_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([output.read()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={fn}"},
    )


# ── Recalculate grades ────────────────────────────────────────
@app.post("/grades/recalculate")
def recalculate_grades(semester_id: Optional[int] = Query(None)):
    """
    Recompute letter grade and grade_point from total_marks for all
    rows in the grades table (optionally filtered to a semester).
    Useful after changing the grading scale.
    """
    sql = "SELECT id, total_marks FROM grades WHERE total_marks IS NOT NULL"
    args: list = []
    if semester_id:
        sql += " AND semester_id = %s"
        args.append(semester_id)

    rows = query(sql, tuple(args))
    conn = get_db()
    cur  = conn.cursor()
    updated = 0
    for r in rows:
        letter, _ = total_to_grade(float(r["total_marks"]))
        cur.execute("UPDATE grades SET grade = %s WHERE id = %s", (letter, r["id"]))
        updated += 1
    conn.commit()
    conn.close()

    return {"updated": updated, "semester_id": semester_id}


# ── Run directly ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("grade_processing:app", host="0.0.0.0", port=8002, reload=True)

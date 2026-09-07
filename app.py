from flask import Flask, render_template, request, jsonify

from dotenv import load_dotenv

from werkzeug.utils import secure_filename

import sqlite3

import os

import uuid

from datetime import datetime



load_dotenv()



app = Flask(__name__)



BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DB_PATH = os.path.join(BASE_DIR, "verda.db")

UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")



os.makedirs(UPLOAD_FOLDER, exist_ok=True)



app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024



ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}





# ============================================================

# DATABASE

# ============================================================



def get_db():

    conn = sqlite3.connect(DB_PATH)

    conn.row_factory = sqlite3.Row

    return conn





def init_db():

    conn = get_db()



    conn.execute("""

        CREATE TABLE IF NOT EXISTS reports (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            title TEXT NOT NULL,

            description TEXT NOT NULL,

            location TEXT,

            latitude TEXT,

            longitude TEXT,

            photo TEXT,

            status TEXT DEFAULT 'RED',

            assigned_officer TEXT,

            created_at TEXT

        )

    """)



    conn.execute("""

        CREATE TABLE IF NOT EXISTS posts (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            content TEXT NOT NULL,

            photo TEXT,

            likes INTEGER DEFAULT 0,

            comments INTEGER DEFAULT 0,

            created_at TEXT

        )

    """)



    conn.execute("""

        CREATE TABLE IF NOT EXISTS comments (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            post_id INTEGER,

            comment TEXT NOT NULL,

            created_at TEXT

        )

    """)



    conn.commit()

    conn.close()





init_db()





# ============================================================

# HOME

# ============================================================



@app.route("/")

def home():

    return render_template("index.html")





# ============================================================

# AI ASSISTANT

# ============================================================



@app.route("/api/ask", methods=["POST"])
def ask():
    try:
        from openai import OpenAI

        data = request.get_json(silent=True) or {}
        question = (data.get("question") or "").strip()

        if not question:
            return jsonify({
                "answer": "Please ask me a sustainability question."
            })

        api_key = os.getenv("OPENAI_API_KEY")

        if not api_key:
            return jsonify({
                "answer": "VERDA AI is not configured yet. Please check the OPENAI_API_KEY in your .env file."
            }), 500

        client = OpenAI(api_key=api_key)

        response = client.responses.create(
            model="gpt-5.6-luna",
            input=(
                "You are VERDA AI, a friendly sustainability assistant. "
                "Help users make practical environmentally friendly choices. "
                "Give simple, useful answers suitable for college students and "
                "ordinary citizens. Keep answers concise and actionable.\n\n"
                "User question: " + question
            )
        )

        answer = response.output_text

        return jsonify({
            "answer": answer
        })

    except Exception as e:
        print("VERDA AI ERROR:", repr(e))
        return jsonify({
            "answer": "VERDA AI encountered an error. Please check the Flask terminal for the exact error."
        }), 500


@app.route("/api/eco-score", methods=["POST"])

def eco_score():



    data = request.get_json() or {}



    total = 0



    for key in ["waste", "water", "energy", "food"]:



        try:

            value = int(data.get(key, 1))

            value = max(1, min(value, 4))

            total += value



        except (ValueError, TypeError):

            total += 1



    score = round((total / 16) * 100)



    if score >= 90:

        message = "?? Excellent! You are making very green choices."



    elif score >= 70:

        message = "?? Great job! Keep improving your sustainable habits."



    elif score >= 50:

        message = "?? Good start! Small changes can make a big difference."



    else:

        message = "?? Every journey starts with one small change."



    return jsonify({

        "score": score,

        "message": message

    })





# ============================================================

# REPORTS

# ============================================================



@app.route("/api/reports", methods=["GET"])

def get_reports():



    conn = get_db()



    rows = conn.execute(

        "SELECT * FROM reports ORDER BY id DESC"

    ).fetchall()



    conn.close()



    return jsonify([dict(row) for row in rows])





@app.route("/api/report", methods=["POST"])

def create_report():



    title = request.form.get("title", "").strip()

    description = request.form.get("description", "").strip()

    location = request.form.get("location", "").strip()

    latitude = request.form.get("latitude", "").strip()

    longitude = request.form.get("longitude", "").strip()



    if not title or not description:



        return jsonify({

            "error": "Title and description are required."

        }), 400



    photo_url = None



    photo = request.files.get("photo")



    if photo and photo.filename:



        extension = photo.filename.rsplit(".", 1)[-1].lower()



        if extension not in ALLOWED_EXTENSIONS:



            return jsonify({

                "error": "Only JPG, JPEG, PNG and WEBP images are allowed."

            }), 400



        filename = secure_filename(

            f"{uuid.uuid4().hex}.{extension}"

        )



        photo.save(

            os.path.join(

                app.config["UPLOAD_FOLDER"],

                filename

            )

        )



        photo_url = f"/static/uploads/{filename}"



    conn = get_db()



    conn.execute("""

        INSERT INTO reports

        (

            title,

            description,

            location,

            latitude,

            longitude,

            photo,

            status,

            created_at

        )

        VALUES (?, ?, ?, ?, ?, ?, 'RED', ?)

    """, (

        title,

        description,

        location,

        latitude,

        longitude,

        photo_url,

        datetime.now().strftime("%Y-%m-%d %H:%M")

    ))



    conn.commit()

    conn.close()



    return jsonify({

        "success": True,

        "message": "Problem reported successfully."

    })





# ============================================================

# ADMIN ASSIGNMENT

# ============================================================



@app.route("/api/report/<int:report_id>/assign", methods=["POST"])

def assign_report(report_id):



    data = request.get_json() or {}



    officer = data.get("officer", "").strip()



    if not officer:



        return jsonify({

            "error": "Please select a field officer."

        }), 400



    conn = get_db()



    cursor = conn.execute("""

        UPDATE reports

        SET assigned_officer = ?,

            status = 'GREEN'

        WHERE id = ?

    """, (officer, report_id))



    conn.commit()



    if cursor.rowcount == 0:



        conn.close()



        return jsonify({

            "error": "Report not found."

        }), 404



    conn.close()



    return jsonify({

        "success": True,

        "message": "Field officer assigned successfully."

    })





# ============================================================

# FIELD OFFICER STATUS

# ============================================================



@app.route("/api/report/<int:report_id>/status", methods=["POST"])

def update_report_status(report_id):



    data = request.get_json() or {}



    status = data.get("status", "").upper()



    allowed = {

        "GREEN",

        "IN PROGRESS",

        "RESOLVED"

    }



    if status not in allowed:



        return jsonify({

            "error": "Invalid status."

        }), 400



    conn = get_db()



    conn.execute("""

        UPDATE reports

        SET status = ?

        WHERE id = ?

    """, (status, report_id))



    conn.commit()

    conn.close()



    return jsonify({

        "success": True

    })





# ============================================================

# COMMUNITY POSTS

# ============================================================



@app.route("/api/posts", methods=["GET"])

def get_posts():



    conn = get_db()



    rows = conn.execute(

        "SELECT * FROM posts ORDER BY id DESC"

    ).fetchall()



    conn.close()



    return jsonify([dict(row) for row in rows])





@app.route("/api/posts", methods=["POST"])

def create_post():



    content = request.form.get("content", "").strip()



    if not content:



        return jsonify({

            "error": "Write something before posting."

        }), 400



    photo_url = None



    photo = request.files.get("photo")



    if photo and photo.filename:



        extension = photo.filename.rsplit(".", 1)[-1].lower()



        if extension not in ALLOWED_EXTENSIONS:



            return jsonify({

                "error": "Unsupported image type."

            }), 400



        filename = secure_filename(

            f"{uuid.uuid4().hex}.{extension}"

        )



        photo.save(

            os.path.join(

                app.config["UPLOAD_FOLDER"],

                filename

            )

        )



        photo_url = f"/static/uploads/{filename}"



    conn = get_db()



    conn.execute("""

        INSERT INTO posts

        (

            content,

            photo,

            likes,

            comments,

            created_at

        )

        VALUES (?, ?, 0, 0, ?)

    """, (

        content,

        photo_url,

        datetime.now().strftime("%Y-%m-%d %H:%M")

    ))



    conn.commit()

    conn.close()



    return jsonify({

        "success": True

    })





@app.route("/api/posts/<int:post_id>/like", methods=["POST"])

def like_post(post_id):



    conn = get_db()



    conn.execute("""

        UPDATE posts

        SET likes = likes + 1

        WHERE id = ?

    """, (post_id,))



    conn.commit()

    conn.close()



    return jsonify({

        "success": True

    })





@app.route("/api/posts/<int:post_id>/comment", methods=["POST"])

def comment_post(post_id):



    data = request.get_json() or {}



    comment = data.get("comment", "").strip()



    if not comment:



        return jsonify({

            "error": "Comment cannot be empty."

        }), 400



    conn = get_db()



    conn.execute("""

        INSERT INTO comments

        (

            post_id,

            comment,

            created_at

        )

        VALUES (?, ?, ?)

    """, (

        post_id,

        comment,

        datetime.now().strftime("%Y-%m-%d %H:%M")

    ))



    conn.execute("""

        UPDATE posts

        SET comments = comments + 1

        WHERE id = ?

    """, (post_id,))



    conn.commit()

    conn.close()



    return jsonify({

        "success": True

    })





# ============================================================

# RUN

# ============================================================



if __name__ == "__main__":



    print("")

    print("==============================================")

    print("              VERDA IS RUNNING")

    print("       AI FOR A GREENER FUTURE")

    print("==============================================")

    print("")

    print("Website: http://127.0.0.1:5000")

    print("")



    app.run(

        host="127.0.0.1",

        port=5000,

        debug=True

    )






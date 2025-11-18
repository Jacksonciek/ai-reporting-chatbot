#!/usr/bin/env python3
import base64
import os
import threading
import uuid
from datetime import datetime, timezone
from io import BytesIO

import cloudinary
import cloudinary.api
import cloudinary.uploader
import pandas as pd
import redis
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request
from flask_cors import CORS

# Embeddings for vector store
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from sqlalchemy import MetaData, create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.schema import CreateIndex, CreateTable

from chat_agent import VisualizerBot
from config import DEBUG, N_SAMPLES, SCHEDULER_RESET_MIN
from SQLChatManager import SQLChatHistoryManager

# from langchain_chroma import Chroma


load_dotenv()
# Schema caching
redis_host = os.getenv("REDIS_HOST")
redis_port = os.getenv("REDIS_PORT")
redis_client = redis.Redis(host=redis_host, port=redis_port)

app = Flask(__name__)
CORS(app)

# LLM Models
model = ChatOpenAI(model="gpt-4o", temperature=0.3, max_tokens=10000)
image_model = ChatOpenAI(model="gpt-4o", temperature=0.3, max_tokens=10000)

chat_manager = SQLChatHistoryManager(app)


# Konfigurasi Cloudinary
CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
API_KEY = os.getenv("CLOUDINARY_API_KEY")
API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

cloudinary.config(
    cloud_name=CLOUD_NAME,
    api_key=API_KEY,
    api_secret=API_SECRET,
)

# Connect to the database
schema_valid = redis_client.get("sql_schema") is not None

# Database untuk scheduler
DB_USER_SCHED = os.getenv("DB_USER")
DB_PASSWORD_SCHED = os.getenv("DB_PASSWORD").replace("@", "%40").replace("%23", "#")
DB_HOST_SCHED = os.getenv("DB_HOST")
DB_NAME_SCHED = os.getenv("DB_NAME")
DB_PORT_SCHED = os.getenv("DB_PORT")

sched_db_uri = f"mysql+mysqlconnector://{DB_USER_SCHED}:{DB_PASSWORD_SCHED}@{DB_HOST_SCHED}:{DB_PORT_SCHED}/{DB_NAME_SCHED}"

engine = create_engine(
    sched_db_uri,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    pool_pre_ping=True,
)

# connection = engine.connect()

metadata = MetaData()

# Connect to the database
schema_valid = redis_client.get("sql_schema") is not None
db_schema = ""


def schedule():
    """
    Timer callback every SCHEDULE_RESET_MIN
    Invalidates the cached schema every reset interval
    """

    global db_schema

    print("[SERVER] RELOAD SCHEMA")
    # Pastikan tidak ada tugas baru sebelum yang lama selesai
    timer_thread = threading.Timer(SCHEDULER_RESET_MIN * 60, schedule)
    timer_thread.daemon = True  # Thread akan mati jika program utama mati
    timer_thread.start()
    try:
        with engine.connect() as connection:
            metadata.clear()
            metadata.reflect(bind=engine)
            print("CONNECTED")
            # Loop through each table in the database

            db_schema = ""
            for table in metadata.sorted_tables:
                try:
                    # Add the CREATE TABLE statement to `db_schema`
                    db_schema += str(CreateTable(table).compile(engine)) + ";\n\n"

                    # Add header indicating sample data
                    db_schema += f"-- Sample data from `{table.name}`:\n"

                    # Fetch column names for displaying headers
                    column_names = [column.name for column in table.columns]
                    db_schema += "\t".join(column_names) + "\n"

                    # Execute a query to get the first 3 rows of the table
                    result = connection.execute(
                        table.select().limit(N_SAMPLES)
                    ).fetchall()

                    # Format and add each row of sample data
                    for row in result:
                        row_data = "\t".join(
                            str(value) if value is not None else "NULL" for value in row
                        )
                        db_schema += row_data + "\n"

                    # Add a newline to separate data of different tables
                    db_schema += "\n\n"
                except SQLAlchemyError as e:
                    print(f"Error fetching data for table {table.name}: {e}")

            redis_client.set("sql_schema", db_schema)
            print("[SERVER] Saved Schema")
    except SQLAlchemyError as e:
        print(f"Error fetching data: {e}")
    finally:
        print("[SERVER] Schedule task finished.")


schedule()

if schema_valid:
    print("[SERVER] Got Schema")
    db_schema = redis_client.get("sql_schema").decode("utf-8")


# Bot app
bot = VisualizerBot(
    model,
    image_model,
    engine,
    db_schema,
    chatManager=chat_manager,
    plot=True,
    refinePlot=False,
)


# cloudinary function
def upload_cloudinary_image(img_bytes):
    # Menggunakan BytesIO untuk mengubah img_bytes ke format file-like
    img_file = BytesIO(img_bytes)

    # Upload gambar ke Cloudinary
    response = cloudinary.uploader.upload(img_file, resource_type="image")

    # Mendapatkan URL dari gambar yang diupload
    image_url = response["secure_url"]

    return str(image_url)


def generate_room_title(prompt: str) -> str:
    """
    Create a short, human-readable title from the first user prompt.
    """
    if not prompt:
        return "Percakapan Baru"

    cleaned = " ".join(prompt.strip().split())
    if len(cleaned) <= 48:
        return cleaned

    truncated = cleaned[:48]
    last_space = truncated.rfind(" ")
    if last_space > 20:
        truncated = truncated[:last_space]

    return f"{truncated.strip()}..."


@app.route("/api/new_room", methods=["POST"])
def create_room():
    """
    Create a room through the `ChatHistoryManager` interface

    Body:
     * `room_name` (str): name of room
     * `user_id` (int): user id

    Returns:
     * `room_id` (int): ID of the new room

    Throws an exception if cannot create the room
    """

    try:
        room_name = request.get_json().get("room_name")
        user_id = request.get_json().get("user_id")
        return jsonify(
            {
                "status_code": "BOT-000",
                "message": "Create room success",
                "room_id": chat_manager.create_room(user_id, room_name),
            }
        )
    except Exception as e:
        return (
            jsonify({"status_code": "BOT-999", "error": "there's something wrong"}),
            500,
        )


@app.route("/api/<user_id>/rooms", methods=["GET"])
def get_rooms(user_id):
    """
    Get all rooms for the user with pagination

    Query Parameters:
        limit (int): Number of records per page
        offset (int): Number of records to skip

    Returns:
        JSON response with paginated rooms data and total count
    """
    try:
        limit = request.args.get("limit", default=10, type=int)
        offset = request.args.get("offset", default=0, type=int)

        rooms, total_count = chat_manager.get_all_rooms(user_id, limit, offset)

        return jsonify(
            {
                "status_code": "BOT-000",
                "message": "Get room success",
                "total_count": total_count,
                "data": rooms,
            }
        )
    except Exception as e:
        return (
            jsonify({"status_code": "BOT-999", "error": "there's something wrong"}),
            500,
        )


@app.route("/api/create_user", methods=["POST"])
def create_user():
    """
    Create user from username

    ### Body:
        `username`: username for the new user, must be unique

    ### Returns:
        `user_id`: id of the new user
    """

    try:
        username = request.get_json().get("username")
    except:
        return (
            jsonify({"status_code": "BOT-999", "error": "There's something wrong"}),
            500,
        )

    try:
        return (
            jsonify(
                {
                    "status_code": "BOT-000",
                    "message": "Create user success",
                    "user_id": chat_manager.create_user(username),
                }
            ),
            200,
        )
    except Exception as e:
        return (
            jsonify({"status_code": "BOT-999", "error": "There's something wrong"}),
            500,
        )


@app.route("/api/rooms/<room_id>/messages/bot", methods=["POST"])
def post_prompt(room_id):
    """
    Helper function to post user prompt to the bot.

    Params:
        - room_id: room id to message to

        Body:
        - user_prompt:
            user prompt to the chatting agent
        - user_id:
            user id to the chatting agent
        - prompt_type:
            type of prompt, can either be CONVERSATION or QUERY.

        Returns:
        - {
            image: image of the chat response (in a cloudinary url)
            text: text response of the AI agent.
        }

    """
    try:
        user_prompt = request.get_json().get("user_prompt")
        user_id = request.get_json().get("user_id")
        image_link = None

        if not user_prompt:
            return jsonify({"error": "user prompt is required"}), 400

        try:
            chat_manager.ensure_room_name(int(room_id), generate_room_title(user_prompt))
        except (ValueError, TypeError):
            pass

        response = bot.run(user_prompt, room_id, user_id)

        # After getting the response, insert it inside the database,
        # for both the message itself, and also the plot image.
        resp_content = response.get("summarized_output")

        xlsx_link = None
        if response.get("export_csv") and response["pandas_dump"] is not None:
            export_out = BytesIO()
            df: pd.DataFrame = response["pandas_dump"]
            with pd.ExcelWriter(export_out, engine="xlsxwriter") as writer:
                df.to_excel(writer, index=False)

            export_out.seek(0)
            cloudinary_upload = cloudinary.uploader.upload(
                export_out,
                resource_type="raw",
                format="xlsx",
            )

            xlsx_link = cloudinary_upload["secure_url"]

        if response.get("router_result", None) == "PLOT":
            image_bytes = base64.b64decode(response["image_base64"])
            image_link = upload_cloudinary_image(image_bytes)

            image_msg_pic = {
                "text": image_link,
                "timestamp": None,
                "user_id": user_id,
                "room_id": room_id,
                "role": "bot",
                "data_type": "image",
            }

            chat_manager.enter_message(SQLChatHistoryManager.Message(**image_msg_pic))

            # Create a new user message, and insert it into the chat database
            new_message = {
                "text": user_prompt,
                "timestamp": None,
                "user_id": user_id,
                "room_id": room_id,
                "role": "user",
                "data_type": "text",
            }

            new_message = SQLChatHistoryManager.Message(**new_message)
            chat_manager.enter_message(new_message)

            bot_message = {
                "text": resp_content,
                "timestamp": None,
                "image_url": image_link,
                "document_url": xlsx_link,
                "user_id": user_id,
                "room_id": room_id,
                "role": "bot",
                "data_type": "text",
                "df": None,
            }

            chat_manager.enter_message(SQLChatHistoryManager.Message(**bot_message))

            return (
                jsonify(
                    {
                        "status_code": "BOT-000",
                        "data": {
                            "text": response["summarized_output"],
                            "document": xlsx_link,
                            "image": image_link,
                        },
                        "message": "Bot run success",
                    }
                ),
                200,
            )

        # Create a new user message, and insert it into the chat database
        new_message = {
            "text": user_prompt,
            "timestamp": None,
            "user_id": user_id,
            "room_id": room_id,
            "role": "user",
            "data_type": "text",
        }

        new_message = SQLChatHistoryManager.Message(**new_message)
        chat_manager.enter_message(new_message)

        bot_message = {
            "text": resp_content,
            "timestamp": None,
            "image_url": image_link,
            "document_url": xlsx_link,
            "user_id": user_id,
            "room_id": room_id,
            "role": "bot",
            "data_type": "text",
            "df": None,
        }

        chat_manager.enter_message(SQLChatHistoryManager.Message(**bot_message))

        return (
            jsonify(
                {
                    "status_code": "BOT-000",
                    "data": {
                        "text": response["summarized_output"],
                        "document": xlsx_link,
                        "image": image_link,
                    },
                    "message": "Bot run success",
                }
            ),
            200,
        )

    except Exception as e:
        return (
            jsonify(
                {
                    "status_code": "BOT-999",
                    "error": str(e),
                    # "error": "Maaf saya tidak dapat menjawab pertanyaan anda",
                }
            ),
            500,
        )


@app.route("/api/rooms/<room_id>/messages", methods=["GET"])
def get_messages(room_id):
    """
    Get all messages in a from a specific room specified by
    a room_id.

    ### Param:
     `room_id (int)`: room_id to get messsages from.

    Return
        `messages ([SQLChatManager.Message])`: list of messages in the room specified by room_id
    """
    try:
        messages = chat_manager.get_all_messages(room_id=room_id)

        return jsonify(
            {
                "status_code": "BOT-000",
                "message": "Get message success",
                "data": messages,
            }
        )

    except Exception as e:
        return (
            jsonify({"status_code": "BOT-999", "error": "There's something wrong"}),
            500,
        )


if __name__ == "__main__":
    app.run(debug=False, port=5000)

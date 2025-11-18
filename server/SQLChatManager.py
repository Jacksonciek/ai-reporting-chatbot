import os
from datetime import datetime
from enum import Enum

import pandas as pd
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy
from langchain_core.documents import Document
from sqlalchemy import (
    JSON,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    and_,
    create_engine,
    or_,
)
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import relationship, scoped_session, sessionmaker
from sqlalchemy.sql import func

from config import *

load_dotenv()

COUNTER_NAME = "dataframe_uid"


class DocumentType(str, Enum):
    MESSAGE = ("message",)
    QUERY_CACHE = "query_cache"


class ChatMessage:
    def __init__(self, message: dict):
        self.text = message["text"]
        self.role = message["role"]
        self.user_id = message["user_id"]
        self.room_id = message["room_id"]
        self.timestamp = message["timestamp"]
        self.message_id = message["uid"]


DB_USER = os.getenv("MSG_DB_USER")
DB_PASSWORD = (
    str(os.getenv("MSG_DB_PASSWORD")).replace("@", "%40").replace("%23", "#")
)  # Encode @ symbol
DB_HOST = os.getenv("MSG_DB_HOST")
DB_NAME = os.getenv("MSG_DB_NAME")
DB_PORT = os.getenv("MSG_DB_PORT")

db_uri = f"mysql+mysqlconnector://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(
    db_uri,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    pool_timeout=30,
    pool_pre_ping=True,
)

db = SQLAlchemy()

# Session Handler untuk Multi-Threading
SessionLocal = scoped_session(
    sessionmaker(autocommit=False, autoflush=False, bind=engine)
)


class SQLChatHistoryManager:
    """
    Wrapper class for handling chat database queries for each room.
    Message schema: {text, role, user_id, room_id, timestamp, type
    """

    """
        Schema for messages
    """

    class Message(db.Model):
        __tablename__ = "messages"
        id = db.Column(db.Integer, primary_key=True)
        text = db.Column(db.Text, nullable=False)
        role = db.Column(db.String(50), nullable=True)
        user_id = db.Column(db.Integer, db.ForeignKey("user.user_id"), nullable=False)
        room_id = db.Column(db.Integer, db.ForeignKey("room.room_id"), nullable=False)
        timestamp = db.Column(db.DateTime, nullable=True)
        data_type = db.Column(db.String(50), nullable=False)
        image_url = db.Column(db.String(255), nullable=True)
        document_url = db.Column(db.String(255), nullable=True)
        df = db.Column(db.JSON, nullable=True)

        # Timestamps
        created_at = db.Column(db.DateTime, default=func.now(), nullable=False)
        updated_at = db.Column(
            db.DateTime, default=func.now(), onupdate=func.now(), nullable=False
        )
        deleted_at = db.Column(db.DateTime, nullable=True)

        # Relationships
        user = db.relationship("User", back_populates="messages")
        room = db.relationship("Room", back_populates="messages")

    class Room(db.Model):
        __tablename__ = "room"
        room_id = db.Column(db.Integer, primary_key=True)
        room_name = db.Column(db.Text)
        date_created = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)
        user_id = db.Column(db.Integer, db.ForeignKey("user.user_id"), nullable=False)

        # Timestamps
        created_at = db.Column(db.DateTime, default=func.now(), nullable=False)
        updated_at = db.Column(
            db.DateTime, default=func.now(), onupdate=func.now(), nullable=False
        )
        deleted_at = db.Column(db.DateTime, nullable=True)

        # Relationships
        user = db.relationship("User", back_populates="room")
        messages = db.relationship("Message", back_populates="room")

    class User(db.Model):
        __tablename__ = "user"
        user_id = db.Column(db.Integer, primary_key=True)
        user_name = db.Column(db.String(100), nullable=False, unique=True)

        # Timestamps
        created_at = db.Column(db.DateTime, default=func.now(), nullable=False)
        updated_at = db.Column(
            db.DateTime, default=func.now(), onupdate=func.now(), nullable=False
        )
        deleted_at = db.Column(db.DateTime, nullable=True)

        # Relationships
        messages = db.relationship("Message", back_populates="user")
        room = db.relationship("Room", back_populates="user")

    def __init__(self, flask_app):
        """Initializes the Chat history manager"""

        flask_app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
        flask_app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

        db.init_app(flask_app)
        # with flask_app.app_context():
        #     db.create_all()

        # Initialize message cache
        self.message_cache = {}

    def _update_msg_cache(self, msg: Document):

        room_id = msg.metadata["room_id"]
        # Test if room exists in in-memory cache
        msg_list = self.message_cache.setdefault(room_id, [])

        # If cache is full, evict earliest message
        if len(msg_list) == LASTEST_CAP:
            msg_list = msg_list[1:]

        # Append message to cache
        msg_list.append(msg)

    def enter_message(
        self, msg: "SQLChatHistoryManager.Message", dataframe: pd.DataFrame = None
    ):
        """
        Inserts a message to the database safely
        """
        session = SessionLocal()
        try:
            if msg.timestamp is None:
                msg.timestamp = datetime.now()

            msg.df = (
                dataframe.to_json(orient="table") if dataframe is not None else None
            )
            session.add(msg)
            session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error entering message: {e}")
        finally:
            session.close()

    def get_relevant_messages(
        self, user_id, room_id, query=None
    ) -> list["SQLChatHistoryManager.Message"]:
        """
        Returns the last 10 messages from the database in the correct chronological order (oldest to newest).
        """

        session = SessionLocal()
        try:
            subquery = (
                session.query(SQLChatHistoryManager.Message.id)
                .filter(
                    SQLChatHistoryManager.Message.room_id == room_id,
                    SQLChatHistoryManager.Message.user_id == user_id,
                    SQLChatHistoryManager.Message.deleted_at.is_(None),
                    SQLChatHistoryManager.Message.data_type == "text",
                )
                .order_by(
                    SQLChatHistoryManager.Message.timestamp.desc()
                )  # Ambil yang terbaru dulu
                .limit(10)
                .subquery()
            )

            # Ambil pesan berdasarkan ID dari subquery tetapi dalam urutan timestamp ASCENDING
            return (
                session.query(SQLChatHistoryManager.Message)
                .filter(SQLChatHistoryManager.Message.id.in_(subquery))
                .order_by(
                    SQLChatHistoryManager.Message.timestamp.asc()
                )  # Urutkan dengan benar
                .all()
            )
        finally:
            session.close()

    def get_message_from_id(self, msg_id: int) -> "SQLChatHistoryManager.Message":
        """
        Retrieve a specific message by ID.
        """

        session = SessionLocal()
        try:
            message = (
                session.query(SQLChatHistoryManager.Message)
                .filter_by(id=msg_id)
                .one_or_none()
            )
            return message  # Bisa None jika tidak ditemukan
        except SQLAlchemyError as e:
            print(f"[ERROR] Failed to get message {msg_id}: {e}")
            return None
        finally:
            session.close()  # Pastikan koneksi ditutup

    def get_cached_messages(self, query, user_id, room_id):
        """
        Retrieve most relevant messages directly from in-memory
        cache for faster access (only the most recent messages are
        cached).
        """

        # TODO: Implement this!
        pass

    def get_all_messages(self, room_id, limit=100):
        """
        Retrieve all messages for a specified room, ordered by timestamp (oldest to newest),
        formatted for frontend display. Limits the number of messages retrieved.
        """

        session = SessionLocal()
        try:
            messages = (
                session.query(SQLChatHistoryManager.Message)
                .filter(
                    SQLChatHistoryManager.Message.room_id == room_id,
                    SQLChatHistoryManager.Message.data_type == "text",
                    SQLChatHistoryManager.Message.deleted_at.is_(None),
                )
                .order_by(SQLChatHistoryManager.Message.timestamp.asc())
                .limit(limit)  # Hindari mengambil terlalu banyak data
                .all()
            )

            formatted_messages = []

            for i in range(0, len(messages), 2):
                user_message = (
                    messages[i]
                    if i < len(messages) and messages[i].role == "user"
                    else None
                )
                bot_message = (
                    messages[i + 1]
                    if i + 1 < len(messages) and messages[i + 1].role == "bot"
                    else None
                )

                formatted_messages.append(
                    {
                        "user": {"text": user_message.text if user_message else ""},
                        "bot": {
                            "text": bot_message.text if bot_message else "",
                            "image": (
                                bot_message.image_url
                                if bot_message and bot_message.image_url
                                else None
                            ),
                            "document": (
                                bot_message.document_url
                                if bot_message and bot_message.document_url
                                else None
                            ),
                        },
                    }
                )

            return formatted_messages

        except SQLAlchemyError as e:
            print(f"[ERROR] Failed to retrieve messages for room {room_id}: {e}")
            return []

        finally:
            session.close()  # Pastikan koneksi selalu ditutup

    def get_all_rooms(self, user_id, limit=10, offset=0):
        """
        Retrieve paginated list of rooms for a specified user, ordered by most recently created.
        """

        session = SessionLocal()
        try:
            total_count = (
                session.query(SQLChatHistoryManager.Room)
                .filter(
                    SQLChatHistoryManager.Room.user_id == user_id,
                    SQLChatHistoryManager.Room.deleted_at.is_(None),
                )
                .count()
            )

            rooms = (
                session.query(SQLChatHistoryManager.Room)
                .filter(
                    SQLChatHistoryManager.Room.user_id == user_id,
                    SQLChatHistoryManager.Room.deleted_at.is_(None),
                )
                .order_by(SQLChatHistoryManager.Room.created_at.desc())
                .offset(offset)
                .limit(limit)
                .all()
            )

            rooms_data = [
                {
                    "room_id": room.room_id,
                    "room_name": room.room_name,
                    "date_created": (
                        room.date_created.isoformat() if room.date_created else None
                    ),
                    "user_id": room.user_id,
                    "created_at": (
                        room.created_at.isoformat() if room.created_at else None
                    ),
                    "updated_at": (
                        room.updated_at.isoformat() if room.updated_at else None
                    ),
                    "deleted_at": (
                        room.deleted_at.isoformat() if room.deleted_at else None
                    ),
                }
                for room in rooms
            ]

            return rooms_data, total_count

        except SQLAlchemyError as e:
            print(f"[ERROR] Failed to retrieve rooms for user {user_id}: {e}")
            return [], 0

        finally:
            session.close()  # Pastikan koneksi selalu ditutup

    @classmethod
    def get_dataframe(cls, message: "SQLChatHistoryManager.Message") -> pd.DataFrame:
        """
        Parse Dataframe from message
        """
        if message.data_type == "data" and message.df is not None:
            print("[JSON]", message.df[0:40])
            return pd.read_json(message.df, orient="table")

        else:
            return None

    def create_room(self, user_id: int, room_name: String):
        """
        Create a new chatroom in the system safely
        """
        session = SessionLocal()
        try:
            new_room = SQLChatHistoryManager.Room(
                room_name=room_name, date_created=datetime.now(), user_id=user_id
            )
            session.add(new_room)
            session.commit()
            return new_room.room_id
        except Exception as e:
            session.rollback()
            print(f"Error creating room: {e}")
            return None
        finally:
            session.close()

    def ensure_room_name(self, room_id: int, room_name: str):
        """
        Update the room name only when it is empty or still in the default state.
        """
        if not room_name:
            return

        session = SessionLocal()
        try:
            room = (
                session.query(SQLChatHistoryManager.Room)
                .filter(SQLChatHistoryManager.Room.room_id == room_id)
                .first()
            )

            if not room:
                return

            current_name = (room.room_name or "").strip().lower()
            if current_name in ("", "new chat", "percakapan baru"):
                room.room_name = room_name
                session.commit()
        except Exception as e:
            session.rollback()
            print(f"Error updating room name for room {room_id}: {e}")
        finally:
            session.close()

    def create_user(self, user_name):
        """
        Create a new user safely
        """
        session = SessionLocal()
        try:
            new_user = SQLChatHistoryManager.User(user_name=user_name)
            session.add(new_user)
            session.commit()
            return new_user.user_id
        except Exception as e:
            session.rollback()
            print(f"Error creating user: {e}")
            return None
        finally:
            session.close()

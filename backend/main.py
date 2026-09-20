import os
import sys

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE = "homefood.db"


def get_connection():
    return sqlite3.connect(DATABASE)


def create_table():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT UNIQUE,
            name TEXT NOT NULL,
            brand TEXT,
            quantity TEXT,
            image TEXT,
            category TEXT
        )
    """)

    connection.commit()
    connection.close()


create_table()
if getattr(sys, "frozen", False):
    BASE_DIR = sys._MEIPASS
    FRONTEND_DIR = os.path.join(BASE_DIR, "dist")
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    FRONTEND_DIR = os.path.join(BASE_DIR, "..", "dist")

ASSETS_DIR = os.path.join(FRONTEND_DIR, "assets")

app.mount(
    "/assets",
    StaticFiles(directory=ASSETS_DIR),
    name="assets"
)


@app.get("/app")
def serve_app():
    return FileResponse(
        os.path.join(FRONTEND_DIR, "index.html")
    )   


class Product(BaseModel):
    barcode: str
    name: str
    brand: str = ""
    quantity: str = ""
    image: str = ""
    category: str = ""


@app.get("/")
def home():
    return {"message": "HomeFood backend is working!"}


@app.get("/products")
def get_products():
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute("""
        SELECT id, barcode, name, brand, quantity, image, category
        FROM products
        ORDER BY id
    """)

    rows = cursor.fetchall()
    connection.close()

    products = []

    for row in rows:
        products.append({
            "id": row[0],
            "barcode": row[1],
            "name": row[2],
            "brand": row[3],
            "quantity": row[4],
            "image": row[5],
            "category": row[6],
        })

    return products


@app.post("/products")
def add_product(product: Product):
    connection = get_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("""
            INSERT INTO products
            (barcode, name, brand, quantity, image, category)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            product.barcode,
            product.name,
            product.brand,
            product.quantity,
            product.image,
            product.category,
        ))

        connection.commit()

        product_id = cursor.lastrowid

        return {
            "success": True,
            "id": product_id
        }

    except sqlite3.IntegrityError:
        return {
            "success": False,
            "message": "This product is already in your ingredients."
        }

    finally:
        connection.close()

@app.delete("/products/{product_id}")
def delete_product(product_id: int):
    connection = get_connection()
    cursor = connection.cursor()

    cursor.execute(
        "DELETE FROM products WHERE id = ?",
        (product_id,)
    )

    connection.commit()

    deleted = cursor.rowcount

    connection.close()

    if deleted == 0:
        return {
            "success": False,
            "message": "Product not found."
        }

    return {
        "success": True
    }

if __name__ == "__main__":
    import threading
    import time
    import webview
    import uvicorn

    def start_server():
        uvicorn.run(
            app,
            host="127.0.0.1",
            port=8000,
            log_config=None
        )

    server_thread = threading.Thread(
        target=start_server,
        daemon=True
    )

    server_thread.start()

    time.sleep(2)

    window = webview.create_window(
        "HomeFood",
        "http://127.0.0.1:8000/app",
        width=1200,
        height=800,
        min_size=(900, 600)
    )

    webview.start()

    # Closing the HomeFood window reaches this point.
    # The application then exits and the server thread stops.
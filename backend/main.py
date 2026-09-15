from fastapi import FastAPI
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
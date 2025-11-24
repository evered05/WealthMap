import os
import psycopg2

# Database connection parameters from docker-compose
DB_HOST = "postgres_db"
DB_PORT = "5432"
DB_NAME = "wealthmap_db"
DB_USER = "user"
DB_PASSWORD = "password"

def add_columns():
    try:
        conn = psycopg2.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD
        )
        cur = conn.cursor()
        
        # Add start_date column
        try:
            cur.execute("ALTER TABLE liabilities ADD COLUMN start_date TIMESTAMP;")
            print("Added start_date column")
        except psycopg2.errors.DuplicateColumn:
            print("start_date column already exists")
            conn.rollback()
        else:
            conn.commit()

        # Add years column
        try:
            cur.execute("ALTER TABLE liabilities ADD COLUMN years INTEGER;")
            print("Added years column")
        except psycopg2.errors.DuplicateColumn:
            print("years column already exists")
            conn.rollback()
        else:
            conn.commit()

        # Add grace_period_months column
        try:
            cur.execute("ALTER TABLE liabilities ADD COLUMN grace_period_months INTEGER DEFAULT 0;")
            print("Added grace_period_months column")
        except psycopg2.errors.DuplicateColumn:
            print("grace_period_months column already exists")
            conn.rollback()
        else:
            conn.commit()
            
        # Add liability_id to expenses table
        try:
            cur.execute("ALTER TABLE expenses ADD COLUMN liability_id INTEGER REFERENCES liabilities(id);")
            print("Added liability_id column to expenses")
        except psycopg2.errors.DuplicateColumn:
            print("liability_id column already exists")
            conn.rollback()
        else:
            conn.commit()

        cur.close()
        conn.close()
        print("Database schema updated successfully.")
        
    except Exception as e:
        print(f"Error updating database: {e}")

if __name__ == "__main__":
    add_columns()

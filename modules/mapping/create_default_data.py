"""
データベース初期化スクリプト
初回セットアップ時に一度だけ実行してください
"""
from pathlib import Path
import sqlite3

MODULE_DIR = Path(__file__).parent
DB_PATH = MODULE_DIR / 'mapping_figure.db'

def init_db():
    """データベースの初期化とテーブル作成"""
    print("=" * 50)
    print("Mapping Database 初期化開始")
    print("=" * 50)
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # projects テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("✓ projects テーブル作成")
    
    # groups テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            group_number INTEGER NOT NULL,
            comment TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
    ''')
    print("✓ groups テーブル作成")
    
    # image_assets テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS image_assets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            mime_type TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    print("✓ image_assets テーブル作成")
    
    # group_elements テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS group_elements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            group_id INTEGER NOT NULL,
            image_asset_id INTEGER,
            display_target TEXT NOT NULL,
            x_position REAL NOT NULL,
            y_position REAL NOT NULL,
            scale REAL DEFAULT 1.0,
            rotation REAL DEFAULT 0.0,
            opacity REAL DEFAULT 1.0,
            element_type TEXT DEFAULT 'image',
            has_blink_control INTEGER DEFAULT 0,
            blink_on_time REAL DEFAULT 0.5,
            blink_off_time REAL DEFAULT 0.5,
            element_comment TEXT DEFAULT '',
            polygon_points TEXT,
            text_content TEXT,
            text_font_size INTEGER DEFAULT 16,
            text_color TEXT DEFAULT '#000000',
            text_bg_color TEXT DEFAULT '#FFFFFF',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY (image_asset_id) REFERENCES image_assets(id) ON DELETE CASCADE
        )
    ''')
    print("✓ group_elements テーブル作成")
    
    # element_states テーブル
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS element_states (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            element_id INTEGER NOT NULL,
            state TEXT DEFAULT 'hidden',
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (element_id) REFERENCES group_elements(id) ON DELETE CASCADE
        )
    ''')
    print("✓ element_states テーブル作成")
    
    # マイグレーション: 既存テーブルに不足しているカラムを追加
    migrate_group_elements(cursor)
    
    conn.commit()
    conn.close()
    print("\n✓ テーブル構造の作成完了")


def migrate_group_elements(cursor):
    """group_elementsテーブルにないカラムを追加"""
    # テーブルのカラム一覧を取得
    cursor.execute("PRAGMA table_info(group_elements)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    
    # 追加が必要なカラム定義
    new_columns = {
        'element_type': "TEXT DEFAULT 'image'",
        'rotation': "REAL DEFAULT 0.0",
        'opacity': "REAL DEFAULT 1.0",
        'has_blink_control': "INTEGER DEFAULT 0",
        'blink_on_time': "REAL DEFAULT 0.5",
        'blink_off_time': "REAL DEFAULT 0.5",
        'element_comment': "TEXT DEFAULT ''",
        'polygon_points': "TEXT",
        'text_content': "TEXT",
        'text_font_size': "INTEGER DEFAULT 16",
        'text_color': "TEXT DEFAULT '#000000'",
        'text_bg_color': "TEXT DEFAULT '#FFFFFF'"
    }
    
    # 不足しているカラムを追加
    for column_name, column_def in new_columns.items():
        if column_name not in existing_columns:
            try:
                cursor.execute(f"ALTER TABLE group_elements ADD COLUMN {column_name} {column_def}")
                print(f"✓ カラム追加: {column_name}")
            except sqlite3.OperationalError as e:
                print(f"⚠ カラム追加スキップ: {column_name} ({e})")
        else:
            print(f"✓ カラム既存: {column_name}")


def create_default_data():
    """デフォルトプロジェクトを作成（テーブルの初期化のみ）"""
    print("\nデフォルトプロジェクト作成中...")
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # デフォルトプロジェクトを作成
    cursor.execute("SELECT COUNT(*) FROM projects")
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO projects (name) VALUES ('デフォルトプロジェクト')")
        project_id = cursor.lastrowid
        print(f"✓ デフォルトプロジェクト作成 (ID: {project_id})")
    else:
        cursor.execute("SELECT id FROM projects LIMIT 1")
        project_id = cursor.fetchone()[0]
        print(f"✓ 既存プロジェクト使用 (ID: {project_id})")
    
    conn.commit()
    conn.close()


if __name__ == '__main__':
    # テーブル構造を作成
    init_db()
    
    # デフォルトデータを作成
    create_default_data()
    
    print("\n" + "=" * 50)
    print("初期化完了！")
    print(f"データベース: {DB_PATH}")
    print("=" * 50)

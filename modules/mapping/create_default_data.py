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
    """group_elementsテーブルをマイグレーション：古いスキーマを修正"""
    
    print("[Migration] group_elements テーブルをチェック中...")
    
    # テーブルが存在するか確認
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='group_elements'")
    table_exists = cursor.fetchone() is not None
    
    if not table_exists:
        print("[Migration] group_elements テーブルが存在しません。新規作成します。")
        cursor.execute('''
            CREATE TABLE group_elements (
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
                shape_type TEXT,
                shape_data TEXT,
                stroke_color TEXT DEFAULT '#000000',
                fill_color TEXT DEFAULT '#FFFFFF',
                stroke_width INTEGER DEFAULT 2,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY (image_asset_id) REFERENCES image_assets(id) ON DELETE CASCADE
            )
        ''')
        print("[Migration] ✓ group_elements テーブルを新規作成")
        return
    
    # テーブルスキーマをチェック
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='group_elements'")
    create_sql = cursor.fetchone()[0] if cursor.fetchone() else ""
    
    # image_asset_id が NOT NULL の場合は再作成
    cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='group_elements'")
    create_sql_result = cursor.fetchone()
    create_sql = create_sql_result[0] if create_sql_result else ""
    
    if 'image_asset_id INTEGER NOT NULL' in str(create_sql):
        print("[Migration] ⚠️ 古いスキーマを検出（image_asset_id NOT NULL）。テーブルを再作成します...")
        
        # 既存データがあるか確認
        try:
            cursor.execute("SELECT COUNT(*) FROM group_elements")
            row_count = cursor.fetchone()[0]
            has_data = row_count > 0
        except:
            has_data = False
        
        if has_data:
            print(f"[Migration] ⚠️ {row_count} 件のデータが存在します。バックアップしてから再作成...")
            cursor.execute("ALTER TABLE group_elements RENAME TO group_elements_old_backup")
        else:
            print("[Migration] テーブルは空です。削除して再作成します。")
            cursor.execute("DROP TABLE group_elements")
        
        # 新しいスキーマでテーブル作成
        cursor.execute('''
            CREATE TABLE group_elements (
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
                shape_type TEXT,
                shape_data TEXT,
                stroke_color TEXT DEFAULT '#000000',
                fill_color TEXT DEFAULT '#FFFFFF',
                stroke_width INTEGER DEFAULT 2,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
                FOREIGN KEY (image_asset_id) REFERENCES image_assets(id) ON DELETE CASCADE
            )
        ''')
        print("[Migration] ✓ テーブルを再作成（image_asset_id は NULL 許可に）")
        
        # バックアップからデータを復元
        if has_data:
            try:
                cursor.execute("""
                    INSERT INTO group_elements (
                        id, group_id, image_asset_id, display_target, x_position, y_position,
                        scale, rotation, opacity, element_type, has_blink_control,
                        blink_on_time, blink_off_time, element_comment, polygon_points,
                        text_content, text_font_size, text_color, text_bg_color,
                        shape_type, shape_data, stroke_color, fill_color, stroke_width, created_at
                    )
                    SELECT 
                        id, group_id, NULLIF(image_asset_id, 0), display_target, x_position, y_position,
                        scale, rotation, opacity, element_type, has_blink_control,
                        blink_on_time, blink_off_time, element_comment, polygon_points,
                        text_content, text_font_size, text_color, text_bg_color,
                        shape_type, shape_data, stroke_color, fill_color, stroke_width, created_at
                    FROM group_elements_old_backup
                """)
                cursor.execute("DROP TABLE group_elements_old_backup")
                print("[Migration] ✓ バックアップからデータを復元")
            except Exception as e:
                print(f"[Migration] ⚠️ データ復元スキップ: {e}")
        return
    
    # カラムの追加が必要か確認
    cursor.execute("PRAGMA table_info(group_elements)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    
    required_columns = {
        'shape_type': "TEXT",
        'shape_data': "TEXT",
        'stroke_color': "TEXT DEFAULT '#000000'",
        'fill_color': "TEXT DEFAULT '#FFFFFF'",
        'stroke_width': "INTEGER DEFAULT 2"
    }
    
    for column_name, column_def in required_columns.items():
        if column_name not in existing_columns:
            try:
                cursor.execute(f"ALTER TABLE group_elements ADD COLUMN {column_name} {column_def}")
                print(f"[Migration] ✓ カラム追加: {column_name}")
            except Exception as e:
                print(f"[Migration] ⚠️ カラム追加スキップ: {column_name} ({e})")
    
    print("[Migration] ✓ group_elements テーブルのマイグレーション完了")


def create_default_data():
    """デフォルトプロジェクトとサンプルグループ・要素を作成"""
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
    
    # サンプルグループを作成（まだなければ）
    cursor.execute("SELECT COUNT(*) FROM groups WHERE project_id = ?", (project_id,))
    if cursor.fetchone()[0] == 0:
        print("\nサンプルグループとサンプル要素を作成中...")
        
        # グループ 1
        cursor.execute(
            "INSERT INTO groups (project_id, group_number, comment) VALUES (?, ?, ?)",
            (project_id, 1, "サンプルグループ 1")
        )
        group_id_1 = cursor.lastrowid
        
        # グループ 1 のサンプル要素
        import json
        sample_elements = [
            {
                'group_id': group_id_1,
                'element_type': 'rectangle',
                'display_target': 'monitor',
                'x_position': 100,
                'y_position': 100,
                'shape_type': 'rectangle',
                'shape_data': json.dumps({'type': 'rectangle', 'rect': {'x': 100, 'y': 100, 'width': 200, 'height': 150}}),
                'stroke_color': '#000000',
                'fill_color': '#007BFF',
                'stroke_width': 2,
                'element_comment': 'サンプル矩形 1'
            },
            {
                'group_id': group_id_1,
                'element_type': 'polygon',
                'display_target': 'parts',
                'x_position': 50,
                'y_position': 50,
                'shape_type': 'polygon',
                'shape_data': json.dumps({'type': 'polygon', 'points': [[50, 50], [250, 50], [250, 200], [50, 200]]}),
                'stroke_color': '#FF0000',
                'fill_color': '#FFFF00',
                'stroke_width': 2,
                'element_comment': 'サンプル多角形 1'
            }
        ]
        
        for elem in sample_elements:
            cursor.execute("""
                INSERT INTO group_elements (
                    group_id, element_type, display_target, x_position, y_position,
                    shape_type, shape_data, stroke_color, fill_color, stroke_width, element_comment
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                elem['group_id'], elem['element_type'], elem['display_target'],
                elem['x_position'], elem['y_position'],
                elem['shape_type'], elem['shape_data'],
                elem['stroke_color'], elem['fill_color'], elem['stroke_width'],
                elem['element_comment']
            ))
        
        print(f"✓ グループ 1 を作成（サンプル要素 2 個）")
    else:
        print("✓ グループは既に存在します。スキップします。")
    
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

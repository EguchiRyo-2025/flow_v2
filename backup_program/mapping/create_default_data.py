"""
デフォルトプロジェクトとグループを作成
"""
import sqlite3

DB_PATH = 'mapping_figure.db'

def create_default_data():
    conn = sqlite3.connect(DB_PATH)
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
    
    # デフォルトグループを1つ作成
    cursor.execute("SELECT COUNT(*) FROM groups WHERE project_id = ?", (project_id,))
    if cursor.fetchone()[0] == 0:
        cursor.execute("INSERT INTO groups (project_id, group_number, comment) VALUES (?, ?, ?)", 
                      (project_id, 1, ''))
        group_id = cursor.lastrowid
        print(f"✓ デフォルトグループ作成 (ID: {group_id}, No: 1)")
    else:
        print(f"✓ 既存グループあり")
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    create_default_data()

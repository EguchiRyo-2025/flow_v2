from flask import Flask, render_template, send_from_directory, request, jsonify
import os
import sqlite3
import uuid
from werkzeug.utils import secure_filename
from PIL import Image
import pyautogui
from screeninfo import get_monitors

app = Flask(__name__)

# ========================================
# ★ PostgreSQL移行時に変更する部分 ★
# ========================================
DB_PATH = 'mapping_figure.db'  # SQLite用
# PostgreSQL用（将来）:
# import psycopg2
# DB_CONFIG = {...}

UPLOAD_FOLDER = 'assets/images'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def get_db_connection():
    """データベース接続を取得"""
    # ========================================
    # ★ PostgreSQL移行時: この関数を変更 ★
    # ========================================
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn
    
    # PostgreSQL版（将来）:
    # import psycopg2
    # import psycopg2.extras
    # conn = psycopg2.connect(**DB_CONFIG)
    # return conn


def allowed_file(filename):
    """許可されたファイル形式かチェック"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/')
def index():
    return render_template('register_figure.html')


@app.route('/components/<path:filename>')
def serve_component(filename):
    """コンポーネントHTMLファイルを提供"""
    components_dir = os.path.join(app.template_folder, 'components')
    return send_from_directory(components_dir, filename)


@app.route('/media/<path:filename>')
def serve_media(filename):
    """メディアファイルを配信"""
    return send_from_directory('assets', filename)


# ========================================
# 画像アップロードAPI
# ========================================
@app.route('/api/upload/image', methods=['POST'])
def upload_image():
    """画像ファイルをアップロードして、画像アセットとして登録"""
    
    if 'file' not in request.files:
        return jsonify({'error': 'ファイルが選択されていません'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'ファイル名が空です'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'error': '許可されていないファイル形式です'}), 400
    
    try:
        # ユニークなファイル名を生成
        ext = os.path.splitext(file.filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_FOLDER, unique_name)
        
        # ファイルを保存
        file.save(file_path)
        
        # パスを正規化（Windowsのバックスラッシュをスラッシュに変換）
        file_path = file_path.replace('\\', '/')
        
        # 画像サイズを取得
        with Image.open(file_path) as img:
            width, height = img.size
        
        # MIMEタイプを取得
        mime_type = file.content_type or f'image/{ext[1:]}'
        
        # DBに登録
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # ========================================
        # ★ PostgreSQL移行時: 構文を変更 ★
        # ========================================
        # SQLite版
        cursor.execute("""
            INSERT INTO image_assets (file_path, width, height, mime_type)
            VALUES (?, ?, ?, ?)
        """, (file_path, width, height, mime_type))
        
        image_id = cursor.lastrowid
        
        # PostgreSQL版（将来）:
        # cursor.execute("""
        #     INSERT INTO image_assets (file_path, width, height, mime_type)
        #     VALUES (%s, %s, %s, %s)
        #     RETURNING id
        # """, (file_path, width, height, mime_type))
        # image_id = cursor.fetchone()[0]
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'id': image_id,
            'file_path': file_path,
            'width': width,
            'height': height,
            'mime_type': mime_type
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========================================
# グループ要素追加API
# ========================================
@app.route('/api/group_elements', methods=['POST'])
def add_group_element():
    """グループに画像要素を追加"""
    
    data = request.json
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # xとyをx_position/y_positionに変換
        x_pos = data.get('x', data.get('x_position', 0))
        y_pos = data.get('y', data.get('y_position', 0))
        
        # グループ要素を追加
        # ========================================
        # ★ PostgreSQL移行時: ? を %s に変更 ★
        # ========================================
        cursor.execute("""
            INSERT INTO group_elements (
                group_id, element_type, image_asset_id,
                display_target, x_position, y_position,
                scale, rotation, opacity,
                has_blink_control, blink_on_time, blink_off_time,
                element_comment
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('group_id'),
            'image',
            data.get('image_asset_id'),
            data.get('display_target', ''),
            x_pos,
            y_pos,
            data.get('scale', 1.0),
            data.get('rotation', 0.0),
            data.get('opacity', 1.0),
            data.get('has_blink_control', False),
            data.get('blink_on_time', 0.5),
            data.get('blink_off_time', 0.5),
            data.get('element_comment', '')
        ))
        
        element_id = cursor.lastrowid
        
        # element_stateが指定されている場合（'on' or 'off' or null）
        element_state = data.get('element_state')
        if element_state:
            cursor.execute("""
                INSERT INTO element_states (element_id, state, image_asset_id)
                VALUES (?, ?, ?)
            """, (element_id, element_state, data.get('image_asset_id')))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'id': element_id,
            'group_id': data.get('group_id'),
            'x': x_pos,
            'y': y_pos
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========================================
# 画像アセット一覧取得API
# ========================================
@app.route('/api/image_assets', methods=['GET'])
def get_image_assets():
    """登録済み画像アセットの一覧を取得"""
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM image_assets ORDER BY id DESC")
        rows = cursor.fetchall()
        
        assets = [dict(row) for row in rows]
        
        conn.close()
        
        return jsonify(assets), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========================================
# グループ管理API
# ========================================
@app.route('/api/groups', methods=['GET'])
def get_groups():
    """グループ一覧を取得"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT * FROM groups 
            WHERE project_id = 1
            ORDER BY group_number
        """)
        
        rows = cursor.fetchall()
        groups = [dict(row) for row in rows]
        
        conn.close()
        
        return jsonify(groups), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/groups', methods=['POST'])
def create_group():
    """新しいグループを作成"""
    data = request.json
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 最大のgroup_numberを取得
        cursor.execute("SELECT MAX(group_number) FROM groups WHERE project_id = 1")
        max_number = cursor.fetchone()[0] or 0
        new_number = max_number + 1
        
        cursor.execute("""
            INSERT INTO groups (project_id, group_number, comment)
            VALUES (?, ?, ?)
        """, (1, new_number, data.get('comment', '')))
        
        group_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'id': group_id,
            'group_number': new_number
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/groups/<int:group_id>', methods=['PUT'])
def update_group(group_id):
    """グループを更新"""
    data = request.json
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE groups
            SET comment = ?
            WHERE id = ?
        """, (data.get('comment'), group_id))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/groups/<int:group_id>', methods=['DELETE'])
def delete_group(group_id):
    """グループを削除"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("DELETE FROM groups WHERE id = ?", (group_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========================================
# グループ要素管理API
# ========================================
@app.route('/api/groups/<int:group_id>/elements', methods=['GET'])
def get_group_elements(group_id):
    """グループの要素一覧を取得"""
    state = request.args.get('state', 'on')  # 'on' or 'off'
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 点滅制御がある場合はelement_statesから、ない場合はgroup_elementsから画像を取得
        cursor.execute("""
            SELECT 
                ge.*,
                CASE 
                    WHEN ge.has_blink_control = 1 THEN ia_state.file_path
                    ELSE ia_main.file_path
                END as file_path,
                CASE 
                    WHEN ge.has_blink_control = 1 THEN ia_state.width
                    ELSE ia_main.width
                END as image_width,
                CASE 
                    WHEN ge.has_blink_control = 1 THEN ia_state.height
                    ELSE ia_main.height
                END as image_height
            FROM group_elements ge
            LEFT JOIN element_states es ON ge.id = es.element_id AND es.state = ? AND ge.has_blink_control = 1
            LEFT JOIN image_assets ia_state ON es.image_asset_id = ia_state.id
            LEFT JOIN image_assets ia_main ON ge.image_asset_id = ia_main.id
            WHERE ge.group_id = ?
            ORDER BY ge.id
        """, (state, group_id))
        
        rows = cursor.fetchall()
        elements = [dict(row) for row in rows]
        
        conn.close()
        
        return jsonify(elements), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/elements/<int:element_id>', methods=['PUT'])
def update_element(element_id):
    """要素の位置・サイズ・表示先・コメントを更新"""
    data = request.json
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 更新するフィールドを動的に構築
        update_fields = []
        values = []
        
        # x/y も x_position/y_position として扱う
        if 'x_position' in data or 'x' in data:
            update_fields.append('x_position = ?')
            values.append(data.get('x_position', data.get('x', 0)))
        if 'y_position' in data or 'y' in data:
            update_fields.append('y_position = ?')
            values.append(data.get('y_position', data.get('y', 0)))
        if 'scale' in data:
            update_fields.append('scale = ?')
            values.append(data['scale'])
        if 'rotation' in data:
            update_fields.append('rotation = ?')
            values.append(data['rotation'])
        if 'display_target' in data:
            update_fields.append('display_target = ?')
            values.append(data['display_target'])
        if 'element_comment' in data:
            update_fields.append('element_comment = ?')
            values.append(data['element_comment'])
        
        if not update_fields:
            return jsonify({'error': '更新するフィールドがありません'}), 400
        
        values.append(element_id)
        
        sql = f"UPDATE group_elements SET {', '.join(update_fields)} WHERE id = ?"
        cursor.execute(sql, values)
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========================================
# プレビューウィンドウAPI
# ========================================
@app.route('/preview/<display_target>')
def preview_window(display_target):
    """プレビューウィンドウを表示"""
    return render_template('preview_window.html', display_target=display_target)


@app.route('/api/preview/elements', methods=['GET'])
def get_preview_elements():
    """プレビュー用の要素一覧を取得"""
    display_target = request.args.get('display_target', '')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 表示先に応じた要素を取得
        cursor.execute("""
            SELECT 
                ge.*,
                ia.file_path,
                ia.width,
                ia.height
            FROM group_elements ge
            LEFT JOIN image_assets ia ON ge.image_asset_id = ia.id
            WHERE ge.display_target = ? AND ge.element_type = 'image'
            ORDER BY ge.id
        """, (display_target,))
        
        rows = cursor.fetchall()
        elements = [dict(row) for row in rows]
        
        conn.close()
        
        return jsonify(elements), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/open_preview', methods=['POST'])
def open_preview():
    """プレビューウィンドウを開く"""
    data = request.json
    display_target = data.get('display_target', 'monitor')
    
    # JavaScriptのwindow.open()で開くためのURLを返す
    preview_url = f'/preview/{display_target}'
    
    return jsonify({
        'url': preview_url,
        'display_target': display_target
    }), 200


# ========================================
# ディスプレイ関連API
# ========================================
@app.route('/api/displays')
def get_displays():
    """接続されているディスプレイ一覧を取得"""
    try:
        monitors = get_monitors()
        display_list = []
        
        for i, monitor in enumerate(monitors):
            display_list.append({
                'id': i,
                'name': monitor.name,
                'x': monitor.x,
                'y': monitor.y,
                'width': monitor.width,
                'height': monitor.height,
                'is_primary': monitor.is_primary
            })
        
        return jsonify(display_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/move_cursor', methods=['POST'])
def move_cursor():
    """マウスカーソルを指定座標に移動"""
    try:
        data = request.json
        local_x = data['x']  # ディスプレイ内のローカル座標
        local_y = data['y']
        display_target = data['display_target']  # 'parts' or 'workbench'
        
        # ディスプレイマッピングを取得
        display_mapping = app.config.get('DISPLAY_MAPPING', {})
        
        # display_targetに対応するモニター情報を取得
        monitor = display_mapping.get(display_target)
        
        if not monitor:
            return jsonify({'error': f'Display {display_target} not found'}), 404
        
        # グローバル座標に変換
        absolute_x = monitor.x + local_x
        absolute_y = monitor.y + local_y
        
        # マウスを移動（0.2秒かけて滑らかに）
        pyautogui.moveTo(absolute_x, absolute_y, duration=0.2)
        
        return jsonify({
            'status': 'ok',
            'moved_to': {
                'local': {'x': local_x, 'y': local_y},
                'absolute': {'x': absolute_x, 'y': absolute_y}
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/display/<display_target>')
def display_window(display_target):
    """ディスプレイウィンドウのHTMLを返す"""
    return render_template('display_window.html', display_target=display_target)


@app.route('/api/display/elements/<display_target>')
def get_display_elements(display_target):
    """指定されたdisplay_targetの要素を取得（現在選択中のグループ）"""
    try:
        # 現在選択中のグループIDを取得（セッションまたはクエリパラメータから）
        group_id = request.args.get('group_id')
        
        if not group_id:
            # グループが選択されていない場合は空配列を返す
            return jsonify([])
        
        conn = get_db_connection()
        elements = conn.execute('''
            SELECT 
                ge.id,
                ge.x_position as x,
                ge.y_position as y,
                ge.scale,
                ia.width,
                ia.height,
                ia.file_path,
                es.state
            FROM group_elements ge
            JOIN image_assets ia ON ge.image_asset_id = ia.id
            LEFT JOIN element_states es ON ge.id = es.element_id
            WHERE ge.group_id = ? AND ge.display_target = ?
            ORDER BY ge.id
        ''', (group_id, display_target)).fetchall()
        conn.close()
        
        return jsonify([dict(elem) for elem in elements])
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)

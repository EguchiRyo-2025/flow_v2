from flask import Blueprint, render_template, send_from_directory, request, jsonify, current_app
from pathlib import Path
import sqlite3
import uuid
from PIL import Image
import pyautogui
from screeninfo import get_monitors

MODULE_DIR = Path(__file__).parent
TEMPLATES_DIR = MODULE_DIR / 'templates'
ASSETS_DIR = MODULE_DIR / 'assets'
IMAGES_DIR = ASSETS_DIR / 'images'

# url_prefix='/mapping' で登録されるため、ルートは相対パスで定義
mapping_bp = Blueprint('mapping_bp', __name__, 
                       template_folder='templates',
                       static_folder='static')

# ========================================
# ★ PostgreSQL移行時に変更する部分 ★
# ========================================
DB_PATH = MODULE_DIR / 'mapping_figure.db'  # SQLite用
# PostgreSQL用（将来）:
# import psycopg2
# DB_CONFIG = {...}

UPLOAD_FOLDER = IMAGES_DIR
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}

UPLOAD_FOLDER.mkdir(parents=True, exist_ok=True)


def get_db_connection():
    """データベース接続を取得"""
    # ========================================
    # ★ PostgreSQL移行時: この関数を変更 ★
    # ========================================
    conn = sqlite3.connect(str(DB_PATH))
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


# 実際のURL: /mapping/register
@mapping_bp.route('/register')
def index():
    return render_template('register_figure.html')


# 実際のURL: /mapping/preview
@mapping_bp.route('/preview')
def preview_default():
    """描画・音プレビュー画面（デフォルト表示）"""
    return render_template('preview_window.html', display_target='monitor')


@mapping_bp.route('/components/<path:filename>')
def serve_component(filename):
    """コンポーネントHTMLファイルを提供"""
    components_dir = TEMPLATES_DIR / 'components'
    return send_from_directory(str(components_dir), filename)


@mapping_bp.route('/media/<path:filename>')
def serve_media(filename):
    """メディアファイルを配信"""
    return send_from_directory(str(ASSETS_DIR), filename)


@mapping_bp.route('/api/debug-log', methods=['POST'])
def receive_debug_log():
    """フロントエンドからのデバッグログを受け取りサーバーログへ送出"""
    payload = request.get_json(silent=True) or {}
    level = str(payload.pop('level', 'info')).lower()
    message = payload.pop('message', '') or '[DisplayDebug] 受信ログ'

    logger = current_app.logger
    # if level == 'error':
    #     logger.error('%s | extra=%s', message, payload)
    # elif level == 'warning':
    #     logger.warning('%s | extra=%s', message, payload)
    # else:
    #     logger.info('%s | extra=%s', message, payload)

    return jsonify({'success': True})


# ========================================
# 画像アップロードAPI
# ========================================
@mapping_bp.route('/api/upload/image', methods=['POST'])
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
        ext = Path(file.filename).suffix.lower()
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = UPLOAD_FOLDER / unique_name
        
        # ファイルを保存
        file.save(str(file_path))
        
        # 画像サイズを取得
        with Image.open(str(file_path)) as img:
            width, height = img.size
        
        # MIMEタイプを取得
        mime_type = file.content_type or f'image/{ext[1:]}'
        
        # DBに保存するパスは相対パス（images/filename.ext）
        relative_path = f'images/{unique_name}'
        
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
        """, (relative_path, width, height, mime_type))
        
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
            'file_path': relative_path,
            'width': width,
            'height': height,
            'mime_type': mime_type
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========================================
# グループ要素追加API
# ========================================
@mapping_bp.route('/api/group_elements', methods=['POST'])
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
@mapping_bp.route('/api/image_assets', methods=['GET'])
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
@mapping_bp.route('/api/groups', methods=['GET'])
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


@mapping_bp.route('/api/groups', methods=['POST'])
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


@mapping_bp.route('/api/groups/<int:group_id>', methods=['PUT'])
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


@mapping_bp.route('/api/groups/<int:group_id>', methods=['DELETE'])
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
@mapping_bp.route('/api/groups/<int:group_id>/elements', methods=['GET'])
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


@mapping_bp.route('/api/elements/<int:element_id>', methods=['PUT'])
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


@mapping_bp.route('/api/elements/<int:element_id>', methods=['DELETE'])
def delete_element(element_id):
    """要素を削除"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # element_statesも削除（点滅制御用）
        cursor.execute("DELETE FROM element_states WHERE element_id = ?", (element_id,))
        
        # group_elementsから削除
        cursor.execute("DELETE FROM group_elements WHERE id = ?", (element_id,))
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========================================
# プレビューウィンドウAPI
# ========================================
@mapping_bp.route('/preview/<display_target>')
def preview_window(display_target):
    """プレビューウィンドウを表示"""
    return render_template('preview_window.html', display_target=display_target)


@mapping_bp.route('/api/preview/elements', methods=['GET'])
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


@mapping_bp.route('/api/open_preview', methods=['POST'])
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
@mapping_bp.route('/api/displays')
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


@mapping_bp.route('/api/move_cursor', methods=['POST'])
def move_cursor():
    """マウスカーソルを指定座標に移動"""
    try:
        data = request.json
        local_x = data['x']  # ディスプレイ内のローカル座標
        local_y = data['y']
        display_target = data['display_target']  # 'parts' or 'workbench'
        
        # ディスプレイマッピングを取得
        display_mapping = current_app.config.get('DISPLAY_MAPPING', {})
        
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


@mapping_bp.route('/display/<display_target>')
def display_window(display_target):
    """ディスプレイウィンドウのHTMLを返す"""
    return render_template('display_window.html', display_target=display_target)


@mapping_bp.route('/api/display/elements/<display_target>')
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


def create_app():
    """Standalone application factory for the mapping module."""
    from flask import Flask

    app = Flask(
        __name__,
        template_folder=str(TEMPLATES_DIR),
        static_folder=str(MODULE_DIR / 'static')
    )
    app.register_blueprint(mapping_bp)
    app.add_url_rule('/', 'mapping_index', index)
    return app


if __name__ == '__main__':
    create_app().run(debug=True, port=5000)

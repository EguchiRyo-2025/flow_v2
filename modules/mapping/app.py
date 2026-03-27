from flask import Blueprint, render_template, send_from_directory, request, jsonify, current_app
from pathlib import Path
import sqlite3
import uuid
from PIL import Image
import pyautogui
from screeninfo import get_monitors
import json

MODULE_DIR = Path(__file__).parent
TEMPLATES_DIR = MODULE_DIR / 'templates'
ASSETS_DIR = MODULE_DIR / 'assets'
IMAGES_DIR = ASSETS_DIR / 'images'
CONFIG_DIR = Path(__file__).parent.parent.parent / 'config'  # プロジェクトのconfig/ディレクトリ

# url_prefix='/mapping' で登録されるため、ルートは相対パスで定義
mapping_bp = Blueprint('mapping_bp', __name__, 
                       template_folder='templates',
                       static_folder='static',
                       static_url_path='/static/mapping')

# ========================================
# DB 初期化・マイグレーション実行
# ========================================
try:
    from .create_default_data import init_db
    print("[Mapping] DB 初期化と migration を実行中...")
    init_db()
    print("[Mapping] DB 初期化完了")
except Exception as e:
    print(f"[Mapping] DB 初期化エラー: {e}")

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


def load_projector_config():
    """プロジェクタ設定を読み込む"""
    config_file = CONFIG_DIR / 'projector_config.json'
    try:
        if config_file.exists():
            with open(config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        print(f"Warning: Failed to load projector config: {e}")
    
    # デフォルト設定を返す
    return {
        'projector_displays': {
            'monitor': {'resolution': {'width': 1920, 'height': 1080}},
            'parts': {'resolution': {'width': 1920, 'height': 1200}},
            'workbench': {'resolution': {'width': 1920, 'height': 1200}}
        },
        'coordinate_system': {
            'origin': 'top_left',
            'handedness': 'left',
            'units': 'pixels'
        }
    }


PROJECTOR_CONFIG = load_projector_config()


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


def get_projector_resolution(display_target):
    """指定されたdisplay_targetのプロジェクタ解像度を取得"""
    displays = PROJECTOR_CONFIG.get('projector_displays', {})
    display = displays.get(display_target, {})
    resolution = display.get('resolution', {'width': 1920, 'height': 1200})
    return resolution


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
    """グループに要素を追加（画像、多角形、矩形、テキスト対応）"""
    
    data = request.json
    element_type = data.get('element_type', 'image')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # xとyをx_position/y_positionに変換
        x_pos = data.get('x', data.get('x_position', 0))
        y_pos = data.get('y', data.get('y_position', 0))
        
        # shape_dataをJSONとしてシリアライズ
        shape_data = None
        if element_type in ['polygon', 'rectangle', 'arrow']:
            shape_data_dict = data.get('shape_data', {})
            import json as json_module
            shape_data = json_module.dumps(shape_data_dict) if shape_data_dict else None
        
        # image_asset_id: 画像の場合のみ使用、図形の場合は NULL
        image_asset_id = None
        if element_type == 'image':
            image_asset_id = data.get('image_asset_id')
        
        # グループ要素を追加
        cursor.execute("""
            INSERT INTO group_elements (
                group_id, element_type, image_asset_id,
                display_target, x_position, y_position,
                scale, rotation, opacity,
                has_blink_control, blink_on_time, blink_off_time,
                element_comment, polygon_points, text_content,
                text_font_size, text_color, text_bg_color,
                shape_type, shape_data, stroke_color, fill_color, stroke_width
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get('group_id'),
            element_type,
            image_asset_id,
            data.get('display_target', ''),
            x_pos,
            y_pos,
            data.get('scale', 1.0),
            data.get('rotation', 0.0),
            data.get('opacity', 1.0),
            data.get('has_blink_control', False),
            data.get('blink_on_time', 0.5),
            data.get('blink_off_time', 0.5),
            data.get('element_comment', ''),
            data.get('polygon_points') if element_type == 'polygon' else None,
            data.get('text_content') if element_type == 'text' else None,
            data.get('text_font_size', 16) if element_type == 'text' else 16,
            data.get('text_color', '#000000') if element_type == 'text' else '#000000',
            data.get('text_bg_color', '#FFFFFF') if element_type == 'text' else '#FFFFFF',
            data.get('shape_type') if element_type in ['polygon', 'rectangle', 'arrow'] else None,
            shape_data,
            data.get('stroke_color', '#000000') if element_type in ['polygon', 'rectangle', 'arrow'] else None,
            data.get('fill_color', '#FFFFFF') if element_type in ['polygon', 'rectangle', 'arrow'] else None,
            data.get('stroke_width', 2) if element_type in ['polygon', 'rectangle', 'arrow'] else None
        ))
        
        element_id = cursor.lastrowid
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'id': element_id,
            'group_id': data.get('group_id'),
            'element_type': element_type,
            'x': x_pos,
            'y': y_pos,
            'shape_type': data.get('shape_type') if element_type in ['polygon', 'rectangle', 'arrow'] else None
        }), 200
        
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"[API Error] add_group_element エラー:\n{error_msg}")
        return jsonify({'error': str(e), 'traceback': error_msg}), 500


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
    """グループを削除してgroup_numberを詰める"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 削除するグループの project_id を取得
        cursor.execute("SELECT project_id FROM groups WHERE id = ?", (group_id,))
        result = cursor.fetchone()
        if not result:
            return jsonify({'error': 'グループが見つかりません'}), 404
        
        project_id = result[0]
        
        # グループを削除
        cursor.execute("DELETE FROM groups WHERE id = ?", (group_id,))
        
        # 同じプロジェクトの他のグループの group_number を詰める
        cursor.execute(
            "SELECT id, group_number FROM groups WHERE project_id = ? ORDER BY group_number ASC",
            (project_id,)
        )
        groups = cursor.fetchall()
        
        # group_number を 1 から順に振り直す
        for idx, (gid, _) in enumerate(groups, start=1):
            cursor.execute(
                "UPDATE groups SET group_number = ? WHERE id = ?",
                (idx, gid)
            )
        
        conn.commit()
        conn.close()
        
        return jsonify({'success': True, 'message': 'グループを削除し、番号を詰めました'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ========================================
# グループ要素管理API
# ========================================
@mapping_bp.route('/api/groups/<int:group_id>/elements/list', methods=['GET'])
def get_group_elements_list(group_id):
    """グループの全要素一覧を取得（テーブル表示用）"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 要素テーブル表示用：全要素を取得
        cursor.execute("""
            SELECT 
                ge.id,
                ge.element_type,
                ge.element_comment,
                ge.x_position,
                ge.y_position,
                ge.scale,
                ge.rotation,
                ge.opacity,
                ge.display_target,
                ge.stroke_color,
                ge.fill_color,
                ge.stroke_width,
                COALESCE(ia.file_path, '') as image_path,
                ge.polygon_points,
                ge.text_content,
                ge.created_at
            FROM group_elements ge
            LEFT JOIN image_assets ia ON ge.image_asset_id = ia.id
            WHERE ge.group_id = ?
            ORDER BY ge.display_target, ge.element_type, ge.id
        """, (group_id,))
        
        rows = cursor.fetchall()
        elements = [dict(row) for row in rows]
        
        conn.close()
        
        return jsonify(elements), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
    """要素の位置・サイズ・表示先・コメント・多角形・テキストを更新"""
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
        if 'opacity' in data:
            update_fields.append('opacity = ?')
            values.append(data['opacity'])
        if 'display_target' in data:
            update_fields.append('display_target = ?')
            values.append(data['display_target'])
        if 'element_comment' in data:
            update_fields.append('element_comment = ?')
            values.append(data['element_comment'])
        if 'element_type' in data:
            update_fields.append('element_type = ?')
            values.append(data['element_type'])
        if 'polygon_points' in data:
            update_fields.append('polygon_points = ?')
            values.append(data['polygon_points'])
        if 'text_content' in data:
            update_fields.append('text_content = ?')
            values.append(data['text_content'])
        if 'text_font_size' in data:
            update_fields.append('text_font_size = ?')
            values.append(data['text_font_size'])
        if 'text_color' in data:
            update_fields.append('text_color = ?')
            values.append(data['text_color'])
        if 'text_bg_color' in data:
            update_fields.append('text_bg_color = ?')
            values.append(data['text_bg_color'])
        if 'shape_type' in data:
            update_fields.append('shape_type = ?')
            values.append(data['shape_type'])
        if 'shape_data' in data:
            import json as json_module
            shape_data = json_module.dumps(data['shape_data']) if isinstance(data['shape_data'], dict) else data['shape_data']
            update_fields.append('shape_data = ?')
            values.append(shape_data)
        if 'stroke_color' in data:
            update_fields.append('stroke_color = ?')
            values.append(data['stroke_color'])
        if 'fill_color' in data:
            update_fields.append('fill_color = ?')
            values.append(data['fill_color'])
        if 'stroke_width' in data:
            update_fields.append('stroke_width = ?')
            values.append(data['stroke_width'])
        
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


@mapping_bp.route('/display/monitor')
def display_monitor():
    """メイン画面用ディスプレイウィンドウ (1920x1080)"""
    return render_template('monitor_display.html')


@mapping_bp.route('/display/parts')
def display_parts():
    """部品棚用ディスプレイウィンドウ (1920x1200)"""
    return render_template('parts_display.html')


@mapping_bp.route('/display/workbench')
def display_workbench():
    """作業台用ディスプレイウィンドウ (1920x1200)"""
    return render_template('workbench_display.html')


# 互換性のため旧ルートも残す
@mapping_bp.route('/display/<display_target>')
def display_window(display_target):
    """ディスプレイウィンドウのHTMLを返す（互換性用）"""
    if display_target == 'monitor':
        return render_template('monitor_display.html')
    elif display_target == 'parts':
        return render_template('parts_display.html')
    elif display_target == 'workbench':
        return render_template('workbench_display.html')
    else:
        return render_template('monitor_display.html')


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

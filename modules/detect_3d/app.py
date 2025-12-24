from flask import Blueprint, render_template, Response, request, jsonify, g
from pathlib import Path
from .camera.depth_image import (
    generate_depth,
    register_origin_logic,
    detect_object_pixels_in_area,
)
from .camera.RGB_image import generate_rgb
from .camera.camera_manager import camera_manager
import json
import atexit
import threading

MODULE_DIR = Path(__file__).parent
DEBUG_DIR = MODULE_DIR / 'debug'
ORIGIN_DATA_FILE = DEBUG_DIR / 'origin_data.json'

DEBUG_DIR.mkdir(parents=True, exist_ok=True)

# url_prefix='/detection' で登録されるため、ルートは相対パスで定義
detection_bp = Blueprint('detection_bp', __name__, 
                         template_folder='templates',
                         static_folder='static')

# アクティブなストリームを追跡
active_streams = {'rgb': 0, 'depth': 0}
stream_lock = threading.Lock()

# アプリケーション終了時にカメラリソースをクリーンアップ
@atexit.register
def cleanup():
    camera_manager.cleanup()

@detection_bp.before_request
def before_request():
    """リクエスト前処理 - カメラリソース初期化"""
    g.camera_active = True

# teardown_requestは無効化 - ページ遷移時のJavaScript側のクリーンアップで対応
# @detection_bp.teardown_request
# def teardown_request(exception=None):
#     """リクエスト後処理 - 不要なリソース解放"""
#     pass

# 実際のURL: /detection/origin
@detection_bp.route('/origin')
def detection_origin():
    return render_template('set_3D_origin.html')

# 実際のURL: /detection/detect
@detection_bp.route('/detect')
def detect_3d():
    return render_template('detect_3D.html')

@detection_bp.route('/stream/rgb')
def stream_rgb():
    with stream_lock:
        active_streams['rgb'] += 1
    try:
        return Response(generate_rgb(), mimetype='multipart/x-mixed-replace; boundary=frame')
    finally:
        with stream_lock:
            active_streams['rgb'] -= 1
            # ストリームは常に実行し続ける

@detection_bp.route('/stream/depth')
def stream_depth():
    with stream_lock:
        active_streams['depth'] += 1
    try:
        return Response(generate_depth(), mimetype='multipart/x-mixed-replace; boundary=frame')
    finally:
        with stream_lock:
            active_streams['depth'] -= 1
            # ストリームは常に実行し続ける

@detection_bp.route('/cleanup', methods=['POST'])
def cleanup_camera():
    """カメラリソースを明示的にクリーンアップ"""
    import time
    try:
        print("カメラクリーンアップリクエスト受信")
        
        with stream_lock:
            active_streams['rgb'] = 0
            active_streams['depth'] = 0
        
        # カメラのニーズフラグをリセット
        camera_manager._need_rgb = False
        camera_manager._need_depth = False
        
        # 少し待機してストリームが完全に停止するのを待つ
        time.sleep(0.3)
        
        print("カメラクリーンアップ完了")
        return jsonify({'success': True, 'message': 'Camera resources cleaned up'})
    except Exception as e:
        print(f"カメラクリーンアップエラー: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@detection_bp.route('/register_origin', methods=['POST'])
def register_origin():
    data = request.get_json()
    print(f"受信データ: {data}")  # デバッグ用
    origin_no = data.get('origin_No')
    points = data.get('point') 
    comment = data.get('comment', '')
    print(f"points: {points}, type: {type(points)}")  # デバッグ用

    # JSON保存
    if ORIGIN_DATA_FILE.exists():
        with ORIGIN_DATA_FILE.open('r', encoding='utf-8') as file:
            try:
                existing_data = json.load(file)
                if not isinstance(existing_data, list):
                    existing_data = []
            except json.JSONDecodeError:
                existing_data = []
    else:
        existing_data = []

    # 編集時は同じNoを削除
    if origin_no is not None:
        existing_data = [d for d in existing_data if str(d.get('No')) != str(origin_no)]

    # 新しいNoを決定（連番強制、歯抜け禁止）
    if not existing_data:
        # データが空の場合は1から開始
        new_no = 1
    else:
        # 既存のNoをソートして連番になっているかチェック
        existing_nos = sorted([d.get('No', 0) for d in existing_data])
        
        # 連番チェック（1から始まって途切れていないか）
        for i, no in enumerate(existing_nos):
            if no != i + 1:
                return jsonify({"error": f"原点番号に歯抜けがあります。No.{i+1}が見つかりません。"})
        
        # 連番が正常な場合、次の番号を割り当て
        new_no = existing_nos[-1] + 1
    
    if not (isinstance(points, list) and len(points) == 4 and 
            all(isinstance(p, list) and len(p) == 2 for p in points)):
        return jsonify({"error": "4つの座標点 [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] 形式で送信してください"})
    
    print(f"受信した4つの点: {points}")  # デバッグ用
    depth_result = register_origin_logic(points)

    
    # エラーチェック
    if isinstance(depth_result, dict) and 'error' in depth_result:
        return jsonify(depth_result)
    
    origin_data = {
        "No": new_no,
        "points": points,
        "depth": {
            "depth_min": depth_result.get("depth_min"),
            "depth_max": depth_result.get("depth_max")
        },
        "comment": comment,
        "judge_settings": {
            "judge1": {
                "pixel_min": None,
                "pixel_max": None,
                "detect_time": 0.0,
                "comment": ""
            },
            "judge2": {
                "pixel_min": None,
                "pixel_max": None,
                "detect_time": 0.0,
                "comment": ""
            },
            "judge3": {
                "pixel_min": None,
                "pixel_max": None,
                "detect_time": 0.0,
                "comment": ""
            }
        }
    }
    existing_data.append(origin_data)

    with ORIGIN_DATA_FILE.open('w', encoding='utf-8') as file:
        json.dump(existing_data, file, ensure_ascii=False, indent=2)

    return jsonify({"message": "原点登録成功", "data": origin_data})

@detection_bp.route('/api/get_origins', methods=['GET'])
def get_origins():
    """登録された原点データを取得"""
    if ORIGIN_DATA_FILE.exists():
        with ORIGIN_DATA_FILE.open('r', encoding='utf-8') as file:
            try:
                origins = json.load(file)
                return jsonify({"origins": origins})
            except json.JSONDecodeError:
                return jsonify({"origins": []})
    else:
        return jsonify({"origins": []})

@detection_bp.route('/api/delete_origin/<int:origin_no>', methods=['DELETE'])
def delete_origin(origin_no):
    """指定された原点を削除"""
    if not ORIGIN_DATA_FILE.exists():
        return jsonify({"error": "原点データファイルが見つかりません"}), 404
    
    try:
        with ORIGIN_DATA_FILE.open('r', encoding='utf-8') as file:
            origins = json.load(file)
        
        # 削除する原点を探す
        origin_to_delete = None
        for i, origin in enumerate(origins):
            if origin.get('No') == origin_no:
                origin_to_delete = origins.pop(i)
                break
        
        if origin_to_delete is None:
            return jsonify({"error": f"原点No.{origin_no}が見つかりません"}), 404
        
        # 削除後の原点のNoを振り直し（連番を維持）
        for i, origin in enumerate(origins):
            origin['No'] = i + 1
        
        # ファイルに保存
        with ORIGIN_DATA_FILE.open('w', encoding='utf-8') as file:
            json.dump(origins, file, ensure_ascii=False, indent=2)
        
        return jsonify({"success": True, "message": f"原点No.{origin_no}を削除しました"})
        
    except Exception as e:
        return jsonify({"error": f"削除エラー: {e}"}), 500

@detection_bp.route('/api/detect_3d', methods=['POST'])
def api_detect_3d():
    """3D検知API"""
    if not ORIGIN_DATA_FILE.exists():
        return jsonify({"error": "原点データが見つかりません"})
    
    try:
        with ORIGIN_DATA_FILE.open('r', encoding='utf-8') as file:
            origin_data = json.load(file)
        
        if not origin_data:
            return jsonify({"error": "登録された原点がありません"})
        
        # 現在は3D検知画面でリアルタイム監視を実装済み
        return jsonify({"success": True, "message": "3D検知画面でリアルタイム監視をご利用ください"})
        
    except Exception as e:
        return jsonify({"error": f"3D検知エラー: {e}"})

@detection_bp.route('/api/count_pixels', methods=['POST'])
def api_count_pixels():
    """リアルタイムピクセルカウントAPI"""
    try:
        data = request.get_json()
        print(f"受信したピクセルカウント要求: {data}")  # デバッグログ
        
        points = data.get('points')
        depth_min = data.get('depth_min')
        depth_max = data.get('depth_max')
        
        if not points or depth_min is None or depth_max is None:
            print("パラメータ不足エラー")  # デバッグログ
            return jsonify({"error": "必要なパラメータが不足しています"})
        
        # 4つの点から矩形の範囲を計算
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        x1, x2 = min(x_coords), max(x_coords)
        y1, y2 = min(y_coords), max(y_coords)
        
        print(f"計算した矩形範囲: x1={x1}, y1={y1}, x2={x2}, y2={y2}, depth_min={depth_min}, depth_max={depth_max}")  # デバッグログ
        
        # ピクセルカウント関数を呼び出し
        result = detect_object_pixels_in_area(x1, y1, x2, y2, depth_min, depth_max)
        print(f"ピクセルカウント結果: {result}")  # デバッグログ
        
        if 'error' in result:
            return jsonify(result)
        
        pixel_count = result.get("pixel_count", 0)
        print(f"返すピクセル数: {pixel_count}")  # デバッグログ
        
        return jsonify({"pixel_count": pixel_count})
        
    except Exception as e:
        print(f"ピクセルカウントAPI例外エラー: {e}")  # デバッグログ
        return jsonify({"error": f"ピクセルカウントエラー: {e}"})

@detection_bp.route('/api/save_judge_data', methods=['POST'])
def api_save_judge_data():
    """判定テーブルの編集内容をJSONに保存するAPI"""
    try:
        data = request.get_json()
        print(f"受信した保存要求: {data}")
        
        origin_no = data.get('origin_no')
        judge_data = data.get('judge_data')  # 判定データのリスト
        
        if origin_no is None or not judge_data:
            return jsonify({"error": "必要なパラメータが不足しています"})
        
        # JSONファイルを更新
        if ORIGIN_DATA_FILE.exists():
            with ORIGIN_DATA_FILE.open('r', encoding='utf-8') as file:
                origin_data = json.load(file)
        else:
            return jsonify({"error": "原点データファイルが見つかりません"})
        
        # 該当する原点を検索して更新
        updated = False
        for origin in origin_data:
            if origin.get('No') == origin_no:
                # judge_settings を初期化（存在しない場合）
                if 'judge_settings' not in origin:
                    origin['judge_settings'] = {}
                
                # 各判定データを更新
                for judge_item in judge_data:
                    judge_no = judge_item.get('judge_no')
                    pixel_min = judge_item.get('pixel_min')
                    pixel_max = judge_item.get('pixel_max')
                    detect_time = judge_item.get('detect_time')
                    comment = judge_item.get('comment', '')
                    
                    judge_key = f"judge{judge_no}"
                    origin['judge_settings'][judge_key] = {
                        "pixel_min": int(pixel_min) if pixel_min else None,
                        "pixel_max": int(pixel_max) if pixel_max else None,
                        "detect_time": float(detect_time) if detect_time else 0.0,
                        "comment": comment
                    }
                
                updated = True
                print(f"原点{origin_no}の判定設定を更新: {origin['judge_settings']}")
                break
        
        if not updated:
            return jsonify({"error": f"原点No.{origin_no}が見つかりません"})
        
        # ファイルに保存
        with ORIGIN_DATA_FILE.open('w', encoding='utf-8') as file:
            json.dump(origin_data, file, ensure_ascii=False, indent=2)
        
        return jsonify({"success": True, "message": "判定設定を保存しました"})
        
    except Exception as e:
        print(f"判定設定保存API例外エラー: {e}")
        return jsonify({"error": f"保存エラー: {e}"})

@detection_bp.route('/api/capture_pixel_range', methods=['POST'])
def api_capture_pixel_range():
    """5フレーム計測してピクセル範囲を取得するAPI"""
    try:
        data = request.get_json()
        print(f"受信した5フレーム計測要求: {data}")
        
        origin_no = data.get('origin_no')
        judge_no = data.get('judge_no')
        points = data.get('points')
        depth_min = data.get('depth_min')
        depth_max = data.get('depth_max')
        
        if origin_no is None or judge_no is None or not points or depth_min is None or depth_max is None:
            return jsonify({"error": "必要なパラメータが不足しています"})
        
        # 4つの点から矩形の範囲を計算
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        x1, x2 = min(x_coords), max(x_coords)
        y1, y2 = min(y_coords), max(y_coords)
        
        print(f"5フレーム計測開始: 原点{origin_no}, 判定{judge_no}")
        
        # 5フレーム計測
        pixel_counts = []
        import time
        
        for frame in range(5):
            result = detect_object_pixels_in_area(x1, y1, x2, y2, depth_min, depth_max)
            if 'error' in result:
                print(f"フレーム{frame+1}でエラー: {result['error']}")
                continue
                
            pixel_count = result.get("pixel_count", 0)
            pixel_counts.append(pixel_count)
            print(f"フレーム{frame+1}: {pixel_count}ピクセル")
            
            # フレーム間隔（100ms）
            time.sleep(0.1)
        
        if not pixel_counts:
            return jsonify({"error": "有効なフレームデータを取得できませんでした"})
        
        # 最小値と最大値を計算
        pixel_min = min(pixel_counts) 
        pixel_max = max(pixel_counts) 
                
        print(f"計測結果: pixel_min={pixel_min}, pixel_max={pixel_max}")
        
        # JSONファイルを更新
        if ORIGIN_DATA_FILE.exists():
            with ORIGIN_DATA_FILE.open('r', encoding='utf-8') as file:
                origin_data = json.load(file)
        else:
            return jsonify({"error": "原点データファイルが見つかりません"})
        
        # 該当する原点を検索して更新
        updated = False
        for origin in origin_data:
            if origin.get('No') == origin_no:
                # judge_settings を初期化（存在しない場合）
                if 'judge_settings' not in origin:
                    origin['judge_settings'] = {}
                
                # judge_settingsに直接保存（上書き）
                judge_key = f"judge{judge_no}"
                if judge_key not in origin['judge_settings']:
                    origin['judge_settings'][judge_key] = {
                        "pixel_min": None,
                        "pixel_max": None,
                        "detect_time": 0.0,
                        "comment": ""
                    }
                
                # 計測結果で上書き
                origin['judge_settings'][judge_key]['pixel_min'] = pixel_min
                origin['judge_settings'][judge_key]['pixel_max'] = pixel_max
                
                updated = True
                print(f"原点{origin_no}のjudge{judge_no}を更新: {origin['judge_settings'][judge_key]}")
                break
        
        if not updated:
            return jsonify({"error": f"原点No.{origin_no}が見つかりません"})
        
        # ファイルに保存
        with ORIGIN_DATA_FILE.open('w', encoding='utf-8') as file:
            json.dump(origin_data, file, ensure_ascii=False, indent=2)
        
        return jsonify({
            "success": True,
            "pixel_min": pixel_min,
            "pixel_max": pixel_max,
            "frame_counts": pixel_counts
        })
        
    except Exception as e:
        print(f"5フレーム計測API例外エラー: {e}")
        return jsonify({"error": f"5フレーム計測エラー: {e}"})


def create_app():
    """Standalone application factory for legacy usage."""
    from flask import Flask

    app = Flask(__name__)
    app.register_blueprint(detection_bp)
    return app


if __name__ == '__main__':
    create_app().run(debug=True)
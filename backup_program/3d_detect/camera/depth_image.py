import cv2
import numpy as np
import os
from dotenv import load_dotenv
from camera.camera_manager import camera_manager
import json

load_dotenv()

OPENNI_PATH = os.environ['OPENNI_PATH']

def _get_current_depth_frame():
    """カメラマネージャーから深度フレームを取得"""
    return camera_manager.get_depth_frame()

def generate_depth():
    """深度画像を生成するジェネレータ関数"""
    while True:
        try:
            depth_data = _get_current_depth_frame()
            if depth_data is None:
                # エラー画像を生成
                error_img = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(error_img, "Depth Camera Not Found", (120, 200), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                cv2.putText(error_img, "Please connect camera", (100, 250), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
                ret, jpeg = cv2.imencode('.jpg', error_img)
                if ret:
                    frame_bytes = jpeg.tobytes()
                    yield (b'--frame\r\n'
                          b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                continue
            
            # 深度データを8ビット画像に変換（生データのまま処理）
            img8 = cv2.convertScaleAbs(depth_data, alpha=0.05)
            depth_colormap = cv2.applyColorMap(img8, cv2.COLORMAP_JET)
            
            # 左右反転を修正（映像表示用）
            depth_colormap_flipped = cv2.flip(depth_colormap, 1)
            
            # JPEG形式にエンコード
            ret, buffer = cv2.imencode('.jpg', depth_colormap_flipped)
            if ret:
                frame = buffer.tobytes()
                yield (b'--frame\r\n'
                      b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            
        except Exception as e:
            print(f"深度画像生成エラー: {e}")
            # エラー時の画像を送信
            error_img = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(error_img, f"Error: {str(e)[:30]}", (50, 240), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            ret, jpeg = cv2.imencode('.jpg', error_img)
            if ret:
                frame_bytes = jpeg.tobytes()
                yield (b'--frame\r\n'
                      b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

def register_origin_logic(points):
    """原点登録のロジック - 四角形エリア内の深度データからdepth_min, depth_maxを計算"""
    try:
        depth_data = _get_current_depth_frame()
        if depth_data is None:
            return {"error": "深度データを取得できませんでした"}
        
        # 4つの点から矩形の範囲を計算
        x_coords = [p[0] for p in points]
        y_coords = [p[1] for p in points]
        x_min, x_max = min(x_coords), max(x_coords)
        y_min, y_max = min(y_coords), max(y_coords)
        
        # 矩形エリア内の深度データを取得
        area_depth = depth_data[y_min:y_max+1, x_min:x_max+1]

        print(f"area_depth shape: {area_depth.shape}")
        
        if len(area_depth) == 0:
            return {"error": "指定エリアに有効な深度情報がありません"}
        
        # 有効な深度データのみを抽出（0でない値）
        valid_depths = area_depth[area_depth > 0]
        
        if len(valid_depths) == 0:
            return {"error": "指定エリアに有効な深度情報がありません"}
        
        # 平均と標準偏差を計算して範囲を設定
        mean_depth = np.mean(valid_depths)
        std_depth = np.std(valid_depths)
        
        # depth_min = 平均 - 標準偏差, depth_max = 平均 + 標準偏差
        depth_min = int(mean_depth - std_depth)
        depth_max = int(mean_depth + std_depth)
        
        # 負の値にならないよう調整
        depth_min = max(0, depth_min)
        
        print(f"計算結果: mean={mean_depth:.1f}, std={std_depth:.1f}, range=[{depth_min}, {depth_max}]")
        
        # 指定された形式で返却（明示的にPython intに変換）
        result = {
            "depth_min": int(depth_min),  # 確実にPython intに変換
            "depth_max": int(depth_max)   # 確実にPython intに変換
        }
        
        return result
        
    except Exception as e:
        return {"error": f"原点登録エラー: {e}"}


def detect_object_pixels_in_area(x1, y1, x2, y2, min_depth, max_depth):
    """指定領域内でオブジェクトのピクセル数を検出（生データ処理）"""
    try:
        depth_data = _get_current_depth_frame()
        if depth_data is None:
            return {"error": "深度データを取得できませんでした"}
        
        # エリアを正規化
        x_min, x_max = min(x1, x2), max(x1, x2)
        y_min, y_max = min(y1, y2), max(y1, y2)
        
        # 範囲チェック
        x_min = max(0, x_min)
        x_max = min(639, x_max)
        y_min = max(0, y_min)
        y_max = min(479, y_max)
        
        # 指定エリアの深度データを抽出
        area_depth = depth_data[y_min:y_max+1, x_min:x_max+1]
        
        # 指定深度範囲内のピクセル数をカウント
        valid_pixels = np.logical_and(
            np.logical_and(area_depth >= min_depth, area_depth <= max_depth),
            area_depth > 0  # 有効な深度データのみ
        )
        pixel_count = np.sum(valid_pixels)
        
        total_area = (x_max - x_min + 1) * (y_max - y_min + 1)
        
        return {
            "pixel_count": int(pixel_count),
            "area_size": total_area,
            "detection_ratio": float(pixel_count) / total_area if total_area > 0 else 0.0
        }
        
    except Exception as e:
        return {"error": f"検出エラー: {e}"}

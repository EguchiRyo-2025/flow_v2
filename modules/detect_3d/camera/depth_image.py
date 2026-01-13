import cv2
import numpy as np
import json
import logging


# ロガー設定
logger = logging.getLogger(__name__)

def _get_camera_manager():
    """Flask current_app から camera_manager を取得
    
    フロー実行スレッド内などでも、常に同じシングルトンインスタンスを取得するため、
    current_app から取得する（core/app.pyでアタッチされている）
    """
    try:
        from flask import current_app
        if hasattr(current_app, 'camera_manager'):
            return current_app.camera_manager
    except RuntimeError:
        # Flask コンテキスト外の場合は、絶対インポートで取得
        pass
    
    # フォールバック: 絶対インポート（フロー実行スレッド内対応）
    try:
        # フロー実行スレッド内では相対インポートが失敗する可能性があるため、絶対インポートを使用
        from modules.detect_3d.camera.camera_manager import camera_manager
        return camera_manager
    except Exception as e:
        logger.warning(f"Absolute import failed, trying direct relative import: {e}")
        try:
            from .camera_manager import camera_manager
            return camera_manager
        except Exception as e2:
            logger.error(f"Failed to get camera_manager: {e2}")
            return None

def _get_current_depth_frame():
    """カメラマネージャーから深度フレームを取得"""
    camera_manager = _get_camera_manager()
    if camera_manager is None:
        logger.warning("[_get_current_depth_frame] camera_manager is None")
        return None
    try:
        depth_frame = camera_manager.get_depth_frame()
        if depth_frame is None:
            logger.debug(f"[_get_current_depth_frame] No frame available (camera_initialized={getattr(camera_manager, '_camera_initialized', 'unknown')}, capture_running={getattr(camera_manager, '_capture_running', 'unknown')})")
        return depth_frame
    except Exception as e:
        logger.error(f"[_get_current_depth_frame] Error: {e}", exc_info=True)
        return None

def generate_depth():
    """深度画像を生成するジェネレータ関数（クライアント接続中のみ実行）"""
    import time
    try:
        while True:
            try:
                depth_data = _get_current_depth_frame()
                if depth_data is None:
                    # エラー画像を生成（カメラ初期化中または未接続）
                    error_img = np.zeros((480, 640, 3), dtype=np.uint8)
                    cv2.putText(error_img, "Depth Camera Initializing...", (80, 200), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.9, (255, 255, 255), 2)
                    cv2.putText(error_img, "Please wait or connect camera", (60, 250), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
                    ret, jpeg = cv2.imencode('.jpg', error_img)
                    if ret:
                        frame_bytes = jpeg.tobytes()
                        yield (b'--frame\r\n'
                              b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                    time.sleep(0.1)  # エラー時も少し待機して再試行
                    continue
                
                # 深度データを8ビット画像に変換（生データのまま処理）
                img8 = cv2.convertScaleAbs(depth_data, alpha=0.05)
                depth_colormap = cv2.applyColorMap(img8, cv2.COLORMAP_JET)
                
                # 左右反転を修正（映像表示用）
                depth_colormap_flipped = cv2.flip(depth_colormap, 1)
                
                # JPEG形式にエンコード
                ret, buffer = cv2.imencode('.jpg', depth_colormap_flipped, [cv2.IMWRITE_JPEG_QUALITY, 85])
                if ret:
                    frame = buffer.tobytes()
                    # クライアントが切断された場合、yieldが例外を投げる可能性がある
                    yield (b'--frame\r\n'
                          b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                
                # 30fpsを上限にする程度の待機（フレーム更新を確実にする）
                time.sleep(0.033)  # 約30fps
                
            except GeneratorExit:
                # クライアントが切断された
                print("深度ストリーム: クライアント切断を検知、ストリームを終了します")
                break
            except StopIteration:
                # ジェネレータが終了
                print("深度ストリーム: ストリームを終了します")
                break
            except Exception as e:
                # その他のエラー（クライアント切断の可能性も含む）
                error_str = str(e).lower()
                if 'broken pipe' in error_str or 'connection' in error_str or 'client' in error_str:
                    print(f"深度ストリーム: クライアント切断を検知: {e}")
                    break
                print(f"深度画像生成エラー: {e}")
                # エラー時の画像を送信
                try:
                    error_img = np.zeros((480, 640, 3), dtype=np.uint8)
                    cv2.putText(error_img, f"Error: {str(e)[:30]}", (50, 240), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                    ret, jpeg = cv2.imencode('.jpg', error_img)
                    if ret:
                        frame_bytes = jpeg.tobytes()
                        yield (b'--frame\r\n'
                              b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                except (GeneratorExit, StopIteration):
                    break
    finally:
        # 注意: カメラは常駐しているため、何もしない
        print("深度ストリーム: クライアント切断")

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
        mean_depth = float(np.mean(valid_depths))
        std_depth = float(np.std(valid_depths))
        
        # depth_min = 平均 - 標準偏差 - 50, depth_max = 平均 + 標準偏差 + 100（判定を緩くする）
        depth_min = int(mean_depth - std_depth - 100)
        depth_max = int(mean_depth + std_depth + 100)
        
        # 負の値にならないよう調整
        depth_min = max(0, depth_min)
        
        print(f"計算結果: mean={mean_depth:.1f}, std={std_depth:.1f}, range=[{depth_min}, {depth_max}] (std±50)")
        
        # 指定された形式で返却（明示的にPython intに変換）
        result = {
            "depth_min": int(depth_min),  # 確実にPython intに変換
            "depth_max": int(depth_max)   # 確実にPython intに変換
        }
        
        return result
        
    except Exception as e:
        print(f"原点登録エラーの詳細: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"原点登録エラー: {e}"}


def detect_object_pixels_in_area(x1, y1, x2, y2, min_depth, max_depth):
    """指定領域内でオブジェクトのピクセル数を検出（生データ処理）"""
    try:
        depth_data = _get_current_depth_frame()
        if depth_data is None:
            logger.warning(f"[detect_object_pixels_in_area] Failed to get depth frame for area ({x1},{y1})-({x2},{y2})")
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

import cv2
import numpy as np
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

def _get_current_rgb_frame():
    """カメラマネージャーからRGBフレームを取得"""
    try:
        camera_manager = _get_camera_manager()
        if camera_manager is None:
            logger.warning("[_get_current_rgb_frame] camera_manager is None")
            return None
        return camera_manager.get_rgb_frame()
    except Exception as e:
        logger.error(f"[_get_current_rgb_frame] Error: {e}", exc_info=True)
        return None

def generate_rgb():
    """RGB画像を生成するジェネレータ関数（クライアント接続中のみ実行）"""
    import time
    import traceback
    try:
        print("[generate_rgb] 開始")
        while True:
            try:
                rgb_data = _get_current_rgb_frame()
                if rgb_data is None:
                    # エラー画像を生成（カメラ初期化中または未接続）
                    error_img = np.zeros((480, 640, 3), dtype=np.uint8)
                    cv2.putText(error_img, "RGB Camera Initializing...", (80, 200), 
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
                
                # 左右反転を修正（映像表示用）
                rgb_data_flipped = cv2.flip(rgb_data, 1)
                
                # JPEG形式にエンコード
                ret, buffer = cv2.imencode('.jpg', rgb_data_flipped, [cv2.IMWRITE_JPEG_QUALITY, 85])
                if ret:
                    frame = buffer.tobytes()
                    # クライアントが切断された場合、yieldが例外を投げる可能性がある
                    yield (b'--frame\r\n'
                          b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
                
                # 30fpsを上限にする程度の待機（フレーム更新を確実にする）
                time.sleep(0.033)  # 約30fps
                
            except GeneratorExit:
                # クライアントが切断された
                print("RGBストリーム: クライアント切断を検知、ストリームを終了します")
                break
            except StopIteration:
                # ジェネレータが終了
                print("RGBストリーム: ストリームを終了します")
                break
            except Exception as e:
                # その他のエラー（クライアント切断の可能性も含む）
                error_str = str(e).lower()
                if 'broken pipe' in error_str or 'connection' in error_str or 'client' in error_str:
                    print(f"RGBストリーム: クライアント切断を検知: {e}")
                    break
                print(f"[generate_rgb] RGB画像生成エラー: {e}")
                print(f"[generate_rgb] エラー詳細:\n{traceback.format_exc()}")
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
        print("RGBストリーム: クライアント切断")

import cv2
import numpy as np
from .camera_manager import camera_manager

def _get_current_rgb_frame():
    """カメラマネージャーからRGBフレームを取得"""
    return camera_manager.get_rgb_frame()

def generate_rgb():
    """RGB画像を生成するジェネレータ関数"""
    while True:
        try:
            rgb_data = _get_current_rgb_frame()
            if rgb_data is None:
                # エラー画像を生成
                error_img = np.zeros((480, 640, 3), dtype=np.uint8)
                cv2.putText(error_img, "RGB Camera Not Found", (120, 200), 
                           cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
                cv2.putText(error_img, "Please connect camera", (100, 250), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
                ret, jpeg = cv2.imencode('.jpg', error_img)
                if ret:
                    frame_bytes = jpeg.tobytes()
                    yield (b'--frame\r\n'
                          b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                continue
            
            # 左右反転を修正（映像表示用）
            rgb_data_flipped = cv2.flip(rgb_data, 1)
            
            # JPEG形式にエンコード
            ret, buffer = cv2.imencode('.jpg', rgb_data_flipped)
            if ret:
                frame = buffer.tobytes()
                yield (b'--frame\r\n'
                      b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            
        except Exception as e:
            print(f"RGB画像生成エラー: {e}")
            # エラー時の画像を送信
            error_img = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(error_img, f"Error: {str(e)[:30]}", (50, 240), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
            ret, jpeg = cv2.imencode('.jpg', error_img)
            if ret:
                frame_bytes = jpeg.tobytes()
                yield (b'--frame\r\n'
                      b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

# import cv2
# import numpy as np
# import os
# from dotenv import load_dotenv
# from camera.camera_manager import camera_manager

# load_dotenv()

# OPENNI_PATH = os.environ['OPENNI_PATH']

# def _get_current_rgb_frame():
#     """カメラマネージャーからRGBフレームを取得"""
#     return camera_manager.get_rgb_frame()

# def generate_rgb():
#     """RGB画像を生成するジェネレータ関数"""
#     while True:
#         try:
#             rgb_data = _get_current_rgb_frame()
#             if rgb_data is None:
#                 # エラー画像を生成
#                 error_img = np.zeros((480, 640, 3), dtype=np.uint8)
#                 cv2.putText(error_img, "RGB Camera Not Found", (120, 200), 
#                            cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
#                 cv2.putText(error_img, "Please connect camera", (100, 250), 
#                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
#                 ret, jpeg = cv2.imencode('.jpg', error_img)
#                 if ret:
#                     frame_bytes = jpeg.tobytes()
#                     yield (b'--frame\r\n'
#                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
#                 continue
            
#             # JPEG形式にエンコード
#             ret, buffer = cv2.imencode('.jpg', rgb_data)
#             if ret:
#                 frame = buffer.tobytes()
#                 yield (b'--frame\r\n'
#                       b'Content-Type: image/jpeg\r\n\r\n' + frame + b'\r\n')
            
#         except Exception as e:
#             print(f"RGB画像生成エラー: {e}")
#             # エラー時の画像を送信
#             error_img = np.zeros((480, 640, 3), dtype=np.uint8)
#             cv2.putText(error_img, f"Error: {str(e)[:30]}", (50, 240), 
#                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
#             ret, jpeg = cv2.imencode('.jpg', error_img)
#             if ret:
#                 frame_bytes = jpeg.tobytes()
#                 yield (b'--frame\r\n'
#                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

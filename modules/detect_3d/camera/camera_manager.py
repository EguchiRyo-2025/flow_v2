import cv2
import numpy as np
from primesense import openni2
from primesense import _openni2 as c_api
import os
import threading
import time
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

MODULE_ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = MODULE_ROOT / '.env'
if ENV_PATH.exists():
    load_dotenv(dotenv_path=str(ENV_PATH))
else:
    load_dotenv()

OPENNI_PATH = os.getenv('OPENNI_PATH')
if not OPENNI_PATH:
    print('OPENNI_PATH is not configured; depth camera features will remain disabled until set.')

class CameraManager:
    """統一されたカメラリソース管理クラス"""
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super(CameraManager, cls).__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, '_initialized') or not self._initialized:
            self._device = None
            self._depth_stream = None
            self._rgb_stream = None
            self._camera_initialized = False
            self._stream_lock = threading.Lock()
            self._missing_path_logged = False
            self._openni_path = OPENNI_PATH
            self._capture_thread: Optional[threading.Thread] = None
            self._capture_stop_event = threading.Event()
            self._capture_thread_lock = threading.Lock()
            self._frame_lock = threading.Lock()
            self._frame_condition = threading.Condition(self._frame_lock)
            self._latest_depth_frame = None
            self._latest_rgb_frame = None
            self._need_depth = False
            self._need_rgb = False
            self._last_capture_error_logged_at = 0.0
            self._initialized = True
    
    def start(self):
        """カメラを起動（フロー実行など、必要な時に呼ぶ）"""
        self._ensure_capture_thread()
    
    def _initialize_camera(self):
        """カメラを初期化（一度のみ）"""
        if self._camera_initialized:
            return True

        with self._stream_lock:
            if self._camera_initialized:
                return True

            if not self._openni_path:
                if not self._missing_path_logged:
                    print('カメラ初期化をスキップしました: OPENNI_PATH が未設定です')
                    self._missing_path_logged = True
                return False
            try:
                if not openni2.is_initialized():
                    openni2.initialize(self._openni_path)
                self._device = openni2.Device.open_any()
                
                # OUT_OF_FLOWエラー対策：既存ストリームを完全に停止・破棄
                if self._depth_stream is not None:
                    try:
                        self._depth_stream.stop()
                        print("既存の深度ストリームを停止")
                    except Exception as e:
                        print(f"深度ストリーム停止エラー（続行）: {e}")
                    self._depth_stream = None  # 参照を切る
                
                if self._rgb_stream is not None:
                    try:
                        self._rgb_stream.stop()
                        print("既存のRGBストリームを停止")
                    except Exception as e:
                        print(f"RGBストリーム停止エラー（続行）: {e}")
                    self._rgb_stream = None  # 参照を切る
                
                # 短い待機で、OpenNI側がストリーム完全破棄を完了するのを待つ
                time.sleep(0.1)
                
                # 両方のストリームを新規作成
                self._depth_stream = self._device.create_depth_stream()
                print("新しい深度ストリームを作成")
                
                self._rgb_stream = self._device.create_color_stream()
                print("新しいRGBストリームを作成")
                
                # 深度ストリーム設定
                try:
                    self._depth_stream.set_video_mode(c_api.OniVideoMode(
                        pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_DEPTH_100_UM,
                        resolutionX=640,
                        resolutionY=480,
                        fps=30
                    ))
                    self._depth_stream.start()
                    print("深度ストリームを設定・開始しました")
                except Exception as e:
                    print(f"深度ストリーム設定エラー: {e}")
                    # 設定失敗時は新規作成したストリームをリセット
                    self._depth_stream = None
                    raise
                
                # RGBストリーム設定
                try:
                    self._rgb_stream.set_video_mode(c_api.OniVideoMode(
                        pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_RGB888,
                        resolutionX=640,
                        resolutionY=480,
                        fps=30
                    ))
                    self._rgb_stream.start()
                    print("RGBストリームを設定・開始しました")
                except Exception as e:
                    print(f"RGBストリーム設定エラー: {e}")
                    # 設定失敗時は新規作成したストリームをリセット
                    self._rgb_stream = None
                    raise
                
                self._camera_initialized = True
                print("統一カメラシステムを初期化しました")
                return True
            except Exception as e:
                error_str = str(e)
                print(f"カメラ初期化エラー: {e}")
                import traceback
                traceback.print_exc()
                # デバイスとストリームをクリーンアップして再試行できるようにする
                self._reset_streams_locked()
                if self._device:
                    try:
                        close = getattr(self._device, 'close', None)
                        if callable(close):
                            close()
                    except Exception:
                        pass
                    self._device = None
                return False
    
    def _reset_streams_locked(self):
        """ストリームを停止して破棄"""
        if self._depth_stream:
            try:
                self._depth_stream.stop()
            except Exception:
                pass
            self._depth_stream = None

        if self._rgb_stream:
            try:
                self._rgb_stream.stop()
            except Exception:
                pass
            self._rgb_stream = None

    def _reset_device(self):
        """デバイスを完全にリセット"""
        with self._frame_condition:
            self._latest_depth_frame = None
            self._latest_rgb_frame = None

        with self._stream_lock:
            self._reset_streams_locked()

            if self._device:
                try:
                    close = getattr(self._device, 'close', None)
                    if callable(close):
                        close()
                except Exception:
                    pass
                self._device = None

            if self._camera_initialized:
                self._camera_initialized = False
                self._missing_path_logged = False

        time.sleep(0.1)

    def _handle_capture_failure(self, capture_error: Exception):
        now = time.time()
        error_str = str(capture_error)
        
        # OUT_OF_FLOWエラーはストリーム競合なので、リセットして再初期化
        if 'OUT_OF_FLOW' in error_str or 'open by other components' in error_str:
            if now - self._last_capture_error_logged_at > 5.0:
                print(f"カメラ競合検知、再初期化します: {capture_error}")
                self._last_capture_error_logged_at = now
            # ストリームをリセットして再初期化フラグを立てる
            with self._stream_lock:
                self._reset_streams_locked()
            self._camera_initialized = False
            return
        
        # その他の深刻なエラーの場合のみログとリセット
        if now - self._last_capture_error_logged_at > 1.0:
            print(f"カメラキャプチャエラー: {capture_error}")
            self._last_capture_error_logged_at = now
        
        # 深刻なエラーの場合のみリセット
        self._reset_device()

    def _ensure_capture_thread(self):
        if self._capture_thread and self._capture_thread.is_alive():
            return True

        with self._capture_thread_lock:
            if self._capture_thread and self._capture_thread.is_alive():
                return True

            self._capture_stop_event.clear()
            thread = threading.Thread(
                target=self._capture_loop,
                name='CameraCaptureThread',
                daemon=True
            )
            self._capture_thread = thread
            thread.start()
            return True

    def _capture_loop(self):
        """OpenNI へアクセスする専用スレッド"""
        while not self._capture_stop_event.is_set():
            if not self._initialize_camera():
                time.sleep(0.5)
                continue

            try:
                with self._stream_lock:
                    # 常に両方のストリームを使用
                    depth_stream = self._depth_stream
                    rgb_stream = self._rgb_stream

                # ストリームのロックを解放してからフレームを読む
                try:
                    if depth_stream:
                        depth_frame = depth_stream.read_frame()
                        if depth_frame is not None:
                            try:
                                depth_data = depth_frame.get_buffer_as_uint16()
                                depth_array = np.frombuffer(depth_data, dtype=np.uint16).reshape((480, 640)).copy()
                                with self._frame_condition:
                                    self._latest_depth_frame = depth_array
                                    self._frame_condition.notify_all()
                            except Exception as e:
                                print(f"深度フレームデータ処理エラー: {e}")
                except Exception as e:
                    print(f"深度フレーム読み込みエラー: {e}")
                
                try:
                    if rgb_stream:
                        rgb_frame = rgb_stream.read_frame()
                        if rgb_frame is not None:
                            try:
                                rgb_data = rgb_frame.get_buffer_as_uint8()
                                bgr = np.frombuffer(rgb_data, dtype=np.uint8).reshape(480, 640, 3).copy()
                                rgb_array = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                                with self._frame_condition:
                                    self._latest_rgb_frame = rgb_array
                                    self._frame_condition.notify_all()
                            except Exception as e:
                                print(f"RGBフレームデータ処理エラー: {e}")
                except Exception as e:
                    print(f"RGBフレーム読み込みエラー: {e}")

                # 30fps を上限にする程度の待機
                time.sleep(0.01)

            except Exception as capture_error:
                self._handle_capture_failure(capture_error)
                time.sleep(0.3)
    
    def get_depth_frame(self):
        """深度フレームを取得"""
        self._need_depth = True
        if not self._ensure_capture_thread():
            return None

        deadline = time.time() + 1.0  # フロー実行用に短縮（カメラは事前初期化済み）
        with self._frame_condition:
            while self._latest_depth_frame is None:
                remaining = deadline - time.time()
                if remaining <= 0:
                    break
                self._frame_condition.wait(timeout=remaining)
            if self._latest_depth_frame is None:
                return None
            return self._latest_depth_frame.copy()
    
    def get_rgb_frame(self):
        """RGBフレームを取得"""
        self._need_rgb = True
        if not self._ensure_capture_thread():
            return None

        deadline = time.time() + 1.0  # フロー実行用に短縮（カメラは事前初期化済み）
        with self._frame_condition:
            while self._latest_rgb_frame is None:
                remaining = deadline - time.time()
                if remaining <= 0:
                    break
                self._frame_condition.wait(timeout=remaining)
            if self._latest_rgb_frame is None:
                return None
            return self._latest_rgb_frame.copy()
    
    def cleanup(self):
        """カメラリソースをクリーンアップ"""
        try:
            print("統一カメラシステムのクリーンアップを開始します")
            
            # フラグをリセット
            self._need_depth = False
            self._need_rgb = False
            
            # キャプチャスレッドを停止
            self._capture_stop_event.set()
            if self._capture_thread and self._capture_thread.is_alive():
                print("キャプチャスレッドの停止を待機中...")
                self._capture_thread.join(timeout=2.0)  # 1.0秒から2.0秒に延長
                if self._capture_thread.is_alive():
                    print("警告: キャプチャスレッドが停止しませんでした")
            self._capture_thread = None
            self._capture_stop_event = threading.Event()

            # フレームをクリア
            with self._frame_condition:
                self._latest_depth_frame = None
                self._latest_rgb_frame = None
                self._frame_condition.notify_all()

            # ストリームを停止
            with self._stream_lock:
                if self._depth_stream:
                    try:
                        print("深度ストリームを停止中...")
                        self._depth_stream.stop()
                    except Exception as e:
                        print(f"深度ストリーム停止エラー: {e}")
                    self._depth_stream = None

                if self._rgb_stream:
                    try:
                        print("RGBストリームを停止中...")
                        self._rgb_stream.stop()
                    except Exception as e:
                        print(f"RGBストリーム停止エラー: {e}")
                    self._rgb_stream = None

                # デバイスをクローズ
                if self._device:
                    try:
                        print("カメラデバイスをクローズ中...")
                        close = getattr(self._device, 'close', None)
                        if callable(close):
                            close()
                    except Exception as e:
                        print(f"デバイスクローズエラー: {e}")
                    self._device = None

                # 注: openni2.unload() は呼び出さない
                # システム全体がシャットダウンしてしまうため、アプリケーション終了時のみ呼び出す
                if self._camera_initialized:
                    self._camera_initialized = False
                    self._missing_path_logged = False

            print("統一カメラシステムをクリーンアップしました")
        except Exception as e:
            print(f"カメラクリーンアップエラー: {e}")
            import traceback
            traceback.print_exc()

# グローバルなカメラマネージャーインスタンス
camera_manager = CameraManager()
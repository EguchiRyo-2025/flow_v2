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
            # 大域的な操作を直列化するための再入可能ロック
            self._op_lock = threading.RLock()
            self._latest_depth_frame = None
            self._latest_rgb_frame = None
            self._need_depth = False
            self._need_rgb = False
            self._last_capture_error_logged_at = 0.0
            self._initialized = True
    
    def _initialize_camera(self):
        """カメラを初期化（呼び出しは都度可能。排他制御で安全に実行される）"""
        with self._op_lock:
            print("[camera_manager] _initialize_camera: called")
            if self._camera_initialized:
                print("[camera_manager] _initialize_camera: already initialized")
                return True

            # double-check under stream lock as well
            with self._stream_lock:
                if self._camera_initialized:
                    print("[camera_manager] _initialize_camera: already initialized (locked)")
                    return True

                if not self._openni_path:
                    if not self._missing_path_logged:
                        print('[camera_manager] カメラ初期化をスキップ: OPENNI_PATH 未設定')
                        self._missing_path_logged = True
                    return False
                try:
                    print(f"[camera_manager] _initialize_camera: openni2.is_initialized()={openni2.is_initialized()}")
                    if not openni2.is_initialized():
                        print(f"[camera_manager] _initialize_camera: initializing openni2 with path {self._openni_path}")
                        openni2.initialize(self._openni_path)
                    print("[camera_manager] _initialize_camera: opening device...")
                    self._device = openni2.Device.open_any()
                    self._camera_initialized = True
                    print("[camera_manager] _initialize_camera: success")
                    return True
                except Exception as e:
                    print(f"[camera_manager] _initialize_camera: カメラ初期化エラー: {e}")
                    # 失敗時は確実に状態をクリアしておく
                    try:
                        self._device = None
                        if openni2.is_initialized():
                            openni2.unload()
                    except Exception:
                        pass
                    self._camera_initialized = False
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
        
        # OUT_OF_FLOWエラーは一時的な競合状態なので、デバイスリセット不要
        if 'OUT_OF_FLOW' in error_str or 'open by other components' in error_str:
            if now - self._last_capture_error_logged_at > 5.0:
                print(f"カメラ一時的競合（継続中）: {capture_error}")
                self._last_capture_error_logged_at = now
            # デバイスリセットせずに継続
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
        print("[camera_manager] _capture_loop: thread started")
        while not self._capture_stop_event.is_set():
            # 初期化済みでなければ何もしない
            if not self._camera_initialized or self._device is None:
                print("[camera_manager] _capture_loop: not initialized, sleeping")
                time.sleep(0.1)
                continue

            need_depth = self._need_depth
            need_rgb = self._need_rgb
            print(f"[camera_manager] _capture_loop: need_depth={need_depth}, need_rgb={need_rgb}")

            if not need_depth and not need_rgb:
                time.sleep(0.05)
                continue

            try:
                with self._stream_lock:
                    if need_depth:
                        if self._depth_stream is None:
                            print("[camera_manager] _capture_loop: creating depth stream...")
                            self._depth_stream = self._device.create_depth_stream()
                            self._depth_stream.set_video_mode(c_api.OniVideoMode(
                                pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_DEPTH_100_UM,
                                resolutionX=640,
                                resolutionY=480,
                                fps=30
                            ))
                            self._depth_stream.start()
                            print("[camera_manager] _capture_loop: 深度ストリームを開始しました")
                    if need_rgb:
                        if self._rgb_stream is None:
                            print("[camera_manager] _capture_loop: creating rgb stream...")
                            self._rgb_stream = self._device.create_color_stream()
                            self._rgb_stream.set_video_mode(c_api.OniVideoMode(
                                pixelFormat=c_api.OniPixelFormat.ONI_PIXEL_FORMAT_RGB888,
                                resolutionX=640,
                                resolutionY=480,
                                fps=30
                            ))
                            self._rgb_stream.start()
                            print("[camera_manager] _capture_loop: RGBストリームを開始しました")

                    depth_stream = self._depth_stream if need_depth else None
                    rgb_stream = self._rgb_stream if need_rgb else None

                # ストリームのロックを解放してからフレームを読む
                if depth_stream:
                    print("[camera_manager] _capture_loop: reading depth frame...")
                    depth_frame = depth_stream.read_frame()
                    if depth_frame is not None:
                        # print("[camera_manager] _capture_loop: got depth frame")
                        depth_data = depth_frame.get_buffer_as_uint16()
                        depth_array = np.frombuffer(depth_data, dtype=np.uint16).reshape((480, 640)).copy()
                        with self._frame_condition:
                            self._latest_depth_frame = depth_array
                            self._frame_condition.notify_all()
                    else:
                        print("[camera_manager] _capture_loop: depth_frame is None")

                if rgb_stream:
                    print("[camera_manager] _capture_loop: reading rgb frame...")
                    rgb_frame = rgb_stream.read_frame()
                    if rgb_frame is not None:
                        print("[camera_manager] _capture_loop: got rgb frame")
                        rgb_data = rgb_frame.get_buffer_as_uint8()
                        bgr = np.frombuffer(rgb_data, dtype=np.uint8).reshape(480, 640, 3).copy()
                        rgb_array = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
                        with self._frame_condition:
                            self._latest_rgb_frame = rgb_array
                            self._frame_condition.notify_all()
                    else:
                        print("[camera_manager] _capture_loop: rgb_frame is None")

                # 30fps を上限にする程度の待機
                time.sleep(0.01)

            except Exception as capture_error:
                print(f"[camera_manager] _capture_loop: exception: {capture_error}")
                self._handle_capture_failure(capture_error)
                time.sleep(0.3)
    
    def get_depth_frame(self):
        """深度フレームを取得（未初期化なら一度だけ初期化を試みる）"""
        # 都度初期化運用では、呼び出し側（ページ表示前の処理）で cleanup/initialize を行う想定だが
        # 万が一のためここでも排他で初期化を試みる
        with self._op_lock:
            print(f"[camera_manager] get_depth_frame: initialized={self._camera_initialized}")
            if not self._camera_initialized:
                print("[camera_manager] get_depth_frame: initialize on demand")
                if not self._initialize_camera():
                    print("[camera_manager] get_depth_frame: initialization failed")
                    return None

            # ストリーム関連の操作は stream_lock で保護
            with self._stream_lock:
                self._need_depth = True
                # ensure capture thread can run if needed
                if not self._ensure_capture_thread():
                    print("[camera_manager] get_depth_frame: キャプチャスレッド起動失敗")
                    return None

            deadline = time.time() + 1.0
            with self._frame_condition:
                while self._latest_depth_frame is None:
                    remaining = deadline - time.time()
                    if remaining <= 0:
                        break
                    self._frame_condition.wait(timeout=remaining)
                if self._latest_depth_frame is None:
                    print("[camera_manager] get_depth_frame: フレーム取得失敗")
                    return None
                try:
                    frame = self._latest_depth_frame.copy()
                    return frame
                except Exception as e:
                    print(f"[camera_manager] get_depth_frame: error: {e}")
                    return None
    
    def get_rgb_frame(self):
        """RGBフレームを取得（未初期化なら一度だけ初期化を試みる）"""
        with self._op_lock:
            print(f"[camera_manager] get_rgb_frame: initialized={self._camera_initialized}")
            if not self._camera_initialized:
                print("[camera_manager] get_rgb_frame: initialize on demand")
                if not self._initialize_camera():
                    print("[camera_manager] get_rgb_frame: initialization failed")
                    return None

            with self._stream_lock:
                self._need_rgb = True
                if not self._ensure_capture_thread():
                    print("[camera_manager] get_rgb_frame: キャプチャスレッド起動失敗")
                    return None

            deadline = time.time() + 1.0
            with self._frame_condition:
                while self._latest_rgb_frame is None:
                    remaining = deadline - time.time()
                    if remaining <= 0:
                        break
                    self._frame_condition.wait(timeout=remaining)
                if self._latest_rgb_frame is None:
                    print("[camera_manager] get_rgb_frame: フレーム取得失敗")
                    return None
                try:
                    frame = self._latest_rgb_frame.copy()
                    return frame
                except Exception as e:
                    print(f"[camera_manager] get_rgb_frame: error: {e}")
                    return None
    
    def cleanup(self):
        """カメラリソースをクリーンアップ（排他制御付き）"""
        with self._op_lock:
            try:
                print(f"[camera_manager] cleanup: initialized={self._camera_initialized}")
                # まず停止フラグを立ててスレッドを止める（最大2秒待機）
                self._capture_stop_event.set()
                wait_until = time.time() + 2.0
                while self._capture_thread and self._capture_thread.is_alive() and time.time() < wait_until:
                    time.sleep(0.05)
                # capture_threadがまだ生きている場合は無理にjoinせず、そのままストリーム停止へ
                self._capture_thread = None
                self._capture_stop_event = threading.Event()

                # ストリーム停止とフレーム破棄
                with self._stream_lock:
                    self._need_depth = False
                    self._need_rgb = False
                    with self._frame_condition:
                        self._latest_depth_frame = None
                        self._latest_rgb_frame = None

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

                # OpenNIのunloadは、キャプチャスレッドが完全に停止している場合に行う
                if self._camera_initialized:
                    # NOTE: Do NOT call openni2.unload() here — unloading the C
                    # extension while other threads or resources may still be
                    # interacting with it commonly causes native crashes. Keep
                    # device/stream references cleared and leave library unload
                    # to process exit.
                    self._camera_initialized = False
                    self._device = None
                    self._missing_path_logged = False

                print("[camera_manager] cleanup: success")
            except Exception as e:
                print(f"[camera_manager] cleanup: error: {e}")
            print("[camera_manager] cleanup: finished")

# グローバルなカメラマネージャーインスタンス
camera_manager = CameraManager()
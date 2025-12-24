"""
デスクトップアプリケーションのエントリーポイント
pywebviewを使用して複数ディスプレイにウィンドウを表示
"""
import webview
import threading
import time
from screeninfo import get_monitors
from app import app

# グローバル変数: ディスプレイマッピング
display_mapping = {}

def initialize_displays():
    """接続されているディスプレイを認識してマッピング"""
    monitors = get_monitors()
    
    print(f"\n=== 接続されているディスプレイ: {len(monitors)}台 ===")
    for i, monitor in enumerate(monitors):
        print(f"ディスプレイ {i}: {monitor.name}")
        print(f"  位置: ({monitor.x}, {monitor.y})")
        print(f"  解像度: {monitor.width}x{monitor.height}")
        print(f"  プライマリ: {monitor.is_primary}")
    
    # ディスプレイマッピング（1つのモニターでも動作するように）
    # 0 = メイン画面（登録画面）
    # 1 = 部品棚（2つ目以降がなければメイン画面と同じ）
    # 2 = 作業台（3つ目以降がなければメイン画面と同じ）
    display_mapping['main'] = monitors[0]
    display_mapping['parts'] = monitors[1] if len(monitors) > 1 else monitors[0]
    display_mapping['workbench'] = monitors[2] if len(monitors) > 2 else monitors[0]
    
    # Flaskアプリでも参照できるようにする
    app.config['DISPLAY_MAPPING'] = display_mapping
    
    print("\n=== ディスプレイマッピング ===")
    print(f"メイン画面: ディスプレイ 0")
    print(f"部品棚: ディスプレイ {1 if len(monitors) > 1 else '0 (メインと同じ)'}")
    print(f"作業台: ディスプレイ {2 if len(monitors) > 2 else '0 (メインと同じ)'}")
    if len(monitors) == 1:
        print("⚠️ モニターが1つのみです。部品棚・作業台はメイン画面に重ねて表示されます。")
    print("=" * 40 + "\n")
    
    return monitors

def start_flask():
    """Flaskサーバーをバックグラウンドで起動"""
    app.run(host='127.0.0.1', port=5000, debug=False, use_reloader=False)

def create_windows(monitors):
    """各ディスプレイにウィンドウを作成"""
    windows = []
    
    # メインウィンドウ（登録画面）
    main_window = webview.create_window(
        '図形登録システム',
        'http://127.0.0.1:5000',
        width=1200,
        height=800,
        resizable=True,
        fullscreen=False
    )
    windows.append(main_window)
    
    # 部品棚ウィンドウ（モニターが1つの場合は小さいウィンドウで表示）
    if len(monitors) > 1:
        parts_monitor = monitors[1]
        parts_window = webview.create_window(
            '部品棚',
            'http://127.0.0.1:5000/display/parts',
            x=parts_monitor.x,
            y=parts_monitor.y,
            width=parts_monitor.width,
            height=parts_monitor.height,
            fullscreen=True,
            frameless=True
        )
        windows.append(parts_window)
    else:
        # モニター1つの場合は小さいウィンドウで表示
        parts_window = webview.create_window(
            '部品棚 (デバッグ)',
            'http://127.0.0.1:5000/display/parts',
            width=800,
            height=600,
            resizable=True,
            fullscreen=False
        )
        windows.append(parts_window)
    
    # 作業台ウィンドウ（モニターが2つ以下の場合は小さいウィンドウで表示）
    if len(monitors) > 2:
        workbench_monitor = monitors[2]
        workbench_window = webview.create_window(
            '作業台',
            'http://127.0.0.1:5000/display/workbench',
            x=workbench_monitor.x,
            y=workbench_monitor.y,
            width=workbench_monitor.width,
            height=workbench_monitor.height,
            fullscreen=True,
            frameless=True
        )
        windows.append(workbench_window)
    else:
        # モニター2つ以下の場合は小さいウィンドウで表示
        workbench_window = webview.create_window(
            '作業台 (デバッグ)',
            'http://127.0.0.1:5000/display/workbench',
            width=800,
            height=600,
            resizable=True,
            fullscreen=False
        )
        windows.append(workbench_window)
    
    return windows

def main():
    """アプリケーションのメインエントリーポイント"""
    print("=" * 50)
    print("図形登録システム起動中...")
    print("=" * 50)
    
    # ディスプレイを初期化
    monitors = initialize_displays()
    
    # Flaskをバックグラウンドで起動
    flask_thread = threading.Thread(target=start_flask, daemon=True)
    flask_thread.start()
    
    # Flaskの起動を待つ
    print("Flaskサーバー起動中...")
    time.sleep(2)
    print("Flaskサーバー起動完了\n")
    
    # ウィンドウを作成して起動
    print("ウィンドウを開いています...")
    windows = create_windows(monitors)
    
    # webviewを起動（ブロッキング）
    webview.start(debug=True)
    
    print("\nアプリケーションを終了しました")

if __name__ == '__main__':
    main()

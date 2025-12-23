# カメラリソース管理

## 問題
カメラを使用するページ（3D画像の原点設定、3D画像の検知、フロー）間を移動する際に、カメラリソースの競合が発生してアプリケーションがクラッシュする問題がありました。

## 原因
1. **ストリーム停止の欠如**: ページ遷移時にカメラストリームが自動的に停止していなかった
2. **リソース解放の不備**: 複数のページが同時にカメラにアクセスしようとしていた
3. **状態管理の不足**: アクティブなストリームの追跡が不十分だった

## 解決策

### 1. サーバーサイド（Python）の改善

#### `modules/detect_3d/app.py`
- **ストリーム追跡**: `active_streams`辞書で現在アクティブなストリーム数を追跡
- **リクエストフック**: 
  - `before_request`: リクエスト前にカメラリソースを準備
  - `teardown_request`: リクエスト後にアクティブなストリームがない場合はリソースを解放
- **ストリーム管理**: 各ストリームエンドポイント(`/stream/rgb`, `/stream/depth`)でストリームの開始・終了を追跡
- **クリーンアップエンドポイント**: `/cleanup`エンドポイントでクライアントから明示的にリソース解放を要求可能

```python
# アクティブなストリームを追跡
active_streams = {'rgb': 0, 'depth': 0}
stream_lock = threading.Lock()

@detection_bp.route('/stream/rgb')
def stream_rgb():
    with stream_lock:
        active_streams['rgb'] += 1
    try:
        return Response(generate_rgb(), mimetype='multipart/x-mixed-replace; boundary=frame')
    finally:
        with stream_lock:
            active_streams['rgb'] -= 1
            if active_streams['rgb'] == 0:
                camera_manager._need_rgb = False

@detection_bp.route('/cleanup', methods=['POST'])
def cleanup_camera():
    """カメラリソースを明示的にクリーンアップ"""
    try:
        with stream_lock:
            active_streams['rgb'] = 0
            active_streams['depth'] = 0
        camera_manager._need_rgb = False
        camera_manager._need_depth = False
        return jsonify({'success': True, 'message': 'Camera resources cleaned up'})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
```

### 2. クライアントサイド（JavaScript）の改善

#### `modules/detect_3d/static/js/detect_3D.js`
ページ離脱時に以下を実行：
- カメラストリームの停止（`img.src = ''`）
- インターバルタイマーのクリア
- サーバーへのクリーンアップ通知（`fetch('/detection/cleanup')`）

```javascript
window.addEventListener('beforeunload', () => {
    console.log('検知画面: ページ離脱時のクリーンアップ');
    
    // カメラストリームを停止
    const rgbImg = document.getElementById('rgbImage');
    const depthImg = document.getElementById('depthImage');
    
    if (rgbImg && rgbImg.src) {
        rgbImg.src = '';
    }
    if (depthImg && depthImg.src) {
        depthImg.src = '';
    }
    
    // インターバルを停止
    if (window.pixelCountInterval) {
        clearInterval(window.pixelCountInterval);
        window.pixelCountInterval = null;
    }
    
    // サーバーにクリーンアップを通知
    fetch('/detection/cleanup', {
        method: 'POST',
        keepalive: true  // ページ遷移後も送信を保証
    }).catch(err => console.warn('カメラクリーンアップ通知エラー:', err));
});
```

#### `modules/detect_3d/static/js/set_3D_origin.js`
同様のクリーンアップ処理を実装：

```javascript
function cleanupOnPageLeave() {
    console.log('原点設定画面: ページ離脱時のクリーンアップ');
    
    // カメラストリームを停止
    const rgbImg = document.getElementById('rgbImage');
    if (rgbImg && rgbImg.src) {
        rgbImg.src = '';
    }
    
    // サーバーにクリーンアップを通知
    fetch('/detection/cleanup', {
        method: 'POST',
        keepalive: true
    }).catch(err => console.warn('カメラクリーンアップ通知エラー:', err));
    
    // インターバルをクリア
    if (window.pixelCountInterval) {
        clearInterval(window.pixelCountInterval);
        window.pixelCountInterval = null;
    }
}

window.addEventListener('beforeunload', cleanupOnPageLeave);
window.addEventListener('pagehide', cleanupOnPageLeave);
```

### 3. カメラマネージャー（`camera_manager.py`）の特徴

既存の`CameraManager`クラスは以下の機能を持っています：
- **シングルトンパターン**: アプリケーション全体で1つのインスタンスのみ
- **スレッドセーフ**: ロックを使用した安全なリソース管理
- **遅延初期化**: 実際に必要になるまでカメラを初期化しない
- **需要ベース制御**: `_need_rgb`と`_need_depth`フラグで必要なストリームのみ有効化

## 動作フロー

### ページ遷移時の処理
1. **ユーザーがページを離れる**
   - ブラウザが`beforeunload`イベントを発火
   
2. **クライアントサイド**
   - `<img>`タグの`src`を空にしてストリーム停止
   - インターバルタイマーをクリア
   - `/detection/cleanup`に非同期POSTリクエスト（`keepalive: true`で確実に送信）

3. **サーバーサイド**
   - `cleanup_camera()`エンドポイントが実行
   - `active_streams`カウンターをリセット
   - `camera_manager._need_rgb`と`_need_depth`をFalseに設定
   - カメラマネージャーがストリームを停止

4. **新しいページ読み込み**
   - 必要に応じて新しいストリームを開始
   - カメラリソースが適切に再初期化される

## ベストプラクティス

### カメラを使用する新しいページを追加する場合
1. **HTMLテンプレート**: `<img>`タグにユニークなIDを設定
2. **JavaScript**: `beforeunload`と`pagehide`イベントでクリーンアップ処理を追加
3. **クリーンアップ内容**:
   - すべてのストリーム画像の`src`を空にする
   - タイマーやインターバルをクリア
   - `/detection/cleanup`にPOSTリクエストを送信（`keepalive: true`を使用）

### デバッグ
- ブラウザのコンソールでクリーンアップメッセージを確認
- サーバーログで`active_streams`の状態を確認
- カメラマネージャーの`_need_rgb`/`_need_depth`フラグをチェック

## 注意事項
- **`keepalive: true`**: ページ遷移中でもfetchリクエストが完了することを保証
- **複数イベント**: `beforeunload`、`pagehide`、`unload`の複数イベントで対応（ブラウザ互換性のため）
- **エラーハンドリング**: ネットワークエラーが発生してもアプリケーションが停止しないよう`.catch()`で処理

## テスト方法
1. 3D画像の原点設定ページを開く
2. カメラストリームが表示されることを確認
3. 3D画像の検知ページに移動
4. クラッシュせずに正常に遷移することを確認
5. フローデザイナーページに移動
6. 再度3D画像のページに戻る
7. すべての遷移でカメラが正常に動作することを確認

// グローバルメニュー管理スクリプト

// カメラリソースのクリーンアップ関数（全ページ共通）
function cleanupCameraResourcesGlobal() {
    console.log('グローバルメニュー: カメラクリーンアップ開始');
    
    // カメラストリームを使用している可能性がある要素を停止
    const images = document.querySelectorAll('img[src*="/detection/stream"]');
    images.forEach(img => {
        if (img.src) {
            img.src = '';
            console.log('グローバルメニュー: カメラストリームを停止しました');
        }
    });
    
    // インターバルを停止（グローバルなインターバルがあれば）
    if (window.pixelCountInterval) {
        clearInterval(window.pixelCountInterval);
        window.pixelCountInterval = null;
        console.log('グローバルメニュー: インターバルを停止しました');
    }
    
    // サーバーにクリーンアップを通知（keepalive: trueで確実に送信）
    try {
        fetch('/detection/cleanup', {
            method: 'POST',
            keepalive: true
        });
        console.log('グローバルメニュー: クリーンアップ通知を送信しました');
    } catch (err) {
        console.warn('カメラクリーンアップ通知エラー:', err);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 現在のページに応じてメニューのアクティブ状態を設定
    const currentPath = window.location.pathname;
    const dropdownMenus = document.querySelectorAll('.dropdown-menu');
    
    dropdownMenus.forEach(menu => {
        const links = menu.querySelectorAll('.dropdown-submenu a');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && currentPath.startsWith(href)) {
                menu.classList.add('active');
            }
        });
    });
    
    // ドロップダウンのクリックイベント防止（ホバーで動作させる）
    document.querySelectorAll('.dropdown-toggle').forEach(toggle => {
        toggle.addEventListener('click', (e) => {
            e.preventDefault();
        });
    });
    
    // すべてのメニューリンクにクリーンアップ処理を追加
    document.querySelectorAll('.dropdown-submenu a').forEach(link => {
        link.addEventListener('click', (e) => {
            // カメラを使用するページ（3D画像、フロー）から他のページへの遷移時はクリーンアップ
            if (currentPath.includes('/detection/') || currentPath.includes('/flow/')) {
                console.log('カメラを使用するページから遷移中: クリーンアップを実行');
                cleanupCameraResourcesGlobal();
            }
        });
    });
});

// ページ離脱時にもクリーンアップを実行（念のため）
window.addEventListener('beforeunload', () => {
    const currentPath = window.location.pathname;
    if (currentPath.includes('/detection/') || currentPath.includes('/flow/')) {
        cleanupCameraResourcesGlobal();
    }
});

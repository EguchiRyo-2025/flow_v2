// グローバルメニュー管理スクリプト

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
    
    // 3D画像ページからの遷移時にクリーンアップを確実に実行
    document.querySelectorAll('.dropdown-submenu a').forEach(link => {
        link.addEventListener('click', (e) => {
            // 3D画像ページからの遷移の場合
            if (currentPath.includes('/detection/')) {
                e.preventDefault();
                const targetUrl = link.getAttribute('href');
                
                console.log('3D画像ページから遷移中: クリーンアップ実行');
                
                // クリーンアップリクエストを送信
                fetch('/detection/cleanup', {
                    method: 'POST',
                    keepalive: true
                }).then(() => {
                    console.log('クリーンアップ完了: 遷移します');
                    // 少し待機してから遷移
                    setTimeout(() => {
                        window.location.href = targetUrl;
                    }, 100);
                }).catch(err => {
                    console.warn('クリーンアップエラー: そのまま遷移します', err);
                    window.location.href = targetUrl;
                });
            }
        });
    });
});

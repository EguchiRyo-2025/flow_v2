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
});

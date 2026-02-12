// register_figure.html - グループ管理とエレメント管理の初期化

document.addEventListener('DOMContentLoaded', () => {
    // グループマネージャー
    window.groupManager = new GroupManager();
    
    // 要素一覧テーブルマネージャー
    window.elementsTableManager = new ElementsTableManager();
    
    // エレメントマネージャー
    window.elementManager = new ElementManager();
});

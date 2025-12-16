// register_figure.html - グループ管理とエレメント管理の初期化

document.addEventListener('DOMContentLoaded', () => {
    // グループマネージャーとエレメントマネージャーの初期化
    window.groupManager = new GroupManager();
    window.elementManager = new ElementManager();
});

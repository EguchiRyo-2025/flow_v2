window.DISPLAY_TARGET = "{{ display_target }}";

// ウィンドウサイズを表示
function updateWindowSize() {
    const sizeEl = document.getElementById('window-size');
    if (sizeEl) {
        sizeEl.textContent = `${window.innerWidth} × ${window.innerHeight} px`;
    }
}
updateWindowSize();
window.addEventListener('resize', updateWindowSize);

// URLパラメータからウィンドウ位置・サイズを設定
(function() {
    const urlParams = new URLSearchParams(window.location.search);
    const x = urlParams.get('x');
    const y = urlParams.get('y');
    const w = urlParams.get('w');
    const h = urlParams.get('h');
    
    if (x !== null && y !== null && w !== null && h !== null) {
        // ウィンドウを指定位置・サイズに移動・リサイズ
        console.log(`Positioning window: (${x}, ${y}) ${w}x${h}`);
        window.moveTo(parseInt(x), parseInt(y));
        window.resizeTo(parseInt(w), parseInt(h));
        
        // 念のため少し遅延してからもう一度実行
        setTimeout(() => {
            window.moveTo(parseInt(x), parseInt(y));
            window.resizeTo(parseInt(w), parseInt(h));
        }, 100);
    }
    
    const displayTarget = "{{ display_target }}";
    
    // display_targetに応じてウィンドウを配置
    if (displayTarget === 'parts' || displayTarget === 'workbench') {
        // 少し遅延してから自動的に全画面化を試行
        setTimeout(() => {
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => {
                    console.log('Auto-fullscreen blocked by browser. Click window to go fullscreen.');
                });
            }
        }, 500);
        
        // ウィンドウのタイトルを設定
        document.title = `Display: ${displayTarget.toUpperCase()}`;
    }
})();

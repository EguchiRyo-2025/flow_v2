/**
 * ディスプレイウィンドウ起動機能
 * 3つのディスプレイ（monitor, parts, workbench）を別ウィンドウで全画面起動
 */

class DisplayWindowLauncher {
    constructor() {
        this.windows = {};
        this.displays = [
            {
                name: 'monitor',
                url: '/mapping/display/monitor',
                width: 1920,
                height: 1080,
                x: 0,
                y: 0
            },
            {
                name: 'parts',
                url: '/mapping/display/parts',
                width: 1920,
                height: 1200,
                x: 1920,
                y: 0
            },
            {
                name: 'workbench',
                url: '/mapping/display/workbench',
                width: 1920,
                height: 1200,
                x: 3840,
                y: 0
            }
        ];
    }

    /**
     * 全ディスプレイウィンドウを起動
     */
    launchAllDisplays() {
        console.log('[DisplayWindowLauncher] 全ディスプレイウィンドウを起動します');

        // 既に開いているウィンドウがあればクローズ
        this.closeAllDisplays();

        // 各ディスプレイを順番に起動
        this.displays.forEach(display => {
            this.launchDisplay(display);
        });

        console.log('[DisplayWindowLauncher] ウィンドウ起動完了');
    }

    /**
     * 単一ディスプレイウィンドウを起動
     * @param {Object} display - display設定オブジェクト
     */
    launchDisplay(display) {
        const windowName = `display_${display.name}`;
        // ウィンドウスペック: 位置、サイズを指定してブラウザUIを最小化
        const specs = `width=${display.width},height=${display.height},left=${display.x},top=${display.y},toolbar=no,scrollbars=no,menubar=no,status=no,directories=no,location=no`;

        try {
            const win = window.open(display.url, windowName, specs);

            if (win) {
                this.windows[display.name] = win;
                console.log(`[DisplayWindowLauncher] ${display.name} ウィンドウを起動: (${display.x},${display.y}) ${display.width}x${display.height}`);

                // ウィンドウがロード完了後を狙って全画面化を試みる
                const loadHandler = () => {
                    setTimeout(() => {
                        this.tryFullscreen(win, display.name);
                        win.removeEventListener('load', loadHandler);
                    }, 1000);
                };
                
                win.addEventListener('load', loadHandler);

                // ウィンドウがクローズされたときのハンドラ
                const checkClosed = setInterval(() => {
                    if (win.closed) {
                        delete this.windows[display.name];
                        console.log(`[DisplayWindowLauncher] ${display.name} ウィンドウがクローズされました`);
                        clearInterval(checkClosed);
                    }
                }, 1000);
            } else {
                console.warn(`[DisplayWindowLauncher] ${display.name} ウィンドウの起動に失敗しました（ポップアップブロック可能性）`);
                alert(`${display.name} ウィンドウの起動に失敗しました。ポップアップがブロックされていないか確認してください。`);
            }
        } catch (err) {
            console.error(`[DisplayWindowLauncher] ${display.name} ウィンドウ起動エラー:`, err);
        }
    }

    /**
     * ウィンドウの全画面化を試みる
     * @param {Window} win - ウィンドウオブジェクト
     * @param {String} displayName - ディスプレイ名
     */
    tryFullscreen(win, displayName) {
        try {
            if (win.document && win.document.documentElement) {
                // Fullscreen API でのフルスクリーン化
                if (win.document.documentElement.requestFullscreen) {
                    win.document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(err => {
                        console.log(`[DisplayWindowLauncher] ${displayName} の全画面化に失敗（ブラウザポリシー）:`, err.message);
                    });
                }
                // webkit版（Safari）
                else if (win.document.documentElement.webkitRequestFullscreen) {
                    win.document.documentElement.webkitRequestFullscreen();
                }
                // Firefox版（古いバージョン）
                else if (win.document.documentElement.mozRequestFullScreen) {
                    win.document.documentElement.mozRequestFullScreen();
                }
                // MS Edge版
                else if (win.document.documentElement.msRequestFullscreen) {
                    win.document.documentElement.msRequestFullscreen();
                }
            }
        } catch (err) {
            console.log(`[DisplayWindowLauncher] ${displayName} の全画面化試行時エラー:`, err);
        }
    }

    /**
     * 全ディスプレイウィンドウをクローズ
     */
    closeAllDisplays() {
        Object.keys(this.windows).forEach(name => {
            try {
                if (this.windows[name] && !this.windows[name].closed) {
                    this.windows[name].close();
                    console.log(`[DisplayWindowLauncher] ${name} ウィンドウをクローズしました`);
                }
            } catch (err) {
                console.warn(`[DisplayWindowLauncher] ${name} ウィンドウのクローズに失敗:`, err);
            }
            delete this.windows[name];
        });
    }

    /**
     * 特定ディスプレイウィンドウをクローズ
     * @param {String} displayName - ディスプレイ名（monitor/parts/workbench）
     */
    closeDisplay(displayName) {
        if (this.windows[displayName] && !this.windows[displayName].closed) {
            this.windows[displayName].close();
            delete this.windows[displayName];
            console.log(`[DisplayWindowLauncher] ${displayName} ウィンドウをクローズしました`);
        }
    }

    /**
     * 特定ディスプレイウィンドウが開いているか確認
     * @param {String} displayName - ディスプレイ名
     * @returns {Boolean}
     */
    isDisplayOpen(displayName) {
        return this.windows[displayName] && !this.windows[displayName].closed;
    }

    /**
     * 全ディスプレイウィンドウの状態を確認
     * @returns {Object}
     */
    getDisplayStatus() {
        const status = {};
        this.displays.forEach(display => {
            status[display.name] = this.isDisplayOpen(display.name);
        });
        return status;
    }
}

// グローバルインスタンス
const displayWindowLauncher = new DisplayWindowLauncher();

// ボタンイベントの初期化
document.addEventListener('DOMContentLoaded', () => {
    const launchBtn = document.getElementById('launch-display-windows');
    if (launchBtn) {
        launchBtn.addEventListener('click', () => {
            displayWindowLauncher.launchAllDisplays();
        });
        console.log('[DisplayWindowLauncher] ボタンリスナー登録完了');
    }
});

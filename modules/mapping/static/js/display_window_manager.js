/**
 * 表示ウィンドウ管理クラス
 * 画像を実際に表示するウィンドウを管理
 */
class DisplayWindowManager {
    constructor() {
        this.windows = {}; // { display_target: window }
        this.elements = {}; // { display_target: [elements] }
    }

    /**
     * 表示ウィンドウを開く
     */
    async openWindow(displayTarget) {
        // 既に開いている場合はそのウィンドウを返す
        if (this.windows[displayTarget] && !this.windows[displayTarget].closed) {
            this.windows[displayTarget].focus();
            return this.windows[displayTarget];
        }

        // 新しいウィンドウを開く
        const url = `/preview/${displayTarget}`;
        
        let windowFeatures, win;
        
        if (displayTarget === 'monitor') {
            // PC画面用：通常のウィンドウ
            windowFeatures = 'width=1920,height=1080,resizable=yes,scrollbars=no';
            win = window.open(url, `display_${displayTarget}`, windowFeatures);
            
            if (win) {
                win.moveTo(0, 0);
            }
        } else {
            // プロジェクター用（parts_shelf, worktable）：全画面モード
            windowFeatures = 'fullscreen=yes,resizable=yes,scrollbars=no';
            win = window.open(url, `display_${displayTarget}`, windowFeatures);
            
            if (win) {
                // ウィンドウをセカンダリディスプレイに移動
                win.moveTo(window.screen.width, 0);
                
                // 全画面APIを使用してフルスクリーン化
                setTimeout(() => {
                    win.postMessage({ type: 'request-fullscreen' }, '*');
                }, 500);
            }
        }

        if (win) {
            this.windows[displayTarget] = win;

            // ウィンドウが閉じられたら参照を削除
            win.addEventListener('beforeunload', () => {
                delete this.windows[displayTarget];
            });
        }

        return win;
    }

    /**
     * 要素を追加して表示
     */
    async addElement(displayTarget, elementData) {
        // ウィンドウを開く
        const win = await this.openWindow(displayTarget);

        if (!win) {
            console.error('ウィンドウを開けませんでした');
            return;
        }

        // 要素データを保存
        if (!this.elements[displayTarget]) {
            this.elements[displayTarget] = [];
        }
        this.elements[displayTarget].push(elementData);

        // ウィンドウに要素を追加
        this.updateWindow(displayTarget);
    }

    /**
     * ウィンドウの表示を更新
     */
    updateWindow(displayTarget) {
        const win = this.windows[displayTarget];
        if (!win || win.closed) return;

        const elements = this.elements[displayTarget] || [];

        // postMessageで要素データを送信
        win.postMessage({
            type: 'update-elements',
            elements: elements
        }, '*');
    }

    /**
     * 要素を更新
     */
    updateElement(elementId, updates) {
        // 全ての表示先で要素を探して更新
        Object.keys(this.elements).forEach(displayTarget => {
            const elements = this.elements[displayTarget];
            const index = elements.findIndex(e => e.id === elementId);

            if (index !== -1) {
                // 要素を更新
                elements[index] = { ...elements[index], ...updates };
                this.updateWindow(displayTarget);
            }
        });
    }

    /**
     * カーソルを要素の中央に移動
     */
    moveCursorToElement(displayTarget, x, y) {
        const win = this.windows[displayTarget];
        if (!win || win.closed) {
            alert('表示ウィンドウが開いていません');
            return;
        }

        win.postMessage({
            type: 'show-cursor',
            x: x,
            y: y
        }, '*');

        win.focus();
    }
}

// グローバルに公開
window.displayWindowManager = new DisplayWindowManager();

// タブ切り替え機能
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');

            // すべてのタブボタンとパネルから active クラスを削除
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanels.forEach(panel => panel.classList.remove('active'));

            // クリックされたタブボタンに active クラスを追加
            this.classList.add('active');

            // 対応するタブパネルに active クラスを追加
            const targetPanel = document.getElementById(`${targetTab}-tab`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }
        });
    });

    // left-paneの一括移動コントロール
    const bulkXMinus = document.getElementById('bulk-x-minus');
    const bulkXPlus = document.getElementById('bulk-x-plus');
    const bulkXValue = document.getElementById('bulk-x-value');
    const bulkYMinus = document.getElementById('bulk-y-minus');
    const bulkYPlus = document.getElementById('bulk-y-plus');
    const bulkYValue = document.getElementById('bulk-y-value');
    const bulkApply = document.getElementById('bulk-apply-move');
    const bulkMoveCheckbox = document.getElementById('bulk-move-all');

    if (bulkXMinus && bulkXValue) {
        bulkXMinus.addEventListener('click', () => {
            const currentValue = parseInt(bulkXValue.value) || 0;
            bulkXValue.value = currentValue - 10;
        });
    }

    if (bulkXPlus && bulkXValue) {
        bulkXPlus.addEventListener('click', () => {
            const currentValue = parseInt(bulkXValue.value) || 0;
            bulkXValue.value = currentValue + 10;
        });
    }

    if (bulkYMinus && bulkYValue) {
        bulkYMinus.addEventListener('click', () => {
            const currentValue = parseInt(bulkYValue.value) || 0;
            bulkYValue.value = currentValue - 10;
        });
    }

    if (bulkYPlus && bulkYValue) {
        bulkYPlus.addEventListener('click', () => {
            const currentValue = parseInt(bulkYValue.value) || 0;
            bulkYValue.value = currentValue + 10;
        });
    }

    if (bulkApply) {
        bulkApply.addEventListener('click', () => {
            const xMove = parseInt(bulkXValue?.value) || 0;
            const yMove = parseInt(bulkYValue?.value) || 0;
            const isBulkMove = bulkMoveCheckbox ? bulkMoveCheckbox.checked : false;

            if (isBulkMove) {
                console.log(`すべてのグループを一括移動: X=${xMove}, Y=${yMove}`);
                // TODO: すべてのグループの図形を移動
            } else {
                console.log(`選択されたグループを移動: X=${xMove}, Y=${yMove}`);
                // TODO: 選択されたグループの図形を移動
            }
        });
    }

    // テーブルアクションボタン
    const newRowBtn = document.getElementById('new-row');
    const addRowBtn = document.getElementById('add-row');
    const deleteRowBtn = document.getElementById('delete-row');

    if (newRowBtn) {
        newRowBtn.addEventListener('click', () => {
            console.log('新規行を作成');
            // TODO: 新規行の作成
        });
    }

    if (addRowBtn) {
        addRowBtn.addEventListener('click', () => {
            console.log('行を追加');
            // TODO: 行の追加
        });
    }

    if (deleteRowBtn) {
        deleteRowBtn.addEventListener('click', () => {
            console.log('選択された行を削除');
            // TODO: 行の削除
        });
    }
});

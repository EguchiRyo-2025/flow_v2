/**
 * 要素一覧テーブル管理クラス
 * 左ペインのテーブルを動的に管理
 */

class ElementsTableManager {
    constructor() {
        this.currentGroupId = null;
        this.elements = [];
        this.selectedRowId = null;
        this.init();
    }

    init() {
        // localStorageから現在のグループIDを復元
        const storedGroupId = localStorage.getItem(CURRENT_GROUP_KEY);
        if (storedGroupId) {
            this.currentGroupId = parseInt(storedGroupId, 10);
            console.log('[ElementsTableManager] グループID復元:', this.currentGroupId);
            this.loadElements();
        }

        // グループ変更時のイベントリスナー
        this.setupStorageListeners();
    }

    setupStorageListeners() {
        window.addEventListener('storage', (event) => {
            if (!event) return;

            // グループIDが変更された
            if (event.key === CURRENT_GROUP_KEY) {
                const newGroupId = parseInt(event.newValue, 10);
                if (!Number.isNaN(newGroupId)) {
                    this.currentGroupId = newGroupId;
                    this.loadElements();
                }
            }

            // 要素が追加・更新されたシグナル
            if (event.key === MAPPING_SYNC_KEY && this.currentGroupId) {
                this.loadElements();
            }
        });
    }

    /**
     * 要素一覧をDBから取得して表示
     */
    async loadElements() {
        if (!this.currentGroupId) {
            console.warn('[ElementsTableManager] グループIDが設定されていません');
            return;
        }

        try {
            const response = await fetch(`/mapping/api/groups/${this.currentGroupId}/elements/list`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            this.elements = await response.json();
            console.log('[ElementsTableManager] 要素を読み込み:', this.elements);
            this.renderTable();
        } catch (error) {
            console.error('[ElementsTableManager] 要素読み込みエラー:', error);
        }
    }

    /**
     * テーブル行を描画
     */
    renderTable() {
        const tbody = document.getElementById('elements-tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (this.elements.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="4" style="text-align: center; color: #999;">要素がありません</td>';
            tbody.appendChild(tr);
            return;
        }

        this.elements.forEach((element, index) => {
            const tr = document.createElement('tr');
            tr.setAttribute('data-element-id', element.id);
            tr.classList.add('element-row');

            // タイプに応じた表示
            let typeLabel = element.element_type || 'image';
            if (typeLabel === 'image') typeLabel = '画像';
            else if (typeLabel === 'polygon') typeLabel = '多角形';
            else if (typeLabel === 'text') typeLabel = 'テキスト';
            else if (typeLabel === 'rectangle') typeLabel = '矩形';
            else if (typeLabel === 'circle') typeLabel = '円';
            else if (typeLabel === 'triangle') typeLabel = '三角形';

            // 座標表示
            const coord = `(${Math.round(element.x_position)}, ${Math.round(element.y_position)})`;

            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${typeLabel}</td>
                <td>${element.element_comment || ''}</td>
                <td>${coord}</td>
            `;

            tr.addEventListener('click', () => {
                this.selectRow(tr, element);
            });

            tbody.appendChild(tr);
        });
    }

    /**
     * 行を選択
     */
    selectRow(tr, element) {
        // 前の選択を解除
        document.querySelectorAll('#elements-tbody tr').forEach(row => {
            row.classList.remove('selected');
        });

        // 新しい行を選択
        tr.classList.add('selected');
        this.selectedRowId = element.id;

        // 選択状態をlocalStorageに保存
        localStorage.setItem(SELECTED_ELEMENT_KEY, element.id);

        console.log('[ElementsTableManager] 要素選択:', element);
    }

    /**
     * 現在選択中の要素IDを取得
     */
    getSelectedElementId() {
        return this.selectedRowId;
    }

    /**
     * グループIDを更新
     */
    updateGroupId(groupId) {
        this.currentGroupId = groupId;
        localStorage.setItem(CURRENT_GROUP_KEY, groupId);
        this.loadElements();
    }

    /**
     * 要素が追加・更新された時にテーブルを更新
     */
    refreshTable() {
        this.loadElements();
    }
}

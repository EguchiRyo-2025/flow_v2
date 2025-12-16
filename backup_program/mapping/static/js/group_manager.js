/**
 * グループ管理クラス
 */
class GroupManager {
    constructor() {
        this.currentGroupId = null;
        this.groups = [];
        this.init();
    }

    async init() {
        await this.loadGroups();
        this.setupEventListeners();
    }

    /**
     * グループ一覧をDBから読み込み
     */
    async loadGroups() {
        try {
            const response = await fetch('/api/groups');
            if (response.ok) {
                this.groups = await response.json();
                this.renderGroupTable();
            }
        } catch (error) {
            console.error('グループ読み込みエラー:', error);
        }
    }

    /**
     * グループテーブルを描画
     */
    renderGroupTable() {
        const tbody = document.querySelector('.data-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        this.groups.forEach(group => {
            const row = tbody.insertRow();
            row.setAttribute('data-group-id', group.id);
            row.innerHTML = `
                <td>${group.group_number}</td>
                <td contenteditable="true" class="editable-cell" data-field="comment">${group.comment || ''}</td>
            `;

            // 行クリックで選択
            row.addEventListener('click', () => {
                this.selectGroup(group.id, row);
            });

            // セル編集時に保存
            row.querySelectorAll('.editable-cell').forEach(cell => {
                cell.addEventListener('blur', () => {
                    this.updateGroup(group.id, row);
                });
            });
        });
    }

    /**
     * グループを選択
     */
    selectGroup(groupId, row) {
        console.log('=== selectGroup 呼び出し ===');
        console.log('groupId:', groupId);
        console.log('window.elementManager:', window.elementManager);
        
        // 既存の選択を解除
        document.querySelectorAll('.data-table tbody tr').forEach(r => {
            r.classList.remove('selected');
        });

        // 新しい行を選択
        row.classList.add('selected');
        this.currentGroupId = groupId;

        // 現在のグループIDをlocalStorageに保存（ディスプレイウィンドウで参照）
        localStorage.setItem('currentGroupId', groupId);
        console.log('currentGroupId を localStorage に保存:', groupId);

        // 右ペインの要素一覧を更新
        if (window.elementManager) {
            console.log('要素一覧を読み込み開始...');
            window.elementManager.loadElements(groupId);
        } else {
            console.error('window.elementManager が見つかりません！');
        }

        console.log('グループ選択:', groupId);
    }

    /**
     * グループ情報を更新
     */
    async updateGroup(groupId, row) {
        const cells = row.querySelectorAll('.editable-cell');
        const comment = cells[0].textContent.trim();

        try {
            const response = await fetch(`/api/groups/${groupId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    display_target: '',
                    comment: comment
                })
            });

            if (response.ok) {
                console.log('グループ更新成功');
            }
        } catch (error) {
            console.error('グループ更新エラー:', error);
        }
    }

    /**
     * イベントリスナーの設定
     */
    setupEventListeners() {
        // 新規ボタン
        const newRowBtn = document.getElementById('new-row');
        if (newRowBtn) {
            newRowBtn.addEventListener('click', () => {
                this.createGroup();
            });
        }

        // 追加ボタン（現在は新規と同じ動作）
        const addRowBtn = document.getElementById('add-row');
        if (addRowBtn) {
            addRowBtn.addEventListener('click', () => {
                this.createGroup();
            });
        }

        // 削除ボタン
        const deleteRowBtn = document.getElementById('delete-row');
        if (deleteRowBtn) {
            deleteRowBtn.addEventListener('click', () => {
                this.deleteGroup();
            });
        }
    }

    /**
     * 新しいグループを作成
     */
    async createGroup() {
        try {
            const response = await fetch('/api/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    display_target: '',
                    comment: ''
                })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('グループ作成成功:', result);
                await this.loadGroups();
            }
        } catch (error) {
            console.error('グループ作成エラー:', error);
            alert('グループの作成に失敗しました');
        }
    }

    /**
     * 選択中のグループを削除
     */
    async deleteGroup() {
        if (!this.currentGroupId) {
            alert('削除するグループを選択してください');
            return;
        }

        if (!confirm('このグループを削除しますか？')) {
            return;
        }

        try {
            const response = await fetch(`/api/groups/${this.currentGroupId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                console.log('グループ削除成功');
                this.currentGroupId = null;
                await this.loadGroups();

                // 右ペインをクリア
                if (window.elementManager) {
                    window.elementManager.clearElements();
                }
            }
        } catch (error) {
            console.error('グループ削除エラー:', error);
            alert('グループの削除に失敗しました');
        }
    }
}

// グローバルに公開
window.GroupManager = GroupManager;

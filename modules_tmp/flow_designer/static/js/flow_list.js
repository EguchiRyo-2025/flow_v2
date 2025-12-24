// flow_list.html functionality

let selectedFlowId = null;

document.addEventListener('DOMContentLoaded', async () => {
    await loadFlows();
    
    // 読込ボタン
    document.getElementById('load-flow').addEventListener('click', () => {
        if (selectedFlowId) {
            window.location.href = `/flow/designer?id=${selectedFlowId}`;
        } else {
            alert('フローを選択してください');
        }
    });
    
    // 削除ボタン
    document.getElementById('delete-flow').addEventListener('click', async () => {
        if (!selectedFlowId) {
            alert('フローを選択してください');
            return;
        }
        
        if (confirm('選択したフローを削除しますか?')) {
            try {
                const response = await fetch(`/api/flows/${selectedFlowId}`, {
                    method: 'DELETE'
                });
                const data = await response.json();
                
                if (data.success) {
                    alert('フローを削除しました');
                    selectedFlowId = null;
                    await loadFlows();
                    document.getElementById('flow-detail').innerHTML = 
                        '<p class="no-selection">左側のリストからフローを選択してください</p>';
                    document.getElementById('execute-flow').disabled = true;
                } else {
                    alert('削除に失敗しました: ' + data.message);
                }
            } catch (error) {
                console.error('Delete failed:', error);
                alert('削除中にエラーが発生しました');
            }
        }
    });
    
    // 実行ボタン
    document.getElementById('execute-flow').addEventListener('click', async () => {
        if (!selectedFlowId) return;
        
        try {
            const response = await fetch(`/api/flows/${selectedFlowId}/execute`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                alert('フローの実行を開始しました');
            } else {
                alert('実行に失敗しました: ' + data.message);
            }
        } catch (error) {
            console.error('Execute failed:', error);
            alert('実行中にエラーが発生しました');
        }
    });
});

async function loadFlows() {
    try {
        const response = await fetch('/api/flows');
        const data = await response.json();
        
        const tbody = document.getElementById('flow-list');
        tbody.innerHTML = '';
        
        if (data.success && data.flows && data.flows.length > 0) {
            data.flows.forEach((flow, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${index + 1}</td>
                    <td>${flow.name}</td>
                    <td>${flow.steps ? flow.steps.length : 0}</td>
                    <td>${flow.updated_at || '-'}</td>
                `;
                row.style.cursor = 'pointer';
                row.addEventListener('click', () => selectFlow(flow, row));
                tbody.appendChild(row);
            });
        } else {
            tbody.innerHTML = '<tr class="no-flows"><td colspan="4">保存済みのフローがありません</td></tr>';
        }
    } catch (error) {
        console.error('Failed to load flows:', error);
        document.getElementById('flow-list').innerHTML = 
            '<tr class="error"><td colspan="4">エラーが発生しました</td></tr>';
    }
}

function selectFlow(flow, rowElement) {
    // 選択状態の更新
    document.querySelectorAll('#flow-list tr').forEach(tr => tr.classList.remove('selected'));
    rowElement.classList.add('selected');
    
    selectedFlowId = flow.id;
    
    // 詳細表示
    const detailHtml = `
        <h3>${flow.name}</h3>
        <div>
            <strong>説明:</strong><br>
            <p>${flow.description || '説明なし'}</p>
        </div>
        <div>
            <strong>ステップ数:</strong> ${flow.steps ? flow.steps.length : 0}
        </div>
        <div>
            <strong>作成日:</strong> ${flow.created_at || '-'}
        </div>
        <div>
            <strong>最終更新:</strong> ${flow.updated_at || '-'}
        </div>
    `;
    
    document.getElementById('flow-detail').innerHTML = detailHtml;
    document.getElementById('execute-flow').disabled = false;
}

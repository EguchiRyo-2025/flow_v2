// Blockly読み込み確認
console.log('[Main] Blockly読み込み確認:', typeof Blockly !== 'undefined' ? 'OK' : 'NG');
if (typeof Blockly !== 'undefined') {
    console.log('[Main] Blockly version:', Blockly.VERSION);
}

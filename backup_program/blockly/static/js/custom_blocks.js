// カスタムブロック定義
const Blockly = window.Blockly;
const javascriptGenerator = window.Blockly.JavaScript;

// ===================================
// カスタムブロック例：独自関数呼び出し
// ===================================

// ブロック定義：独自関数を呼び出す
Blockly.Blocks['custom_my_function'] = {
  init: function() {
    this.appendDummyInput()
        .appendField("独自関数を実行");
    this.appendValueInput("PARAM1")
        .setCheck("String")
        .appendField("パラメータ1:");
    this.appendValueInput("PARAM2")
        .setCheck("Number")
        .appendField("パラメータ2:");
    this.setOutput(true, null);
    this.setColour(160);
    this.setTooltip("独自に定義した関数を呼び出します");
    this.setHelpUrl("");
  }
};

// コード生成：JavaScriptコード生成
javascriptGenerator.forBlock['custom_my_function'] = function(block, generator) {
  const param1 = generator.valueToCode(block, 'PARAM1', generator.ORDER_ATOMIC) || '""';
  const param2 = generator.valueToCode(block, 'PARAM2', generator.ORDER_ATOMIC) || '0';
  const code = `myCustomFunction(${param1}, ${param2})`;
  return [code, generator.ORDER_FUNCTION_CALL];
};

// ===================================
// カスタムブロック例2：API呼び出し
// ===================================

Blockly.Blocks['custom_api_call'] = {
  init: function() {
    this.appendDummyInput()
        .appendField("API呼び出し")
        .appendField(new Blockly.FieldDropdown([
          ["GET", "GET"],
          ["POST", "POST"],
          ["PUT", "PUT"],
          ["DELETE", "DELETE"]
        ]), "METHOD");
    this.appendValueInput("URL")
        .setCheck("String")
        .appendField("URL:");
    this.appendValueInput("DATA")
        .setCheck(null)
        .appendField("データ:");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(230);
    this.setTooltip("API呼び出しを行います");
    this.setHelpUrl("");
  }
};

javascriptGenerator.forBlock['custom_api_call'] = function(block, generator) {
  const method = block.getFieldValue('METHOD');
  const url = generator.valueToCode(block, 'URL', generator.ORDER_ATOMIC) || '""';
  const data = generator.valueToCode(block, 'DATA', generator.ORDER_ATOMIC) || 'null';
  
  const code = `await fetch(${url}, {
  method: '${method}',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify(${data})
});\n`;
  
  return code;
};

// ===================================
// カスタムブロック例3：ログ出力
// ===================================

Blockly.Blocks['custom_console_log'] = {
  init: function() {
    this.appendValueInput("MESSAGE")
        .setCheck(null)
        .appendField("コンソールに出力:");
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(120);
    this.setTooltip("コンソールにメッセージを出力します");
    this.setHelpUrl("");
  }
};

javascriptGenerator.forBlock['custom_console_log'] = function(block, generator) {
  const message = generator.valueToCode(block, 'MESSAGE', generator.ORDER_ATOMIC) || '""';
  const code = `console.log(${message});\n`;
  return code;
};

console.log('カスタムブロックが読み込まれました');

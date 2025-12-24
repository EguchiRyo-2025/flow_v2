/* global Blockly */
(function () {
	'use strict';

	const LabelField = (typeof Blockly !== 'undefined' && Blockly.FieldLabel) ? Blockly.FieldLabel : Blockly.FieldLabelSerializable;
	const FLOW_DESIGNER_ACTIVE_KEY = 'flowDesignerActive';

	const FlowBlockly = {
		workspace: null,
		emitUpdate,
		getFlowSteps,
		importSteps,
		refreshReferenceData: loadReferenceData,
		getLastImportSkippedCount: () => lastImportSkippedCount,
		getLastSkippedSteps: () => lastSkippedSteps.slice(),
		highlightBlock: highlightBlockAtIndex,
		clearHighlight: clearBlockHighlight
	};

	let highlightedBlockId = null;

	let mappingGroups = [];
	let mappingGroupsLoaded = false;
	let detectionOrigins = [];
	let detectionOriginsLoaded = false;
	let lastImportSkippedCount = 0;
	let lastSkippedSteps = [];
	let previewBroadcastSuppressed = false;
	let previewSelectionLocked = false;
	let previewUnlockHandler = null;

	function withPreviewSuppressed(callback) {
		const previous = previewBroadcastSuppressed;
		previewBroadcastSuppressed = true;
		try {
			return callback();
		} finally {
			previewBroadcastSuppressed = previous;
		}
	}

	function shouldBroadcastPreview() {
		return !previewBroadcastSuppressed && !previewSelectionLocked;
	}

	function lockPreviewUntilUserInteraction() {
		if (previewSelectionLocked) {
			return;
		}
		previewSelectionLocked = true;
		if (previewUnlockHandler) {
			window.removeEventListener('pointerdown', previewUnlockHandler, true);
			window.removeEventListener('keydown', previewUnlockHandler, true);
		}
		previewUnlockHandler = () => {
			previewSelectionLocked = false;
			if (previewUnlockHandler) {
				window.removeEventListener('pointerdown', previewUnlockHandler, true);
				window.removeEventListener('keydown', previewUnlockHandler, true);
				previewUnlockHandler = null;
			}
		};
		window.addEventListener('pointerdown', previewUnlockHandler, true);
		window.addEventListener('keydown', previewUnlockHandler, true);
	}

	const toolboxDefinition = {
		kind: 'categoryToolbox',
		contents: [
			{
				kind: 'category',
				name: 'Projection',
				colour: 160,
				contents: [
					{ kind: 'block', type: 'flow_projection_show' },
					{ kind: 'block', type: 'flow_projection_hide' }
				]
			},
			{
				kind: 'category',
				name: '3D Detection',
				colour: 210,
				contents: [
					{ kind: 'block', type: 'flow_detection_wait' }
				]
			},
			{
				kind: 'category',
				name: 'Flow Control',
				colour: 120,
				contents: [
					{ kind: 'block', type: 'flow_wait_seconds' }
				]
			}
		]
	};
	
	console.log('[Blockly] ツールボックス定義:', toolboxDefinition);

	document.addEventListener('DOMContentLoaded', () => {
		console.log('[Blockly] DOMContentLoaded イベント発火');
		
		const blocklyArea = document.getElementById('blocklyArea');
		const blocklyDiv = document.getElementById('blocklyDiv');
		
		console.log('[Blockly] blocklyArea:', blocklyArea);
		console.log('[Blockly] blocklyDiv:', blocklyDiv);
		console.log('[Blockly] Blockly定義:', typeof Blockly);
		
		if (!blocklyArea || !blocklyDiv) {
			console.error('[Blockly] DOM要素が見つかりません');
			return;
		}
		
		if (typeof Blockly === 'undefined') {
			console.error('[Blockly] Blocklyライブラリが読み込まれていません');
			return;
		}

		console.log('[Blockly] ブロック定義を開始...');
		defineBlocks();
		console.log('[Blockly] ブロック定義完了');

		console.log('[Blockly] ワークスペース初期化を開始...');
		try {
			FlowBlockly.workspace = Blockly.inject(blocklyDiv, {
				toolbox: toolboxDefinition,
				trashcan: true,
				renderer: 'thrasos',
				zoom: {
					controls: true,
					wheel: true,
					startScale: 1,
					maxScale: 2,
					minScale: 0.3
				}
			});
			console.log('[Blockly] ワークスペース初期化成功:', FlowBlockly.workspace);
		} catch (error) {
			console.error('[Blockly] ワークスペース初期化エラー:', error);
			return;
		}

		if (typeof ResizeObserver !== 'undefined') {
			const resizeObserver = new ResizeObserver(() => resizeWorkspace(blocklyArea, blocklyDiv));
			resizeObserver.observe(blocklyArea);
		}
		window.addEventListener('resize', () => resizeWorkspace(blocklyArea, blocklyDiv));
		resizeWorkspace(blocklyArea, blocklyDiv);

		FlowBlockly.workspace.addChangeListener((event) => {
			if (event && typeof event.isUiEvent === 'function' && event.isUiEvent()) {
				// UI イベントの場合、ブロック選択変更を処理
				if (event.type === Blockly.Events.SELECTED) {
					handleBlockSelection(event);
				}
				return;
			}
			lastImportSkippedCount = 0;
			lastSkippedSteps = [];
			emitUpdate();
		});

		window.dispatchEvent(new Event('flow-blockly-ready'));
		emitUpdate();
		loadReferenceData();
	});

	/**
	 * ブロック選択時の処理
	 * 投影ブロック（停止以外）が選択されたらプレビュー表示
	 */
	function handleBlockSelection(event) {
		if (previewSelectionLocked) {
			console.log('[Blockly] ブロック選択（ロック中のためプレビュー無効）');
			return;
		}
		if (!event.newElementId) {
			// ブロック選択解除
			console.log('[Blockly] ブロック選択解除 → プレビュークリア');
			localStorage.removeItem('blocklyPreviewGroup');
			localStorage.setItem('mappingLastUpdate', Date.now().toString());
			localStorage.setItem(FLOW_DESIGNER_ACTIVE_KEY, 'false');
			return;
		}
		
		const block = FlowBlockly.workspace.getBlockById(event.newElementId);
		if (!block) {
			return;
		}
		
		console.log('[Blockly] ブロック選択:', block.type);
		
		// 投影開始ブロックの場合のみプレビュー
		if (block.type === 'flow_projection_show') {
			const groupId = block.getFieldValue('GROUP_ID');
			if (groupId) {
				console.log('[Blockly] 投影開始ブロック選択 → プレビュー表示:', groupId);
				localStorage.setItem(FLOW_DESIGNER_ACTIVE_KEY, 'true');
				testDisplayGroup(groupId);
			}
		} else {
			// それ以外のブロック選択時はプレビューをクリア
			localStorage.removeItem('blocklyPreviewGroup');
			localStorage.setItem('mappingLastUpdate', Date.now().toString());
			localStorage.setItem(FLOW_DESIGNER_ACTIVE_KEY, 'false');
		}
	}

	function loadReferenceData() {
		Promise.all([fetchMappingGroups(), fetchDetectionOrigins()])
			.then(() => {
				refreshAllGroupFields();
				refreshAllDetectionFields();
			})
			.catch((error) => {
				console.error('Failed to load Blockly reference data:', error);
			});
	}

	async function fetchMappingGroups() {
		try {
			const response = await fetch('/mapping/api/groups');
			const data = await response.json();
			if (Array.isArray(data)) {
				mappingGroups = data;
			} else if (data && Array.isArray(data.data)) {
				mappingGroups = data.data;
			} else {
				mappingGroups = [];
			}
		} catch (error) {
			console.error('Group list fetch failed:', error);
			mappingGroups = [];
		} finally {
			mappingGroupsLoaded = true;
		}
	}

	async function fetchDetectionOrigins() {
		try {
			const response = await fetch('/detection/api/get_origins');
			const data = await response.json();
			if (data && Array.isArray(data.origins)) {
				detectionOrigins = data.origins;
			} else {
				detectionOrigins = [];
			}
		} catch (error) {
			console.error('Origin list fetch failed:', error);
			detectionOrigins = [];
		} finally {
			detectionOriginsLoaded = true;
		}
	}

	function resizeWorkspace(blocklyArea, blocklyDiv) {
		const areaRect = blocklyArea.getBoundingClientRect();
		blocklyDiv.style.width = `${areaRect.width}px`;
		blocklyDiv.style.height = `${areaRect.height}px`;
		if (FlowBlockly.workspace) {
			Blockly.svgResize(FlowBlockly.workspace);
		}
	}

	function defineBlocks() {
		console.log('[Blockly] defineBlocks() 開始');
		
		try {
			Blockly.Blocks.flow_projection_show = {
				init() {
					initProjectionBlock(this, {
						title: 'プロジェクション開始',
						tooltip: 'mappingモジュールのshow_groupアクションを実行します。'
					});
				}
			};
			console.log('[Blockly] flow_projection_show ブロック登録完了');

			Blockly.Blocks.flow_projection_hide = {
				init() {
					initProjectionBlock(this, {
						title: 'プロジェクション停止',
						tooltip: 'mappingモジュールのhide_groupアクションを実行します。'
					});
				}
			};
			console.log('[Blockly] flow_projection_hide ブロック登録完了');

			Blockly.Blocks.flow_detection_wait = {
				init() {
					initDetectionBlock(this);
				}
			};
			console.log('[Blockly] flow_detection_wait ブロック登録完了');

			Blockly.Blocks.flow_wait_seconds = {
				init() {
					this.appendDummyInput()
						.appendField('待機')
						.appendField(new Blockly.FieldNumber(3, 0), 'SECONDS')
						.appendField('秒');
					this.appendDummyInput()
						.appendField('メモ')
						.appendField(new Blockly.FieldTextInput(''), 'DESCRIPTION');
					this.setPreviousStatement(true, 'FLOW_STEP');
					this.setNextStatement(true, 'FLOW_STEP');
					this.setColour(120);
					this.setTooltip('指定した秒数だけ待機します。');
				}
			};
			console.log('[Blockly] flow_wait_seconds ブロック登録完了');
			console.log('[Blockly] defineBlocks() 完了');
		} catch (error) {
			console.error('[Blockly] defineBlocks() エラー:', error);
		}
	}

	function initProjectionBlock(block, config) {
		const groupField = createGroupDropdown(block);
		block.appendDummyInput()
			.appendField(config.title)
			.appendField('グループ')
			.appendField(groupField, 'GROUP_ID');

		block.appendDummyInput('GROUP_META')
			.appendField('コメント:')
			.appendField(new LabelField('未選択'), 'GROUP_COMMENT');

		block.appendDummyInput()
			.appendField('メモ')
			.appendField(new Blockly.FieldTextInput(''), 'DESCRIPTION');

		block.setPreviousStatement(true, 'FLOW_STEP');
		block.setNextStatement(true, 'FLOW_STEP');
		block.setColour(210);
		block.setTooltip(config.tooltip);

		updateGroupMetadata(block, block.getFieldValue('GROUP_ID'));
	}

	function initDetectionBlock(block) {
		const originField = createOriginDropdown(block);
		const judgeField = createJudgeDropdown(block);

		block.appendDummyInput()
			.appendField('3D検知')
			.appendField('原点')
			.appendField(originField, 'ORIGIN_NO');

		block.appendDummyInput('ORIGIN_META')
			.appendField('原点コメント:')
			.appendField(new LabelField('未選択'), 'ORIGIN_COMMENT');

		block.appendDummyInput()
			.appendField('判定')
			.appendField(judgeField, 'JUDGE_NO');

		block.appendDummyInput('JUDGE_META')
			.appendField('判定コメント:')
			.appendField(new LabelField('未選択'), 'JUDGE_COMMENT');

		block.appendDummyInput()
			.appendField('タイムアウト(秒)')
			.appendField(new Blockly.FieldNumber(10, 0), 'TIMEOUT');

		block.appendDummyInput()
			.appendField('失敗時')
			.appendField(new Blockly.FieldDropdown([
				['停止', 'stop'],
				['継続', 'continue']
			]), 'ON_ERROR');

		block.appendDummyInput()
			.appendField('メモ')
			.appendField(new Blockly.FieldTextInput(''), 'DESCRIPTION');

		block.setPreviousStatement(true, 'FLOW_STEP');
		block.setNextStatement(true, 'FLOW_STEP');
		block.setColour(20);
		block.setTooltip('detect_3dモジュールのdetect_touchアクションを実行し、結果を待機します。');

		refreshJudgeField(block, block.getFieldValue('ORIGIN_NO'));
		updateDetectionMetadata(block, block.getFieldValue('ORIGIN_NO'), block.getFieldValue('JUDGE_NO'));
	}

	function createGroupDropdown(block) {
		const field = new Blockly.FieldDropdown(function () {
			const currentValue = typeof this.getValue === 'function' ? this.getValue() : '';
			return buildGroupOptions(currentValue);
		}, (newValue) => {
			window.setTimeout(() => {
				updateGroupMetadata(block, newValue);
				// グループ選択時にテスト表示を実行（ユーザー操作のみ）
				if (shouldBroadcastPreview()) {
					if (newValue) {
						testDisplayGroup(newValue);
					} else {
						localStorage.removeItem('blocklyPreviewGroup');
						localStorage.setItem('mappingLastUpdate', Date.now().toString());
						localStorage.setItem(FLOW_DESIGNER_ACTIVE_KEY, 'false');
					}
				}
			}, 0);
			return newValue;
		});
		return field;
	}

	function createOriginDropdown(block) {
		const field = new Blockly.FieldDropdown(function () {
			const currentValue = typeof this.getValue === 'function' ? this.getValue() : '';
			return buildOriginOptions(currentValue);
		}, (newValue) => {
			window.setTimeout(() => {
				refreshJudgeField(block, newValue);
				updateDetectionMetadata(block, newValue, block.getFieldValue('JUDGE_NO'));
			}, 0);
			return newValue;
		});
		return field;
	}

	function createJudgeDropdown(block) {
		const field = new Blockly.FieldDropdown(function () {
			const originValue = block.getFieldValue('ORIGIN_NO');
			const currentValue = typeof this.getValue === 'function' ? this.getValue() : '';
			return buildJudgeOptions(originValue, currentValue);
		}, (newValue) => {
			window.setTimeout(() => {
				updateDetectionMetadata(block, block.getFieldValue('ORIGIN_NO'), newValue);
			}, 0);
			return newValue;
		});
		return field;
	}

	function buildGroupOptions(currentValue) {
		if (!mappingGroupsLoaded) {
			return [['(読込中...)', currentValue || '']];
		}
		if (!mappingGroups.length) {
			return [['(グループ未登録)', '']];
		}
		const options = [['選択してください', '']];
		mappingGroups.forEach((group) => {
			options.push([formatGroupLabel(group), String(group.id)]);
		});
		if (currentValue && !options.some(([, value]) => value === currentValue)) {
			options.push([`(未登録ID: ${currentValue})`, currentValue]);
		}
		return options;
	}

	function buildOriginOptions(currentValue) {
		if (!detectionOriginsLoaded) {
			return [['(読込中...)', currentValue || '']];
		}
		if (!detectionOrigins.length) {
			return [['(原点が未登録)', '']];
		}
		const options = [['選択してください', '']];
		detectionOrigins.forEach((origin) => {
			options.push([formatOriginLabel(origin), String(origin.No)]);
		});
		if (currentValue && !options.some(([, value]) => value === currentValue)) {
			options.push([`(未登録No: ${currentValue})`, currentValue]);
		}
		return options;
	}

	function buildJudgeOptions(originValue, currentValue) {
		const origin = findOriginByValue(originValue);
		if (!origin) {
			return originValue ? [[`(原点${originValue}が見つかりません)`, currentValue || '']] : [['(原点を選択)', '']];
		}
		const options = [];
		for (let judgeNo = 1; judgeNo <= 3; judgeNo += 1) {
			const judgeKey = `judge${judgeNo}`;
			const judge = origin.judge_settings ? origin.judge_settings[judgeKey] : null;
			const comment = judge && judge.comment ? `: ${judge.comment}` : '';
			options.push([`判定${judgeNo}${comment}`, String(judgeNo)]);
		}
		if (currentValue && !options.some(([, value]) => value === currentValue)) {
			options.push([`(未登録判定: ${currentValue})`, currentValue]);
		}
		return options;
	}

	function refreshAllGroupFields() {
		if (!FlowBlockly.workspace) {
			return;
		}
		const blocks = FlowBlockly.workspace.getBlocksByType ?
			FlowBlockly.workspace.getBlocksByType('flow_projection_show', false).concat(
				FlowBlockly.workspace.getBlocksByType('flow_projection_hide', false)
			) : FlowBlockly.workspace.getAllBlocks(false).filter((block) => block.type === 'flow_projection_show' || block.type === 'flow_projection_hide');

		if (!blocks.length) {
			return;
		}

		Blockly.Events.disable();
		try {
			withPreviewSuppressed(() => {
				blocks.forEach((block) => {
					const field = block.getField('GROUP_ID');
					if (!field) {
						return;
					}
					const options = buildGroupOptions(field.getValue());
					const currentValue = field.getValue();
					if (!options.some(([, value]) => value === currentValue) && options.length > 0) {
						field.setValue(options[0][1]);
					}
					updateGroupMetadata(block, field.getValue());
				});
			});
		} finally {
			Blockly.Events.enable();
			emitUpdate();
		}
	}

	function refreshAllDetectionFields() {
		if (!FlowBlockly.workspace) {
			return;
		}
		const blocks = FlowBlockly.workspace.getBlocksByType ?
			FlowBlockly.workspace.getBlocksByType('flow_detection_wait', false) :
			FlowBlockly.workspace.getAllBlocks(false).filter((block) => block.type === 'flow_detection_wait');

		if (!blocks.length) {
			return;
		}

		Blockly.Events.disable();
		try {
			withPreviewSuppressed(() => {
				blocks.forEach((block) => {
					const originField = block.getField('ORIGIN_NO');
					const judgeField = block.getField('JUDGE_NO');
					if (originField) {
						const originOptions = buildOriginOptions(originField.getValue());
						if (!originOptions.some(([, value]) => value === originField.getValue()) && originOptions.length > 0) {
							originField.setValue(originOptions[0][1]);
						}
					}
					refreshJudgeField(block, originField ? originField.getValue() : '');
					updateDetectionMetadata(block, originField ? originField.getValue() : '', judgeField ? judgeField.getValue() : '');
				});
			});
		} finally {
			Blockly.Events.enable();
			emitUpdate();
		}
	}

	function updateGroupMetadata(block, groupId) {
		const labelField = block.getField('GROUP_COMMENT');
		if (!labelField) {
			return;
		}
		if (!groupId) {
			labelField.setValue('未選択');
			return;
		}
		const group = findGroupByValue(groupId);
		if (!group) {
			labelField.setValue(mappingGroupsLoaded ? '未登録のグループ' : '読込中...');
			return;
		}
		const comment = group.comment && group.comment.trim() ? group.comment.trim() : 'コメント未設定';
		labelField.setValue(comment);
	}

	function refreshJudgeField(block, originValue) {
		const judgeField = block.getField('JUDGE_NO');
		if (!judgeField) {
			return;
		}
		const options = buildJudgeOptions(originValue, judgeField.getValue());
		if (!options.some(([, value]) => value === judgeField.getValue()) && options.length > 0) {
			judgeField.setValue(options[0][1]);
		}
	}

	function updateDetectionMetadata(block, originValue, judgeValue) {
		const originLabel = block.getField('ORIGIN_COMMENT');
		const judgeLabel = block.getField('JUDGE_COMMENT');
		const origin = findOriginByValue(originValue);

		if (!origin) {
			if (originLabel) {
				originLabel.setValue(originValue ? '原点情報なし' : '未選択');
			}
			if (judgeLabel) {
				judgeLabel.setValue('未選択');
			}
			return;
		}

		if (originLabel) {
			const originComment = origin.comment && origin.comment.trim() ? origin.comment.trim() : 'コメント未設定';
			originLabel.setValue(originComment);
		}

		const judgeKey = `judge${judgeValue}`;
		const judge = origin.judge_settings ? origin.judge_settings[judgeKey] : null;
		if (judgeLabel) {
			if (judge && judge.comment && judge.comment.trim()) {
				judgeLabel.setValue(judge.comment.trim());
			} else if (judgeValue) {
				judgeLabel.setValue('コメント未設定');
			} else {
				judgeLabel.setValue('未選択');
			}
		}
	}

	function getFlowSteps() {
		if (!FlowBlockly.workspace) {
			return [];
		}

		const steps = [];
		const topBlocks = FlowBlockly.workspace.getTopBlocks(true);
		topBlocks.sort((a, b) => a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y);

		topBlocks.forEach((topBlock) => {
			let current = topBlock;
			while (current) {
				const step = convertBlockToStep(current);
				if (step) {
					steps.push(step);
				}
				current = current.getNextBlock();
			}
		});

		return steps;
	}

	function convertBlockToStep(block) {
		switch (block.type) {
			case 'flow_projection_show':
				return {
					id: block.id,
					type: 'action',
					module: 'mapping',
					action: 'show_group',
					parameters: {
						group_id: toNumberIfValid(block.getFieldValue('GROUP_ID'))
					},
					description: block.getFieldValue('DESCRIPTION') || 'プロジェクション開始'
				};
			case 'flow_projection_hide':
				return {
					id: block.id,
					type: 'action',
					module: 'mapping',
					action: 'hide_group',
					parameters: {
						group_id: toNumberIfValid(block.getFieldValue('GROUP_ID'))
					},
					description: block.getFieldValue('DESCRIPTION') || 'プロジェクション停止'
				};
			case 'flow_detection_wait':
				return {
					id: block.id,
					type: 'action',
					module: 'detect_3d',
					action: 'detect_touch',
					parameters: {
						origin_no: toNumberIfValid(block.getFieldValue('ORIGIN_NO')),
						judge_no: toNumberIfValid(block.getFieldValue('JUDGE_NO')),
						timeout: Number(block.getFieldValue('TIMEOUT')) || 0
					},
					on_error: block.getFieldValue('ON_ERROR') || 'stop',
					description: block.getFieldValue('DESCRIPTION') || '3D検知'
				};
			case 'flow_wait_seconds':
				return {
					id: block.id,
					type: 'wait',
					duration: Number(block.getFieldValue('SECONDS')) || 0,
					description: block.getFieldValue('DESCRIPTION') || '待機'
				};
			default:
				return null;
		}
	}

	function emitUpdate() {
		const steps = getFlowSteps();
		window.dispatchEvent(new CustomEvent('flow-blockly-updated', {
			detail: {
				steps,
				skipped: lastImportSkippedCount,
				skippedSteps: lastSkippedSteps.slice()
			}
		}));
	}

	function importSteps(steps) {
		if (!FlowBlockly.workspace || !Array.isArray(steps)) {
			return;
		}

		let skipped = 0;
		lastSkippedSteps = [];
		Blockly.Events.disable();
		try {
			withPreviewSuppressed(() => {
				FlowBlockly.workspace.clear();
				let previousBlock = null;
				steps.forEach((step, index) => {
					const blockType = mapStepToBlockType(step);
					if (!blockType) {
						skipped += 1;
						lastSkippedSteps.push({ index, step });
						return;
					}

					const block = FlowBlockly.workspace.newBlock(blockType);
					applyStepToBlock(step, block);
					block.initSvg();
					block.render();

					if (previousBlock && previousBlock.nextConnection && block.previousConnection) {
						previousBlock.nextConnection.connect(block.previousConnection);
					} else {
						block.moveBy(40, 40 + index * 60);
					}

					previousBlock = block;
				});
			});
		} finally {
			Blockly.Events.enable();
		}

		lastImportSkippedCount = skipped;
		lockPreviewUntilUserInteraction();

		refreshAllGroupFields();
		refreshAllDetectionFields();
	}

	function mapStepToBlockType(step) {
		if (!step || !step.type) {
			return null;
		}

		if (step.type === 'wait') {
			return 'flow_wait_seconds';
		}

		if (step.type === 'action') {
			if (step.module === 'mapping' && step.action === 'show_group') {
				return 'flow_projection_show';
			}
			if (step.module === 'mapping' && step.action === 'hide_group') {
				return 'flow_projection_hide';
			}
			if (step.module === 'detect_3d' && step.action === 'detect_touch') {
				return 'flow_detection_wait';
			}
		}

		return null;
	}

	function applyStepToBlock(step, block) {
		switch (block.type) {
			case 'flow_projection_show':
			case 'flow_projection_hide': {
				const groupValue = step.parameters && step.parameters.group_id;
				block.setFieldValue(groupValue !== undefined ? String(groupValue) : '', 'GROUP_ID');
				block.setFieldValue(step.description || '', 'DESCRIPTION');
				updateGroupMetadata(block, block.getFieldValue('GROUP_ID'));
				break;
			}
			case 'flow_detection_wait': {
				const originValue = step.parameters && step.parameters.origin_no;
				const judgeValue = step.parameters && step.parameters.judge_no;
				const timeoutValue = step.parameters && step.parameters.timeout;
				const originFieldValue = originValue !== undefined ? String(originValue) : '';
				const judgeFieldValue = judgeValue !== undefined ? String(judgeValue) : '';
				block.setFieldValue(originFieldValue, 'ORIGIN_NO');
				block.setFieldValue(judgeFieldValue, 'JUDGE_NO');
				block.setFieldValue(Number(timeoutValue) || 0, 'TIMEOUT');
				block.setFieldValue(step.on_error || 'stop', 'ON_ERROR');
				block.setFieldValue(step.description || '', 'DESCRIPTION');
				refreshJudgeField(block, originFieldValue);
				if (judgeFieldValue) {
					block.setFieldValue(judgeFieldValue, 'JUDGE_NO');
				}
				updateDetectionMetadata(block, originFieldValue, judgeFieldValue);
				break;
			}
			case 'flow_wait_seconds':
				block.setFieldValue(Number(step.duration) || 0, 'SECONDS');
				block.setFieldValue(step.description || '', 'DESCRIPTION');
				break;
			default:
				break;
		}
	}

	function toNumberIfValid(value) {
		if (value === '' || value === null || value === undefined) {
			return value;
		}
		const numeric = Number(value);
		return Number.isFinite(numeric) ? numeric : value;
	}

	function formatGroupLabel(group) {
		const numberPart = group.group_number !== null && group.group_number !== undefined ? `#${group.group_number}` : `ID:${group.id}`;
		const comment = group.comment && group.comment.trim() ? ` ${group.comment.trim()}` : '';
		return `${numberPart}${comment}`;
	}

	function formatOriginLabel(origin) {
		const comment = origin.comment && origin.comment.trim() ? ` ${origin.comment.trim()}` : '';
		return `No.${origin.No}${comment}`;
	}

	function findGroupByValue(value) {
		return mappingGroups.find((group) => String(group.id) === String(value));
	}

	function findOriginByValue(value) {
		return detectionOrigins.find((origin) => String(origin.No) === String(value));
	}

	/**
	 * グループ選択時にテスト表示を実行
	 * 既に開いている作業台・部品棚ウィンドウにlocalStorage経由で通知
	 * @param {string} groupId - グループID
	 */
	function testDisplayGroup(groupId) {
		if (!groupId) {
			console.log('[testDisplayGroup] グループIDが空のためスキップ');
			// グループIDが空の場合はBlocklyプレビューをクリア
			localStorage.removeItem('blocklyPreviewGroup');
			localStorage.setItem('mappingLastUpdate', Date.now().toString());
			localStorage.setItem(FLOW_DESIGNER_ACTIVE_KEY, 'false');
			return;
		}
		if (previewSelectionLocked) {
			console.log('[testDisplayGroup] プレビューはロック中のため送信しません');
			return;
		}

		console.log(`[testDisplayGroup] グループ${groupId}のテスト表示を実行`);

		// Blocklyプレビュー専用のlocalStorageキーを使用
		localStorage.setItem(FLOW_DESIGNER_ACTIVE_KEY, 'true');
		localStorage.setItem('blocklyPreviewGroup', groupId);
		localStorage.setItem('mappingLastUpdate', Date.now().toString());

		console.log(`[testDisplayGroup] グループ${groupId}を作業台・部品棚に表示しました`);
	}

	/**
	 * 指定したインデックスのブロックをハイライト
	 * @param {number} stepIndex - ステップのインデックス
	 */
	function highlightBlockAtIndex(stepIndex) {
		if (!FlowBlockly.workspace) return;
		
		// 既存のハイライトをクリア
		clearBlockHighlight();
		
		const blocks = FlowBlockly.workspace.getTopBlocks(true);
		if (stepIndex < 0 || stepIndex >= blocks.length) return;
		
		const block = blocks[stepIndex];
		highlightedBlockId = block.id;
		
		// ブロックのSVG要素を取得してスタイルを適用
		const blockSvg = block.getSvgRoot();
		if (blockSvg) {
			// CSSクラスを追加
			blockSvg.classList.add('blockly-executing');
			
			// アニメーション用のスタイルを動的に追加
			if (!document.getElementById('blockly-execution-style')) {
				const style = document.createElement('style');
				style.id = 'blockly-execution-style';
				style.textContent = `
					.blockly-executing {
						animation: blockly-pulse 1s ease-in-out infinite;
						filter: drop-shadow(0 0 8px #28a745);
					}
					@keyframes blockly-pulse {
						0%, 100% {
							opacity: 1;
							filter: drop-shadow(0 0 8px #28a745);
						}
						50% {
							opacity: 0.7;
							filter: drop-shadow(0 0 15px #5cb85c);
						}
					}
				`;
				document.head.appendChild(style);
			}
		}
	}
	
	/**
	 * ブロックのハイライトをクリア
	 */
	function clearBlockHighlight() {
		if (!FlowBlockly.workspace || !highlightedBlockId) return;
		
		const block = FlowBlockly.workspace.getBlockById(highlightedBlockId);
		if (block) {
			const blockSvg = block.getSvgRoot();
			if (blockSvg) {
				blockSvg.classList.remove('blockly-executing');
			}
		}
		
		highlightedBlockId = null;
	}

	window.FlowBlockly = FlowBlockly;
})();

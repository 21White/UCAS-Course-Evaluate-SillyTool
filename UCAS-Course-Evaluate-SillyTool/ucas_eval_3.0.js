// ==UserScript==
// @name         UCAS课程自动评估脚本
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  自动填写课程和教师评估，支持可选有道 OCR、手动验证码及保存确认
// @author       LilanChen
// @icon         https://www.urongda.com/_next/image?url=%2Flogos%2Fnormal%2Fmedium%2Funiversity-of-chinese-academy-of-sciences-logo-1024px.png&w=640&q=75
// @match        *://*.ucas.ac.cn/evaluate/*
// @match        *://*.ucas.ac.cn:*/evaluate/*
// @grant        GM_xmlhttpRequest
// @connect      aidemo.youdao.com
// @license      MIT
// ==/UserScript==

//有条件的同学麻烦在github上为我点个star，谢谢大家~~~

(function() {
    'use strict';

    // 独立、版本化的同意记录：安装或从旧版升级时默认关闭，不迁移旧的隐式启用状态。
    const OCR_CONSENT_KEY = 'ucasEvaluationOcrConsentV1';
    let ocrEnabled = false;
    try { ocrEnabled = localStorage.getItem(OCR_CONSENT_KEY) === 'true'; } catch (_) { /* 存储不可用时保持关闭 */ }

    // 评价内容配置 - 按顺序匹配
    let evaluationTexts = {
        course: [
            '这门课程我最喜欢它深入浅出的讲解方式，理论与实践紧密结合，让我在轻松氛围中扎实掌握核心知识，收获满满。',
            '建议增加更多互动式教学环节，丰富案例分析，并优化课程节奏，以进一步提升学习参与度和知识吸收效率。',
            '我平均每周在这门课程上花费约6小时，包括听课、完成作业和复习预习，时间投入合理，学习节奏适中。',
            '在参与这门课之前，我对这个学科领域了解较少，兴趣一般，但课程生动的内容和实用的应用激发了我深入学习的热情。',
            '我始终保持全勤，积极参与课堂讨论，主动回答问题，与老师同学互动频繁，展现出高度的投入和良好的学习态度。'
        ],
        teacher: [
            '我最喜欢老师清晰的逻辑讲解和生动的案例分析，这种富有情感的授课方式让复杂知识变得易于理解，启发思考。',
            '老师专业素养高，讲解清晰，建议继续保持互动式教学，并适当拓展前沿知识，进一步提升课程的深度与广度。'
        ]
    };

    // 单选题和多选题配置（通过关键词匹配）
    let radioCheckboxConfig = {
        courseRadios: [
            {
                keywords: ['教室', '舒适度', '大小'],
                selectOptions: ['教室大小合适', '教室电脑和投影效果好']
            }
        ],
        courseCheckboxes: [
            {
                keywords: ['修读原因', '原因'],
                selectOptions: ['自己需求和兴趣', '口碑好', '时间适宜']
            }
        ]
    };

    // ==================== 填写功能函数 ====================

    // 增强的输入框填充函数（支持 input 和 textarea）
    function fillInput(element, text) {
        if (!element || !text) return false;

        try {
            // 方法1: 直接设置值
            element.value = text;

            // 方法2: 使用原生setter
            const elementType = element.tagName.toLowerCase();
            let nativeSetter;

            if (elementType === 'textarea') {
                nativeSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype, "value"
                ).set;
            } else if (elementType === 'input') {
                nativeSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype, "value"
                ).set;
            }

            if (nativeSetter) {
                nativeSetter.call(element, text);
            }

            // 方法3: 触发多种事件
            const events = ['input', 'change', 'blur', 'keyup', 'keydown', 'focus'];
            events.forEach(eventType => {
                const event = new Event(eventType, { bubbles: true, cancelable: true });
                element.dispatchEvent(event);
            });

            // 方法4: 触发InputEvent
            const inputEvent = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: text
            });
            element.dispatchEvent(inputEvent);

            // 聚焦和失焦
            element.focus();
            setTimeout(() => {
                element.blur();
                // 再次验证是否填充成功
                if (element.value !== text) {
                    element.value = text;
                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    element.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, 100);

            console.log(`✓ 成功填入: "${text}" 到元素 ${element.id || element.name || '(无ID)'}`);
            return true;
        } catch (e) {
            console.error('填充输入框失败:', e);
            return false;
        }
    }

    // 增强的文本框填充函数
    function fillTextArea(element, text) {
        return fillInput(element, text);
    }

    // 获取页面上所有可填写的文本框（排除配置面板的）
    function getPageTextAreas() {
        const allTextareas = Array.from(document.querySelectorAll('textarea'));
        return allTextareas.filter(ta => !ta.id.startsWith('config_'));
    }

    // 智能选择单选题和多选题
    function selectRadiosAndCheckboxes(isCoursePage) {
        const config = isCoursePage ?
            { radios: radioCheckboxConfig.courseRadios, checkboxes: radioCheckboxConfig.courseCheckboxes } :
            { radios: [], checkboxes: [] };

        let selectedCount = 0;

        config.radios.forEach(radioConfig => {
            const allLabels = document.querySelectorAll('label, td, th, div, span');
            let questionElement = null;

            for (let label of allLabels) {
                const text = label.textContent || '';
                if (radioConfig.keywords.some(kw => text.includes(kw))) {
                    questionElement = label;
                    break;
                }
            }

            if (questionElement) {
                console.log(`  找到单选题: "${questionElement.textContent.substring(0, 30)}..."`);

                let radioGroup = questionElement.closest('tr, div, fieldset');
                if (!radioGroup) radioGroup = questionElement.parentElement;

                const radios = radioGroup ? radioGroup.querySelectorAll('input[type="radio"]') : [];

                radioConfig.selectOptions.forEach(optionText => {
                    for (let radio of radios) {
                        const radioLabel = document.querySelector(`label[for="${radio.id}"]`) ||
                                         radio.closest('label') ||
                                         radio.parentElement;

                        if (radioLabel && radioLabel.textContent.includes(optionText)) {
                            radio.checked = true;
                            radio.dispatchEvent(new Event('change', { bubbles: true }));
                            console.log(`    ✓ 选择: ${optionText}`);
                            selectedCount++;
                            break;
                        }
                    }
                });
            }
        });

        config.checkboxes.forEach(checkboxConfig => {
            const allLabels = document.querySelectorAll('label, td, th, div, span');
            let questionElement = null;

            for (let label of allLabels) {
                const text = label.textContent || '';
                if (checkboxConfig.keywords.some(kw => text.includes(kw))) {
                    questionElement = label;
                    break;
                }
            }

            if (questionElement) {
                console.log(`  找到多选题: "${questionElement.textContent.substring(0, 30)}..."`);

                let checkboxGroup = questionElement.closest('tr, div, fieldset');
                if (!checkboxGroup) checkboxGroup = questionElement.parentElement;

                const checkboxes = checkboxGroup ? checkboxGroup.querySelectorAll('input[type="checkbox"]') : [];

                checkboxConfig.selectOptions.forEach(optionText => {
                    for (let checkbox of checkboxes) {
                        const checkboxLabel = document.querySelector(`label[for="${checkbox.id}"]`) ||
                                             checkbox.closest('label') ||
                                             checkbox.parentElement;

                        if (checkboxLabel && checkboxLabel.textContent.includes(optionText)) {
                            checkbox.checked = true;
                            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                            console.log(`    ✓ 选择: ${optionText}`);
                            selectedCount++;
                            break;
                        }
                    }
                });
            }
        });

        return selectedCount;
    }

    // ==================== UI 界面 ====================

    // 创建配置面板
    const configPanel = document.createElement('div');
    configPanel.style.cssText = `
        position: fixed;
        top: 100px;
        right: 10px;
        width: 450px;
        padding: 15px;
        background-color: white;
        border: 1px solid #ccc;
        border-radius: 5px;
        z-index: 9998;
        display: none;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    `;

    function generateConfigPanelHTML() {
        return `
            <h3 style="margin-top: 0;">评价内容设置</h3>
            <p style="color: #2196F3; margin: 5px 0 15px 0; font-size: 13px;">
                💡 脚本会按顺序自动填写页面上的所有文本框，并智能识别单选题和多选题
            </p>
            <fieldset style="margin-bottom: 20px; padding: 10px; border: 1px solid #ccc;">
                <legend>验证码识别（可选）</legend>
                <label><input id="config_enableOcr" type="checkbox" ${ocrEnabled ? 'checked' : ''}>
                    启用实验性有道 OCR（默认关闭）</label>
                <p style="font-size: 13px; line-height: 1.6;">
                    开启后，点击“填写并提交”会将当前验证码图片发送到有道的演示接口，进行文字识别。
                    不发送整页截图、评价内容、账号密码或登录 Cookie。服务提供方仍可看到请求 IP。
                    接口的调用额度和长期可用性未获保证，失败或限流时停止，可手动填写验证码后继续。
                    关闭时不发送 OCR 请求。勾选即保存，可随时关闭。
                </p>
            </fieldset>
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px;">课程评价（共${evaluationTexts.course.length}条）：</h4>
                ${evaluationTexts.course.map((text, index) => `
                    <div style="margin-bottom: 10px;">
                        <p style="margin: 5px 0;">评价 ${index + 1}：</p>
                        <textarea id="config_course_${index}" class="eval-textarea"
                            style="width: 100%; height: 60px; padding: 5px; border: 1px solid #ddd; border-radius: 3px;">${text}</textarea>
                    </div>
                `).join('')}
                <button id="addCourse" style="padding: 5px 15px; background-color: #4CAF50;
                    color: white; border: none; border-radius: 3px; cursor: pointer; margin-top: 5px;">
                    ➕ 添加课程评价
                </button>
            </div>
            <div style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px;">教师评价（共${evaluationTexts.teacher.length}条）：</h4>
                ${evaluationTexts.teacher.map((text, index) => `
                    <div style="margin-bottom: 10px;">
                        <p style="margin: 5px 0;">评价 ${index + 1}：</p>
                        <textarea id="config_teacher_${index}" class="eval-textarea"
                            style="width: 100%; height: 60px; padding: 5px; border: 1px solid #ddd; border-radius: 3px;">${text}</textarea>
                    </div>
                `).join('')}
                <button id="addTeacher" style="padding: 5px 15px; background-color: #4CAF50;
                    color: white; border: none; border-radius: 3px; cursor: pointer; margin-top: 5px;">
                    ➕ 添加教师评价
                </button>
            </div>
            <div style="text-align: center; margin-bottom: 15px;">
                <button id="saveConfig" style="padding: 8px 20px; background-color: #4CAF50;
                    color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    💾 保存设置
                </button>
                <button id="resetConfig" style="padding: 8px 20px; background-color: #FF9800;
                    color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 10px;">
                    🔄 重置默认
                </button>
                <button id="clearConfig" style="padding: 8px 20px; background-color: #f44336;
                    color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🗑️ 清除配置
                </button>
            </div>
            <div style="padding: 10px; background-color: #f0f0f0; border-radius: 4px;">
                <button id="debugButton" style="padding: 6px 15px; background-color: #9C27B0;
                    color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
                    🔍 调试模式 - 查看页面元素
                </button>
            </div>
        `;
    }

    configPanel.innerHTML = generateConfigPanelHTML();

    // 创建自动填写按钮
    const autoButton = document.createElement('button');
    autoButton.innerText = '✨ 自动填写评估';
    autoButton.style.cssText = `
        position: fixed;
        top: 80px;
        right: 10px;
        z-index: 9999;
        padding: 10px 15px;
        background-color: #18d822ff;
        color: white;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    // 创建设置按钮
    const configButton = document.createElement('button');
    configButton.innerText = '⚙️ 设置评价内容';
    configButton.style.cssText = `
        position: fixed;
        top: 130px;
        right: 10px;
        z-index: 9999;
        padding: 10px 15px;
        background-color: #514f4fff;
        color: white;
        border: none;
        border-radius: 20px;
        cursor: pointer;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    // 设置按钮点击事件
    configButton.onclick = function() {
        if (configPanel.style.display === 'none') {
            configPanel.innerHTML = generateConfigPanelHTML();
            configPanel.style.display = 'block';
        } else {
            configPanel.style.display = 'none';
        }
    };

    // 事件委托处理
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'saveConfig') {
            evaluationTexts.course = [];
            evaluationTexts.teacher = [];

            let i = 0;
            while (true) {
                const textarea = document.getElementById(`config_course_${i}`);
                if (!textarea) break;
                evaluationTexts.course.push(textarea.value);
                i++;
            }

            i = 0;
            while (true) {
                const textarea = document.getElementById(`config_teacher_${i}`);
                if (!textarea) break;
                evaluationTexts.teacher.push(textarea.value);
                i++;
            }

            localStorage.setItem('evaluationTexts', JSON.stringify(evaluationTexts));
            configPanel.style.display = 'none';
            alert('✅ 设置已保存！');
        }

        else if (e.target && e.target.id === 'resetConfig') {
            evaluationTexts = {
                course: [
                    '这门课程我最喜欢它深入浅出的讲解方式，理论与实践紧密结合，让我在轻松氛围中扎实掌握核心知识，收获满满。',
                    '建议增加更多互动式教学环节，丰富案例分析，并优化课程节奏，以进一步提升学习参与度和知识吸收效率。',
                    '我平均每周在这门课程上花费约6小时，包括听课、完成作业和复习预习，时间投入合理，学习节奏适中。',
                    '在参与这门课之前，我对这个学科领域了解较少，兴趣一般，但课程生动的内容和实用的应用激发了我深入学习的热情。',
                    '我始终保持全勤，积极参与课堂讨论，主动回答问题，与老师同学互动频繁，展现出高度的投入和良好的学习态度。'
                ],
                teacher: [
                    '我最喜欢老师清晰的逻辑讲解和生动的案例分析，这种富有情感的授课方式让复杂知识变得易于理解，启发思考。',
                    '老师专业素养高，讲解清晰，建议继续保持互动式教学，并适当拓展前沿知识，进一步提升课程的深度与广度。'
                ]
            };
            localStorage.setItem('evaluationTexts', JSON.stringify(evaluationTexts));
            configPanel.innerHTML = generateConfigPanelHTML();
            alert('✅ 已重置为默认配置！');
        }

        else if (e.target && e.target.id === 'clearConfig') {
            localStorage.removeItem('evaluationTexts');
            evaluationTexts = {
                course: [''],
                teacher: ['']
            };
            configPanel.innerHTML = generateConfigPanelHTML();
            alert('✅ 配置已清除！');
        }

        else if (e.target && e.target.id === 'addCourse') {
            evaluationTexts.course.push('');
            configPanel.innerHTML = generateConfigPanelHTML();
        }

        else if (e.target && e.target.id === 'addTeacher') {
            evaluationTexts.teacher.push('');
            configPanel.innerHTML = generateConfigPanelHTML();
        }

        else if (e.target && e.target.id === 'debugButton') {
            console.log('=== 页面元素调试信息 ===');

            const textareas = getPageTextAreas();
            console.log(`📝 找到 ${textareas.length} 个可填写的 textarea:`);
            textareas.forEach((ta, idx) => {
                console.log(`  [${idx}] ID: "${ta.id}", Name: "${ta.name}", 当前值长度: ${ta.value.length}`);
            });

            const textInputs = document.querySelectorAll('input[type="text"]');
            console.log(`📝 找到 ${textInputs.length} 个 text input:`);
            textInputs.forEach((inp, idx) => {
                console.log(`  [${idx}] ID: "${inp.id}", Name: "${inp.name}"`);
            });

            const radios = document.querySelectorAll('input[type="radio"]');
            console.log(`🔘 找到 ${radios.length} 个单选按钮`);

            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            console.log(`☑️ 找到 ${checkboxes.length} 个多选框`);

            alert('📊 调试信息已输出到控制台！\n请按 F12（Mac 上为 ⌘+⌥+I）打开开发者工具查看 Console 标签页。');
        }
    });

    // 从localStorage加载配置
    const savedConfig = localStorage.getItem('evaluationTexts');
    if (savedConfig) {
        try {
            evaluationTexts = JSON.parse(savedConfig);
            configPanel.innerHTML = generateConfigPanelHTML();
        } catch (e) {
            localStorage.removeItem('evaluationTexts');
        }
    }

    // 自动填写逻辑
    function fillEvaluation() {
        let successCount = 0;
        let failCount = 0;

        console.log('==================');
        console.log('🚀 开始自动填写评估...');

        if (window.location.pathname.includes('/evaluateCourse')) {
            // 1. 选择所有5分选项
            const radios = document.querySelectorAll('input[type="radio"][value="5"]');
            radios.forEach(radio => {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            });
            console.log(`✓ 已选择 ${radios.length} 个5分选项`);

            // 2. 获取页面上的所有文本框并按顺序填写
            const textareas = getPageTextAreas();
            console.log(`📝 找到 ${textareas.length} 个文本框`);
            console.log(`📋 准备填写 ${evaluationTexts.course.length} 条评价`);

            evaluationTexts.course.forEach((text, index) => {
                if (index < textareas.length && text.trim()) {
                    const textarea = textareas[index];
                    console.log(`正在填写第 ${index + 1} 个文本框 (ID: ${textarea.id})...`);

                    if (fillTextArea(textarea, text)) {
                        console.log(`  ✓ 成功填写: "${text.substring(0, 20)}..."`);
                        successCount++;
                    } else {
                        console.log(`  ✗ 填写失败`);
                        failCount++;
                    }
                } else if (index >= textareas.length) {
                    console.log(`⚠️ 评价数量(${evaluationTexts.course.length})超过文本框数量(${textareas.length})`);
                }
            });

            // 3. 自动选择特定的单选题和多选题
            const specificRadio = document.querySelector('input[type="radio"][id="1462"]');
            if (specificRadio) {
                specificRadio.checked = true;
                specificRadio.dispatchEvent(new Event('change', { bubbles: true }));
                console.log('✓ 已选择特定单选题');
            }

            const checkboxIds = ['1469', '1471'];
            checkboxIds.forEach(id => {
                const cb = document.querySelector(`input[type="checkbox"][id="${id}"]`);
                if (cb) {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`✓ 已选择多选框: ${id}`);
                }
            });

            // 4. 智能选择单选题和多选题
            console.log('📋 开始处理单选题和多选题...');
            const extraSelected = selectRadiosAndCheckboxes(true);
            console.log(`✓ 额外选择了 ${extraSelected} 个选项`);

            console.log('==================');
            if (failCount) throw new Error(`有 ${failCount} 项填写失败，请检查后继续`);

        } else if (window.location.pathname.includes('/evaluateTeacher')) {
            // 1. 选择所有5分选项
            const radios = document.querySelectorAll('input[type="radio"][value="5"]');
            radios.forEach(radio => {
                radio.checked = true;
                radio.dispatchEvent(new Event('change', { bubbles: true }));
            });
            console.log(`✓ 已选择 ${radios.length} 个5分选项`);

            // 2. 获取页面上的所有文本框并按顺序填写
            const textareas = getPageTextAreas();
            console.log(`📝 找到 ${textareas.length} 个文本框`);
            console.log(`📋 准备填写 ${evaluationTexts.teacher.length} 条评价`);

            evaluationTexts.teacher.forEach((text, index) => {
                if (index < textareas.length && text.trim()) {
                    const textarea = textareas[index];
                    console.log(`正在填写第 ${index + 1} 个文本框 (ID: ${textarea.id})...`);

                    if (fillTextArea(textarea, text)) {
                        console.log(`  ✓ 成功填写: "${text.substring(0, 20)}..."`);
                        successCount++;
                    } else {
                        console.log(`  ✗ 填写失败`);
                        failCount++;
                    }
                } else if (index >= textareas.length) {
                    console.log(`⚠️ 评价数量(${evaluationTexts.teacher.length})超过文本框数量(${textareas.length})`);
                }
            });

            console.log('==================');
            if (failCount) throw new Error(`有 ${failCount} 项填写失败，请检查后继续`);
        }
    };


    // 当前页操作：不跨课程批量提交；确认弹窗只在一次明确的保存操作期间处理。
    const submitButton = autoButton.cloneNode(true);
    submitButton.id = 'ucas_submit';
    submitButton.textContent = '🚀 填写并提交 · 3.3';
    submitButton.style.top = '180px';
    const continueButton = autoButton.cloneNode(true);
    continueButton.id = 'ucas_continue';
    continueButton.textContent = '验证码已填，继续提交';
    continueButton.style.top = '230px';
    const statusBox = document.createElement('div');
    statusBox.id = 'ucas_status';
    statusBox.setAttribute('role', 'status');
    statusBox.style.cssText = 'position:fixed;top:285px;right:10px;max-width:330px;padding:12px;background:#fff;color:#222;border:1px solid #aaa;z-index:9999;white-space:pre-wrap';
    statusBox.textContent = ocrEnabled ? '有道 OCR 已开启：点击填写并提交将发送验证码图片。' : 'OCR 默认关闭：请手动填写验证码；可在设置中阅读说明并开启。';
    document.body.append(submitButton, continueButton, statusBox);
    let running = false;
    const pendingKey = 'ucas-eval-pending:' + location.pathname;
    let uncertain = sessionStorage.getItem(pendingKey) === 'pending';
    let completed = sessionStorage.getItem(pendingKey) === 'success';
    const unlockButton = autoButton.cloneNode(true);
    unlockButton.id = 'ucas_unlock';
    unlockButton.textContent = '已核实未提交，允许重试';
    unlockButton.style.top = '350px';
    unlockButton.hidden = !uncertain;
    document.body.append(unlockButton);
    unlockButton.onclick = () => {
        uncertain = false;
        sessionStorage.removeItem(pendingKey);
        unlockButton.hidden = true;
        notify('已解除重复提交保护，可再次操作');
    };
    const visible = el => !!el && el.isConnected && !el.closest('[hidden]') &&
        getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && el.getClientRects().length > 0;
    const buttonText = el => (el.textContent || el.value || '').replace(/\s/g, '');
    const notify = text => { statusBox.textContent = text; };
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const pageInputs = root => [...root.querySelectorAll('input:not([type=hidden]):not([type=radio]):not([type=checkbox]):not([type=button]):not([type=submit])')]
        .filter(el => visible(el) && !configPanel.contains(el) && !el.disabled);
    function unique(elements, description) {
        if (elements.length !== 1) throw new Error(`无法唯一定位${description}（找到 ${elements.length} 个），已停止，请手动检查页面`);
        return elements[0];
    }
    function locatePage() {
        if (!/\/evaluate(?:Course|Teacher)(?:\/|$)/.test(location.pathname)) throw new Error('请进入具体课程或教师的评价填写页面');
        const candidates = pageInputs(document).filter(el => {
            if (/captcha|valid(?:ate|ation)?(?:code)?|verifycode|checkcode|randomcode|vcode/i.test(`${el.id} ${el.name} ${el.placeholder}`)) return true;
            let parent = el.parentElement;
            for (let depth = 0; parent && depth < 4; depth++, parent = parent.parentElement) {
                if (parent.textContent.length < 200 && /验证码/.test(parent.textContent) && pageInputs(parent).length === 1) return true;
            }
            return false;
        });
        const input = unique(candidates, '验证码输入框');
        const root = input.form || input.closest('form') || document;
        const images = [...root.querySelectorAll('img')].filter(visible);
        let matching = images.filter(el => /captcha|valid|verify|checkcode|randomcode|vcode/i.test(`${el.id} ${el.src} ${el.alt} ${el.title}`));
        if (!matching.length) {
            // 使用验证码输入框附近的唯一小图，避免选中校徽或用户头像。
            const box = input.getBoundingClientRect();
            matching = images.filter(el => {
                const b = el.getBoundingClientRect();
                return b.width >= 25 && b.width <= 200 && b.height >= 10 && b.height <= 80 &&
                    Math.abs(b.top - box.top) < 45 && b.left >= box.left && b.left - box.right < 180;
            });
        }
        const image = unique(matching, '验证码图片');
        const save = unique([...root.querySelectorAll('button, input[type=submit], input[type=button], a')]
            .filter(el => visible(el) && !el.disabled && !configPanel.contains(el) &&
                ![autoButton, submitButton, continueButton, configButton].includes(el) && buttonText(el) === '保存'), '保存按钮');
        return { input, image, save, root };
    }
    function validateAnswers(page) {
        const areas = getPageTextAreas().filter(visible);
        if (!areas.length || areas.some(el => !el.value.trim())) throw new Error('存在未填写的评价文本框，请补充评价内容');
        const radios = [...page.root.querySelectorAll('input[type=radio]')].filter(visible);
        const groups = new Map();
        for (const radio of radios) {
            if (!radio.name) continue;
            if (!groups.has(radio.name)) groups.set(radio.name, []);
            groups.get(radio.name).push(radio);
        }
        if ([...groups.values()].some(group => !group.some(el => el.checked))) throw new Error('存在未选择的单选题，请补充后继续');
        const invalid = [...page.root.querySelectorAll('input,textarea,select')].find(el => el !== page.input && visible(el) && !configPanel.contains(el) && !el.checkValidity());
        if (invalid) { invalid.reportValidity(); throw new Error('存在未完成或格式不正确的必答项'); }
    }
    function imageData(image) {
        if (!image.complete || !image.naturalWidth) throw new Error('验证码图片尚未加载完成，请稍后重试');
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        try {
            canvas.getContext('2d').drawImage(image, 0, 0);
            return canvas.toDataURL('image/png').split(',')[1];
        } catch (_) { throw new Error('无法读取当前验证码图片，请手动填写验证码后继续'); }
    }
    function parseOCR(data) {
        if (['411', '412', '1411'].includes(String(data.errorCode))) throw new Error('有道接口访问频率受限，已停止请求；请手动填写验证码后继续');
        if (String(data.errorCode) !== '0') throw new Error(`有道演示接口返回错误 ${data.errorCode ?? '未知'}，请用 MouseInc 或手动填写验证码后继续`);
        // MouseInc 的 ocrapi1 返回顶层 lines，words 是字符串；兼容正式 API 的嵌套结果。
        const result = data.Result || data.result;
        const regions = result?.regions || data.regions || [];
        const lines = Array.isArray(data.lines) ? data.lines : regions.flatMap(region => region.lines || []);
        const texts = lines.map(line => line.text || (typeof line.words === 'string' ? line.words :
            (line.words || []).map(word => word.word || '').join(''))).map(text => text.replace(/\s/g, ''));
        const candidates = [...new Set(texts.filter(text => /^[a-zA-Z0-9]{4}$/.test(text)))];
        if (candidates.length !== 1) throw new Error('OCR 未返回唯一的四位字母数字，请手动填写验证码后继续');
        return candidates[0];
    }
    function recognize(base64) {
        return new Promise((resolve, reject) => {
            if (!ocrEnabled) return reject(new Error('OCR 未开启，不会发送验证码图片'));
            if (typeof GM_xmlhttpRequest !== 'function') return reject(new Error('缺少油猴跨域请求权限，请重新安装新版脚本'));
            GM_xmlhttpRequest({
                method: 'POST', url: 'https://aidemo.youdao.com/ocrapi1', anonymous: true, timeout: 12000,
                headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Referer': 'http://aidemo.youdao.com/ocrdemo' },
                data: new URLSearchParams({ imgBase: 'data:image/png;base64,' + base64, lang: 'auto', company: '' }).toString(),
                onload: response => {
                    try {
                        if (response.status === 429) throw new Error('有道接口访问频率受限，已停止请求；请手动填写验证码后继续');
                        if (response.status !== 200) throw new Error(`有道演示接口 HTTP ${response.status}`);
                        resolve(parseOCR(JSON.parse(response.responseText)));
                    } catch (error) { reject(error); }
                },
                onerror: () => reject(new Error('有道演示接口连接失败，请手动填写验证码后继续')),
                ontimeout: () => reject(new Error('有道 OCR 超时，请手动填写验证码后继续')),
                onabort: () => reject(new Error('有道 OCR 请求已取消，请手动填写验证码后继续'))
            });
        });
    }
    const confirmQuestion = /^(?:请)?确认提交(?:吗|么)?[？?]?$/;
    const normalizeText = value => value.replace(/\s/g, '');
    function confirmationContent(dialog) {
        const content = dialog.querySelector('.aui_content, .d-content, .ui-dialog-content, .messager-body, .layui-layer-content, .jbox-content');
        if (content && confirmQuestion.test(normalizeText(content.textContent))) return true;
        return [...dialog.querySelectorAll('div,span,p,td')].some(el => confirmQuestion.test(normalizeText(el.textContent)));
    }
    function dialogButtons(dialog) {
        return [...dialog.querySelectorAll('button,a,input[type=button],input[type=submit]')]
            .filter(el => visible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
    }
    function dialogs() {
        const known = [...document.querySelectorAll('.messager-window, .layui-layer, .ui-dialog, .aui_dialog, .d-dialog, .art-dialog, .jbox, [role=dialog], .modal.show, .modal.in')];
        // 旧站点存在无标准 role 的表格弹窗。由精确提示正文向上查找最近的按钮容器，
        // 不依赖标题、关闭叉号的排列顺序，也不对全页搜索到的“确定”直接点击。
        for (const content of document.querySelectorAll('div,span,p,td')) {
            if (!visible(content) || !confirmQuestion.test(normalizeText(content.textContent))) continue;
            let parent = content.parentElement;
            for (let depth = 0; parent && parent !== document.body && depth < 8; depth++, parent = parent.parentElement) {
                if (parent.textContent.length > 1200 || parent.tagName === 'FORM') break;
                if (dialogButtons(parent).some(el => /^(?:确定|确认)$/.test(buttonText(el)))) {
                    known.push(parent);
                    break;
                }
            }
        }
        const candidates = [...new Set(known)].filter(el => visible(el) && !configPanel.contains(el));
        // 同一弹窗只返回一次，避免外层和内层被分别处理。
        return candidates.filter(el => !candidates.some(other => other !== el && other.contains(el)));
    }
    function submitOnce(page) {
        // 在点击前采集基线，防止处理旧弹窗；结果不明绝不自动重新提交。
        const baseline = new Map(dialogs().map(el => [el, el.textContent]));
        return new Promise((resolve, reject) => {
            let confirmed = false;
            const started = Date.now();
            const finish = result => { clearInterval(timer); resolve(result); };
            const timer = setInterval(() => {
                try {
                    for (const dialog of dialogs()) {
                        if (baseline.get(dialog) === dialog.textContent) continue;
                        const text = dialog.textContent.replace(/\s/g, '');
                        if (/验证码.*(?:错误|不正确|无效|过期)|(?:错误|不正确|无效|过期).*验证码/.test(text)) return finish({ kind: 'captcha', dialog });
                        if (/(?:提交|保存|评价|评估|操作)成功|成功(?:提交|保存)/.test(text)) return finish({ kind: 'success' });
                        if (/(?:失败|异常|未填写|不能为空|未选择|请填写|请登录|重新登录)/.test(text)) return finish({ kind: 'error', text });
                        if (!confirmed && confirmationContent(dialog)) {
                            const ok = unique(dialogButtons(dialog)
                                .filter(el => /^(?:确定|确认)$/.test(buttonText(el))), '本次提交弹窗的确定按钮');
                            confirmed = true;
                            notify('已确认，正在等待提交结果…');
                            ok.click();
                        }
                    }
                    if (Date.now() - started > 20000) finish({ kind: 'unknown' });
                } catch (error) { clearInterval(timer); reject(error); }
            }, 100);
            try { sessionStorage.setItem(pendingKey, 'pending'); page.save.click(); } catch (error) { clearInterval(timer); reject(error); }
        });
    }
    function setControlsDisabled(disabled) {
        [submitButton, continueButton, autoButton, configButton].forEach(el => { el.disabled = disabled; });
        const checkbox = configPanel.querySelector('#config_enableOcr');
        if (checkbox) checkbox.disabled = disabled;
    }
    document.addEventListener('change', event => {
        if (event.target?.id !== 'config_enableOcr') return;
        if (running) { event.target.checked = ocrEnabled; return; }
        ocrEnabled = event.target.checked;
        try { localStorage.setItem(OCR_CONSENT_KEY, String(ocrEnabled)); }
        catch (_) {
            ocrEnabled = false;
            event.target.checked = false;
            notify('无法保存 OCR 设置，保持关闭；请手动填写验证码后继续');
            return;
        }
        notify(ocrEnabled ? '有道 OCR 已开启：点击填写并提交将发送当前验证码图片。' : '有道 OCR 已关闭，不会发送验证码图片。');
    });
    async function runSubmission(manual = false) {
        if (running || completed || uncertain) return;
        running = true;
        setControlsDisabled(true);
        try {
            const page = locatePage();
            if (!manual) { notify('正在填写评价…'); fillEvaluation(); await sleep(180); }
            validateAnswers(page);
            const useOcr = !manual && ocrEnabled;
            if (useOcr) {
                notify('正在将验证码图片发送到有道识别…');
                const before = imageData(page.image);
                const code = await recognize(before);
                if (before !== imageData(page.image)) throw new Error('验证码在识别期间已变化，请重试');
                if (!fillInput(page.input, code) || page.input.value !== code) throw new Error('验证码回填失败');
                await sleep(180);
            }
            if (!/^[a-zA-Z0-9]{4}$/.test(page.input.value.trim())) {
                throw new Error(ocrEnabled ? '请先填写四位验证码，再点击继续提交' : 'OCR 已关闭，评价已填写；请手动输入四位验证码后点击继续提交，或在设置中开启有道 OCR');
            }
            if (!page.input.checkValidity()) throw new Error('验证码格式不符合页面要求');
            validateAnswers(page);
            notify('正在保存，等待提交确认…');
            const result = await submitOnce(page);
            if (result.kind === 'success') {
                completed = true;
                sessionStorage.setItem(pendingKey, 'success');
                notify('✅ 页面已明确提示提交成功');
                return;
            }
            if (result.kind !== 'unknown') sessionStorage.removeItem(pendingKey);
            if (result.kind === 'error') throw new Error(`网站提示：${result.text}`);
            if (result.kind === 'unknown') throw new Error('未收到明确成功结果。请先检查评价状态，确认未提交后再操作，勿重复提交');
            throw new Error('验证码错误，已停止自动操作；请关闭网站提示，刷新并填写验证码后继续');
        } catch (error) {
            if (sessionStorage.getItem(pendingKey) === 'pending') {
                uncertain = true;
                unlockButton.hidden = false;
            }
            notify(`⚠️ ${error.message}`);
            console.error('[UCAS 提交]', error);
        } finally {
            running = false;
            setControlsDisabled(completed);
        }
    }
    autoButton.onclick = () => {
        if (running || completed) return;
        try { fillEvaluation(); notify('评价已填写，请检查；可点击填写并提交，或填写验证码后继续提交'); }
        catch (error) { notify(error.message); }
    };
    submitButton.onclick = () => runSubmission(false);
    continueButton.onclick = () => runSubmission(true);
    if (uncertain) notify('上次保存结果尚未确认，请先检查评价状态；确认未提交后点击“已核实未提交，允许重试”');
    if (completed) {
        notify('本页已经收到过明确的提交成功提示，已禁用重复提交');
        [submitButton, continueButton, autoButton, configButton].forEach(el => { el.disabled = true; });
    }

    // 将新元素添加到页面
    document.body.appendChild(configButton);
    document.body.appendChild(configPanel);
    document.body.appendChild(autoButton);

    console.log('✅ UCAS自动评估脚本已加载');
    console.log('💡 提示: 脚本会按顺序自动填写页面上的所有文本框');
    console.log('💡 OCR 默认关闭，可在设置中阅读图片发送说明后开启；支持手动验证码提交');
})();

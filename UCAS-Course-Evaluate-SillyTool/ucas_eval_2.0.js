// ==UserScript==
// @name         UCAS课程自动评估脚本
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  自动化填写课程和教师评估问卷
// @author       LilanChen
// @icon         https://www.urongda.com/_next/image?url=%2Flogos%2Fnormal%2Fmedium%2Funiversity-of-chinese-academy-of-sciences-logo-1024px.png&w=640&q=75
// @match        *://*.ucas.ac.cn:*/evaluate/*
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js
// @grant        none
// @license      MIT
// ==/UserScript==

//有条件的同学麻烦在github上为我点个star，谢谢大家~~~

(function() {
    'use strict';

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

            alert('📊 调试信息已输出到控制台！\n请按 F12 打开开发者工具查看 Console 标签页。');
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
    autoButton.onclick = function() {
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
            alert(`📝 课程评估填写完成！\n\n✅ 成功: ${successCount} 项\n❌ 失败: ${failCount} 项\n\n⚠️ 请手动填写验证码后提交\n\n${failCount > 0 ? '⚠️ 部分填写失败，请检查控制台或手动补充' : '🎉 全部填写成功！'}`);

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
            alert(`👨‍🏫 教师评估填写完成！\n\n✅ 成功: ${successCount} 项\n❌ 失败: ${failCount} 项\n\n⚠️ 请手动填写验证码后提交\n\n${failCount > 0 ? '⚠️ 部分填写失败，请检查控制台或手动补充' : '🎉 全部填写成功！'}`);
        }
    };

    // 将新元素添加到页面
    document.body.appendChild(configButton);
    document.body.appendChild(configPanel);
    document.body.appendChild(autoButton);

    console.log('✅ UCAS自动评估脚本已加载');
    console.log('💡 提示: 脚本会按顺序自动填写页面上的所有文本框');
    console.log('⚠️ 注意: 验证码需要手动填写');
})();
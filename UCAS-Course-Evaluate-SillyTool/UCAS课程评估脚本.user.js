// ==UserScript==
// @name         UCAS课程自动评估脚本
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  自动化填写课程和教师评估问卷 - 智能识别文本框 + 验证码自动识别
// @author       LilanChen
// @icon         https://www.urongda.com/_next/image?url=%2Flogos%2Fnormal%2Fmedium%2Funiversity-of-chinese-academy-of-sciences-logo-1024px.png&w=640&q=75
// @match        *://*.ucas.ac.cn:*/evaluate/*
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js
// @grant        none
// @license      MIT
// ==/UserScript==

//有条件的同学麻烦在github上为我点个star！谢谢大家~~~

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

    // ==================== 验证码识别相关函数 ====================
    
    // 查找验证码图片
    function findCaptchaImage() {
        // 常见的验证码图片选择器
        const selectors = [
            'img[src*="captcha"]',
            'img[src*="verif"]',
            'img[src*="code"]',
            'img[alt*="验证码"]',
            'img[title*="验证码"]',
            '#captchaImg',
            '#verifyCode',
            '.captcha-img',
            '.verify-img'
        ];
        
        for (let selector of selectors) {
            const img = document.querySelector(selector);
            if (img) return img;
        }
        
        // 如果没找到，尝试查找所有图片，看是否有验证码特征
        const allImages = document.querySelectorAll('img');
        for (let img of allImages) {
            const src = img.src.toLowerCase();
            if (src.includes('captcha') || src.includes('verif') || src.includes('code')) {
                return img;
            }
        }
        
        return null;
    }

    // 查找验证码输入框（更精确的匹配）
    function findCaptchaInput() {
        // 优先级1: 最常见的验证码输入框选择器
        const prioritySelectors = [
            'input[name="captcha"]',
            'input[name="verifyCode"]',
            'input[name="validateCode"]',
            'input[id="captcha"]',
            'input[id="verifyCode"]',
            'input[id="validateCode"]',
            'input[placeholder*="验证码"]',
            'input[placeholder*="Captcha"]',
            'input[type="text"][maxlength="4"]',
        ];
        
        for (let selector of prioritySelectors) {
            const input = document.querySelector(selector);
            if (input && input.type === 'text') {
                console.log(`🎯 优先匹配到验证码输入框: ${selector}`);
                return input;
            }
        }
        
        // 优先级2: 通过name或id模糊匹配
        const allInputs = document.querySelectorAll('input[type="text"]');
        for (let input of allInputs) {
            const name = (input.name || '').toLowerCase();
            const id = (input.id || '').toLowerCase();
            const placeholder = (input.placeholder || '').toLowerCase();
            
            // 排除明确不是验证码的字段
            if (name === 'captchatype' || id === 'captchatype') {
                continue;
            }
            
            if (name.includes('captcha') || name.includes('verif') || name.includes('code') ||
                id.includes('captcha') || id.includes('verif') || id.includes('code') ||
                placeholder.includes('验证') || placeholder.includes('captcha')) {
                console.log(`🎯 模糊匹配到验证码输入框: name="${input.name}", id="${input.id}"`);
                return input;
            }
        }
        
        // 优先级3: 查找验证码图片附近的输入框
        const captchaImg = findCaptchaImage();
        if (captchaImg) {
            const parent = captchaImg.closest('tr, div, form, td');
            if (parent) {
                const nearbyInput = parent.querySelector('input[type="text"]');
                if (nearbyInput && nearbyInput.id !== 'captchaType') {
                    console.log(`🎯 在验证码图片附近找到输入框: id="${nearbyInput.id}"`);
                    return nearbyInput;
                }
            }
        }
        
        console.log('❌ 未找到验证码输入框');
        return null;
    }

    // 图片预处理函数（增强版 - 提高识别率）
    function preprocessImage(img) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 放大3倍以提高识别率
            canvas.width = img.width * 3;
            canvas.height = img.height * 3;
            
            // 绘制原图
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            // 获取图像数据
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            
            // 增强对比度和二值化
            for (let i = 0; i < data.length; i += 4) {
                // 转灰度
                const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
                
                // 更激进的二值化阈值（增强对比度）
                const threshold = 140;
                const binary = gray > threshold ? 255 : 0;
                
                data[i] = data[i + 1] = data[i + 2] = binary;
            }
            
            // 降噪处理（简单的中值滤波）
            const processedData = new Uint8ClampedArray(data);
            for (let y = 1; y < canvas.height - 1; y++) {
                for (let x = 1; x < canvas.width - 1; x++) {
                    const idx = (y * canvas.width + x) * 4;
                    const neighbors = [];
                    
                    // 获取周围8个像素
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nIdx = ((y + dy) * canvas.width + (x + dx)) * 4;
                            neighbors.push(data[nIdx]);
                        }
                    }
                    
                    // 使用中值
                    neighbors.sort((a, b) => a - b);
                    const median = neighbors[Math.floor(neighbors.length / 2)];
                    processedData[idx] = processedData[idx + 1] = processedData[idx + 2] = median;
                }
            }
            
            // 应用处理后的数据
            for (let i = 0; i < processedData.length; i++) {
                imageData.data[i] = processedData[i];
            }
            
            ctx.putImageData(imageData, 0, 0);
            
            // 可选：反色处理（如果验证码是深色背景）
            // 检查图片主要颜色
            let darkPixels = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i] < 128) darkPixels++;
            }
            
            // 如果深色像素多于一半，则反色
            if (darkPixels > data.length / 8) {
                const invertedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < invertedData.data.length; i += 4) {
                    invertedData.data[i] = 255 - invertedData.data[i];
                    invertedData.data[i + 1] = 255 - invertedData.data[i + 1];
                    invertedData.data[i + 2] = 255 - invertedData.data[i + 2];
                }
                ctx.putImageData(invertedData, 0, 0);
            }
            
            resolve(canvas.toDataURL());
        });
    }

    // 清理识别结果（只保留数字和字母，长度为4）
    function cleanOCRResult(text) {
        // 移除所有非字母数字字符
        let cleaned = text.replace(/[^a-zA-Z0-9]/g, '');
        
        // 常见的OCR错误修正（只修正明显错误，保持原有大小写）
        cleaned = cleaned
            .replace(/O/g, '0')  // 大写O -> 0
            .replace(/o/g, '0')  // 小写o -> 0
            .replace(/I/g, '1')  // 大写I -> 1
            .replace(/l/g, '1')  // 小写l -> 1
            .replace(/S/g, '5')  // 大写S -> 5
            .replace(/Z/g, '2')  // 大写Z -> 2
            .replace(/z/g, '2'); // 小写z -> 2
        
        // 如果长度不是4，尝试截取
        if (cleaned.length > 4) {
            cleaned = cleaned.substring(0, 4);
        }
        
        // 转换为小写（因为验证码字母都是小写）
        return cleaned.toLowerCase();
    }

    // 验证码识别主函数（增强版）
    async function recognizeCaptcha() {
        try {
            console.log('🔍 开始识别验证码...');
            
            const captchaImg = findCaptchaImage();
            if (!captchaImg) {
                console.log('❌ 未找到验证码图片');
                return null;
            }
            
            console.log('✓ 找到验证码图片:', captchaImg.src);
            
            // 预处理图片
            console.log('⏳ 预处理图片中...');
            const processedImage = await preprocessImage(captchaImg);
            
            // 使用 Tesseract.js 识别（尝试多次以提高准确率）
            console.log('⏳ 正在识别中（这可能需要几秒钟）...');
            
            const result = await Tesseract.recognize(
                processedImage,
                'eng',
                {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            console.log(`识别进度: ${Math.round(m.progress * 100)}%`);
                        }
                    },
                    tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
                    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_LINE,  // 单行文本模式
                }
            );
            
            const rawText = result.data.text.trim();
            console.log('📄 原始识别结果:', rawText, '(置信度:', result.data.confidence + ')');
            
            // 如果置信度太低，尝试不同的预处理
            if (result.data.confidence < 60) {
                console.log('⚠️ 识别置信度较低，尝试原图识别...');
                const result2 = await Tesseract.recognize(
                    captchaImg,
                    'eng',
                    {
                        tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
                        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
                    }
                );
                
                const rawText2 = result2.data.text.trim();
                console.log('📄 原图识别结果:', rawText2, '(置信度:', result2.data.confidence + ')');
                
                // 使用置信度更高的结果
                const bestResult = result2.data.confidence > result.data.confidence ? rawText2 : rawText;
                const cleanedText = cleanOCRResult(bestResult);
                
                if (cleanedText.length === 4) {
                    console.log('✅ 验证码识别成功:', cleanedText);
                    return cleanedText;
                }
            }
            
            const cleanedText = cleanOCRResult(rawText);
            
            if (cleanedText.length === 4) {
                console.log('✅ 验证码识别成功:', cleanedText);
                return cleanedText;
            } else {
                console.log('⚠️ 识别结果长度不正确:', cleanedText, '(长度:', cleanedText.length + ')');
                console.log('💡 建议：点击刷新验证码或手动输入');
                return null;
            }
            
        } catch (error) {
            console.error('❌ 验证码识别失败:', error);
            return null;
        }
    }

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

    // 自动填写验证码
    async function autoFillCaptcha() {
        const captchaInput = findCaptchaInput();
        if (!captchaInput) {
            console.log('⚠️ 未找到验证码输入框');
            return false;
        }
        
        console.log('✓ 找到验证码输入框:', captchaInput.id || captchaInput.name);
        
        const code = await recognizeCaptcha();
        if (code && code.length === 4) {
            console.log(`📝 准备填入验证码: "${code}"`);
            
            // 使用增强的填充函数
            const success = fillInput(captchaInput, code);
            
            // 额外验证
            setTimeout(() => {
                if (captchaInput.value === code) {
                    console.log('✅ 验证码填入成功，当前值:', captchaInput.value);
                } else {
                    console.log('⚠️ 验证码可能未正确填入，尝试再次填入...');
                    captchaInput.value = code;
                    captchaInput.dispatchEvent(new Event('input', { bubbles: true }));
                    captchaInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }, 200);
            
            return success;
        } else {
            console.log('❌ 识别结果无效:', code);
            return false;
        }
    }

    // ==================== 原有的填写函数 ====================

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

    // 创建验证码识别按钮
    const captchaButton = document.createElement('button');
    captchaButton.innerText = '🔐 识别验证码';
    captchaButton.style.cssText = `
        position: fixed;
        top: 180px;
        right: 10px;
        z-index: 9999;
        padding: 10px 15px;
        background-color: #FF9800;
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

    // 验证码识别按钮点击事件
    captchaButton.onclick = async function() {
        captchaButton.disabled = true;
        captchaButton.innerText = '⏳ 识别中...';
        
        const success = await autoFillCaptcha();
        
        if (success) {
            captchaButton.innerText = '✅ 识别成功';
            setTimeout(() => {
                captchaButton.innerText = '🔐 识别验证码';
                captchaButton.disabled = false;
            }, 2000);
        } else {
            alert('⚠️ 验证码识别失败，请手动输入或重试');
            captchaButton.innerText = '🔐 识别验证码';
            captchaButton.disabled = false;
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
            
            const captchaImg = findCaptchaImage();
            console.log(`🔐 验证码图片:`, captchaImg ? captchaImg.src : '未找到');
            
            const captchaInput = findCaptchaInput();
            console.log(`📝 验证码输入框:`, captchaInput ? `ID="${captchaInput.id}", Name="${captchaInput.name}"` : '未找到');
            
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
    autoButton.onclick = async function() {
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

            // 5. 自动识别验证码
            console.log('🔐 开始识别验证码...');
            const captchaSuccess = await autoFillCaptcha();

            console.log('==================');
            alert(`📝 课程评估填写完成！\n\n✅ 成功: ${successCount} 项\n❌ 失败: ${failCount} 项\n${captchaSuccess ? '🔐 验证码已自动识别' : '⚠️ 验证码需要手动输入或点击"识别验证码"按钮'}\n\n${failCount > 0 ? '⚠️ 部分填写失败，请检查控制台或手动补充' : '🎉 全部填写成功！'}`);
            
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

            // 3. 自动识别验证码
            console.log('🔐 开始识别验证码...');
            const captchaSuccess = await autoFillCaptcha();

            console.log('==================');
            alert(`👨‍🏫 教师评估填写完成！\n\n✅ 成功: ${successCount} 项\n❌ 失败: ${failCount} 项\n${captchaSuccess ? '🔐 验证码已自动识别' : '⚠️ 验证码需要手动输入或点击"识别验证码"按钮'}\n\n${failCount > 0 ? '⚠️ 部分填写失败，请检查控制台或手动补充' : '🎉 全部填写成功！'}`);
        }
    };

    // 将新元素添加到页面
    document.body.appendChild(configButton);
    document.body.appendChild(configPanel);
    document.body.appendChild(autoButton);
    document.body.appendChild(captchaButton);

    console.log('✅ UCAS自动评估脚本已加载');
    console.log('💡 提示: 脚本会按顺序自动填写页面上的所有文本框');
    console.log('🔐 新功能: 支持自动识别验证码（4位数字+字母）');
    
    // 页面加载完成后，自动尝试识别验证码
    setTimeout(() => {
        const captchaImg = findCaptchaImage();
        const captchaInput = findCaptchaInput();
        if (captchaImg && captchaInput) {
            console.log('🔍 检测到验证码，可点击"识别验证码"按钮自动识别');
        }
    }, 1000);
})();

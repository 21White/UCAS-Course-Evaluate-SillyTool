
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { JSDOM } = process.env.UCAS_TEST_MODULES
    ? createRequire(path.join(process.env.UCAS_TEST_MODULES, 'package.json'))('jsdom') : require('jsdom');
const script = fs.readFileSync(path.join(__dirname, '../UCAS-Course-Evaluate-SillyTool/ucas_eval_3.0.js'), 'utf8');
function fixture({ ocr = { errorCode: '0', lines: [{ words: 'pxw8' }] }, outcome = 'success', stale = false, changeImage = false, course = false, dialogType = 'easyui', enableOCR = true, transport = 'ok', httpStatus = 200, storedConsent } = {}) {
    const dom = new JSDOM(`<form><input type="radio" name="q1" value="5"><textarea></textarea><textarea></textarea>${course ? '<textarea></textarea><textarea></textarea><textarea></textarea>' : ''}<div>验证码：<input id="code" maxlength="4"><img src="/captcha"><button type="button" id="save">保存</button></div></form>`, { url: `https://jxwk.ucas.ac.cn/evaluate/evaluate${course ? 'Course' : 'Teacher'}/123`, runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    w.console = { log() {}, error() {} };
    w.alert = () => assert.fail('流程不应使用阻塞 alert');
    w.HTMLElement.prototype.getClientRects = function () {
        for (let el = this; el; el = el.parentElement) if (el.hidden || el.style.display === 'none') return [];
        return [{}];
    };
    const timeout = w.setTimeout.bind(w);
    w.setTimeout = (fn, ms, ...args) => timeout(fn, ms / 100, ...args);
    const interval = w.setInterval.bind(w);
    w.setInterval = (fn, ms) => interval(fn, ms / 100);
    const now = Date.now;
    w.Date.now = () => now() * 100;
    let pixels = 'pixels';
    w.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} });
    w.HTMLCanvasElement.prototype.toDataURL = () => `data:image/png;base64,${pixels}`;
    const image = w.document.querySelector('img');
    Object.defineProperties(image, { complete: { value: true }, naturalWidth: { value: 60 }, naturalHeight: { value: 25 } });
    let saves = 0, confirms = 0, requests = 0, refreshes = 0;
    w.GM_xmlhttpRequest = options => {
        requests++;
        assert.equal(options.url, 'https://aidemo.youdao.com/ocrapi1');
        assert.equal(new URLSearchParams(options.data).get('imgBase'), 'data:image/png;base64,pixels');
        timeout(() => {
            if (changeImage) pixels = 'changed';
            if (transport === 'timeout') options.ontimeout();
            else if (transport === 'network') options.onerror();
            else if (transport === 'abort') options.onabort();
            else options.onload({ status: httpStatus, responseText: transport === 'badjson' ? '<html>error</html>' : JSON.stringify(ocr) });
        }, 2);
    };
    function dialog(text, click = () => {}) {
        const el = w.document.createElement('div');
        el.className = dialogType === 'art' ? 'aui_dialog' : dialogType === 'unknown' ? 'legacy-box' : 'messager-window';
        el.innerHTML = dialogType === 'art'
            ? `<a class="aui_close">×</a><h3>系统提示</h3><div class="aui_content">${text}</div><div class="aui_buttons"><button type="button">确定</button><button type="button">取消</button></div>`
            : `<h3>系统提示</h3><div>${text}</div><button type="button">确定</button>`;
        el.querySelector('button').onclick = () => { el.remove(); click(); };
        w.document.body.append(el);
        return el;
    }
    if (stale) dialog('确认提交吗？', () => assert.fail('不应点击旧确认框'));
    w.document.querySelector('#save').onclick = () => {
        saves++;
        if (outcome === 'unknown' || stale) return;
        dialog('确认提交吗？', () => {
            confirms++;
            if (outcome === 'captcha') dialog('验证码错误');
            else if (outcome === 'error') dialog('保存失败，请重新登录');
            else dialog('保存成功');
        });
    };
    image.onclick = () => { refreshes++; pixels = 'pixels'; timeout(() => image.dispatchEvent(new w.Event('load')), 2); };
    if (storedConsent !== undefined) w.localStorage.setItem('ucasEvaluationOcrConsentV1', storedConsent);
    w.eval(script);
    function toggleOCR(enabled) {
        const checkbox = w.document.querySelector('#config_enableOcr');
        checkbox.checked = enabled;
        checkbox.dispatchEvent(new w.Event('change', { bubbles: true }));
    }
    if (enableOCR) toggleOCR(true);
    return { dom, w, toggleOCR, status: () => w.document.querySelector('#ucas_status').textContent,
        click: () => w.document.querySelector('#ucas_submit').click(),
        manual: () => { w.document.querySelectorAll('form textarea').forEach(el => { el.value = '用户评价'; }); w.document.querySelector('input[type=radio]').checked = true; w.document.querySelector('#code').value = 'pxw8'; w.document.querySelector('#ucas_continue').click(); },
        counts: () => ({ saves, confirms, requests, refreshes }) };
}
async function waitFor(f, pattern) {
    const until = performance.now() + 1500;
    while (!pattern.test(f.status())) {
        if (performance.now() > until) assert.fail(`未等到 ${pattern}：${f.status()}`);
        await new Promise(resolve => setTimeout(resolve, 5));
    }
}
test('教师一键填写、OCR、保存、确认成功；重复点击被锁定', async () => {
    const f = fixture();
    try { f.click(); f.click(); await waitFor(f, /明确提示提交成功/); f.click(); assert.deepEqual(f.counts(), { saves: 1, confirms: 1, requests: 1, refreshes: 0 }); }
    finally { f.dom.window.close(); }
});
test('课程填写也进入完整提交流程', async () => {
    const f = fixture({ course: true });
    try { f.click(); await waitFor(f, /明确提示提交成功/); assert.equal(f.counts().confirms, 1); }
    finally { f.dom.window.close(); }
});
test('OCR 接口返回 305 时必须停止，手动输入后可继续且不再调用 OCR', async () => {
    const f = fixture({ ocr: { errorCode: '305' } });
    try { f.click(); await waitFor(f, /错误 305/); assert.equal(f.counts().saves, 0); f.manual(); await waitFor(f, /明确提示提交成功/); assert.equal(f.counts().requests, 1); }
    finally { f.dom.window.close(); }
});
test('OCR 返回非四位字符不能保存', async () => {
    const f = fixture({ ocr: { errorCode: '0', Result: { regions: [{ lines: [{ text: 'abcdef' }] }] } } });
    try { f.click(); await waitFor(f, /未返回唯一的四位/); assert.equal(f.counts().saves, 0); }
    finally { f.dom.window.close(); }
});
test('识别期间图片变化不能使用旧结果', async () => {
    const f = fixture({ changeImage: true });
    try { f.click(); await waitFor(f, /识别期间已变化/); assert.equal(f.counts().saves, 0); }
    finally { f.dom.window.close(); }
});
test('网站验证码错误即停止，不刷新或自动重试', async () => {
    const f = fixture({ outcome: 'captcha' });
    try { f.click(); await waitFor(f, /验证码错误，已停止/); assert.deepEqual(f.counts(), { saves: 1, confirms: 1, requests: 1, refreshes: 0 }); }
    finally { f.dom.window.close(); }
});
test('服务器其他错误不重复提交', async () => {
    const f = fixture({ outcome: 'error' });
    try { f.click(); await waitFor(f, /网站提示/); assert.equal(f.counts().saves, 1); }
    finally { f.dom.window.close(); }
});
test('结果不明时停止，不自动重提', async () => {
    const f = fixture({ outcome: 'unknown' });
    try { f.click(); await waitFor(f, /未收到明确成功结果/); assert.equal(f.counts().saves, 1); f.click(); assert.equal(f.counts().saves, 1); assert.equal(f.w.sessionStorage.getItem('ucas-eval-pending:' + f.w.location.pathname), 'pending'); }
    finally { f.dom.window.close(); }
});
test('保存前已存在的确认框不自动确认', async () => {
    const f = fixture({ stale: true });
    try { f.click(); await waitFor(f, /未收到明确成功结果/); assert.equal(f.counts().confirms, 0); }
    finally { f.dom.window.close(); }
});
test('手动验证码可直接保存确认，不调用 OCR', async () => {
    const f = fixture();
    try { f.manual(); await waitFor(f, /明确提示提交成功/); assert.equal(f.counts().requests, 0); }
    finally { f.dom.window.close(); }
});

test('未选择的单选题阻止手动继续保存', async () => {
    const f = fixture();
    try {
        f.w.document.querySelectorAll('form textarea').forEach(el => { el.value = '评价'; });
        f.w.document.querySelector('#code').value = 'pxw8';
        f.w.document.querySelector('#ucas_continue').click();
        await waitFor(f, /未选择的单选题/);
        assert.equal(f.counts().saves, 0);
    } finally { f.dom.window.close(); }
});
test('多个验证码候选元素时停止，避免填写到错误输入框', async () => {
    const f = fixture();
    try {
        const duplicate = f.w.document.createElement('input'); duplicate.id = 'captcha';
        f.w.document.querySelector('form').append(duplicate);
        f.click(); await waitFor(f, /无法唯一定位验证码输入框/);
        assert.equal(f.counts().requests, 0); assert.equal(f.counts().saves, 0);
    } finally { f.dom.window.close(); }
});

test('artDialog 标题前有关闭叉号时，仍确认且只点击一次', async () => {
    const f = fixture({ dialogType: 'art' });
    try { f.manual(); await waitFor(f, /明确提示提交成功/); assert.equal(f.counts().confirms, 1); }
    finally { f.dom.window.close(); }
});
test('没有已知 class 或 role 的确认弹窗也可由精确正文定位', async () => {
    const f = fixture({ dialogType: 'unknown', outcome: 'unknown-after-confirm' });
    try { f.manual(); await waitFor(f, /未收到明确成功结果/); assert.equal(f.counts().confirms, 1); }
    finally { f.dom.window.close(); }
});
test('MouseInc 顶层 lines/words 响应可正确解析', async () => {
    const f = fixture({ ocr: { orientation: 'UP', errorCode: '0', lines: [{ words: 'pd38' }] } });
    try { f.click(); await waitFor(f, /明确提示提交成功/); assert.equal(f.w.document.querySelector('#code').value, 'pd38'); }
    finally { f.dom.window.close(); }
});
test('多个不同的四位 OCR 结果不能猜测提交', async () => {
    const f = fixture({ ocr: { errorCode: '0', lines: [{ words: 'pxw8' }, { words: 'pd38' }] } });
    try { f.click(); await waitFor(f, /未返回唯一/); assert.equal(f.counts().saves, 0); }
    finally { f.dom.window.close(); }
});

test('首次安装默认关闭：无后台 OCR 请求，点击填写也不会上传或保存', async () => {
    const f = fixture({ enableOCR: false });
    try {
        assert.equal(f.w.document.querySelector('#config_enableOcr').checked, false);
        assert.deepEqual(f.counts(), { saves: 0, confirms: 0, requests: 0, refreshes: 0 });
        f.click(); await waitFor(f, /OCR 已关闭/);
        assert.equal(f.counts().requests, 0); assert.equal(f.counts().saves, 0);
        assert.ok(f.w.document.querySelector('textarea').value);
    } finally { f.dom.window.close(); }
});
test('默认关闭时手动验证码可保存确认，保持零上传', async () => {
    const f = fixture({ enableOCR: false });
    try { f.manual(); await waitFor(f, /明确提示提交成功/); assert.equal(f.counts().requests, 0); }
    finally { f.dom.window.close(); }
});
test('关闭已开启的 OCR 后，填写提交不再发送验证码', async () => {
    const f = fixture();
    try {
        f.toggleOCR(false);
        assert.equal(f.w.localStorage.getItem('ucasEvaluationOcrConsentV1'), 'false');
        f.click(); await waitFor(f, /OCR 已关闭/); assert.equal(f.counts().requests, 0);
    } finally { f.dom.window.close(); }
});
test('已明确保存的同意可恢复，说明在勾选前可见于设置', async () => {
    const f = fixture({ enableOCR: false, storedConsent: 'true' });
    try {
        assert.equal(f.w.document.querySelector('#config_enableOcr').checked, true);
        assert.match(f.w.document.querySelector('#config_enableOcr').closest('fieldset').textContent, /验证码图片发送到有道/);
        f.click(); await waitFor(f, /明确提示提交成功/); assert.equal(f.counts().requests, 1);
    } finally { f.dom.window.close(); }
});
for (const transport of ['timeout', 'network', 'abort', 'badjson']) {
    test(`OCR ${transport} 错误停止，最多一次请求且不保存`, async () => {
        const f = fixture({ transport });
        try { f.click(); await waitFor(f, /⚠️/); assert.equal(f.counts().requests, 1); assert.equal(f.counts().saves, 0); }
        finally { f.dom.window.close(); }
    });
}
for (const code of ['411', '412', '1411']) {
    test(`OCR 限流 ${code} 不自动重试`, async () => {
        const f = fixture({ ocr: { errorCode: code } });
        try { f.click(); await waitFor(f, /访问频率受限/); assert.equal(f.counts().requests, 1); assert.equal(f.counts().saves, 0); }
        finally { f.dom.window.close(); }
    });
}
test('HTTP 429 限流立即停止', async () => {
    const f = fixture({ httpStatus: 429 });
    try { f.click(); await waitFor(f, /访问频率受限/); assert.equal(f.counts().requests, 1); assert.equal(f.counts().saves, 0); }
    finally { f.dom.window.close(); }
});

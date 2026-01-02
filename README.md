# 国科大课程评价工具-懒人版
<p align="center">
  <img src="/assets/SillyTool.png" alt="image" width="400">
</p>

> **脚本功能：自动化填写课程和教师评估问卷 - 智能识别文本框 + 验证码自动识别**
> 

> 又到了半年一度的果壳课评环节，每当一门课程进度过半时就会开启课评。每节课的课评用鼠标一个一个点确实很麻烦，更不必说一些多教师参与授课的大课还得对每一位老师评价，因此就想在github上找找看有没有之前学长学姐们写的脚本，可惜SEP评课系统有所更新，现有脚本不能直接使用，因此我准备重新写一个适配25FALL的油猴脚本，供果壳的大家使用~
> 

> 在此我向大家保证，0基础小白也能轻松上手，学不会你打我lalala（不是

---

**25/12/27更新**

**根据同学们的反馈，更新了课评插件2.0版本，取消了正确率不高的本地验证码识别，让课评更加丝滑。**

<p align="center">
  <img src="/assets/dove.png" alt="image" width="300">
</p>

---

**25/11/26更新**

**狡猾的教务处把课评网址子域名改了，导致之前的插件不能用了，目前已更新，请大家放心使用**

<p align="center">
  <img src="/assets/fox.jpg" alt="image" width="300">
</p>

---

**Ps：有朋友私信，就安利一下我现在在用的梯子，比较好用。可以进行全局代理，节点稳定。无痛访问ChatGPT(OpenAI)、Claude、Google Gemini等AI工具，感兴趣的朋友可以试一试~**

[https://222m.izenny.com/#/register?code=K8QoCddx](https://222m.izenny.com/#/register?code=K8QoCddx)

---

# 步骤一

虔诚地在心中默念，我爱国科大，国科大爱我，伟大的果壳神会保佑每一个在果壳的学子。

**注：这点很重要，不能跳过！**

---

# 步骤二

**安装油猴**

这里无论是Edge还是Chrome浏览器都大差不差，我以Edge浏览器为例

<p align="center">
  <img src="/assets/image.png" alt="image" width="800">
</p>

打开一个新的页面，点击扩展 - 获取 Microsoft Edge 扩展

<p align="center">
  <img src="/assets/image%201.png" alt="image" width="500">
</p>

搜索TamperMonkey，点击第一个绿色的软件，安装即可（我装过了）

<p align="center">
  <img src="/assets/image%202.png" alt="image" width="800">
</p>

<p align="center">
  <img src="/assets/image%203.png" alt="image" width="800">
</p>

接着，点击扩展 - 篡改猴 旁边的··· - 管理扩展

<p align="center">
  <img src="/assets/image%204.png" alt="image" width="400">
</p>

一定要确认开发人员模式被打开，否则脚本没办法正常运行

<p align="center">
  <img src="/assets/image%205.png" alt="image" width="400">
</p>

这一步就到这里结束了

---

# 步骤三

下面两种方式 **任选其一** 即可~

[1、github](https://www.notion.so/1-github-29e34301aac3809ba4ddc0c33cc40393?pvs=21) 

[2、GreasyFork（油叉）](https://www.notion.so/2-GreasyFork-29e34301aac3805a92e7f4316ba417e1?pvs=21) 

## 1、github

打开下面的网址：

[https://github.com/21White/UCAS-Course-Evaluate-SillyTool](https://github.com/21White/UCAS-Course-Evaluate-SillyTool)

页面长这样：

<p align="center">
  <img src="/assets/image%206.png" alt="image" width="400">
</p>

接着，点击绿色按钮Code，并点击Download ZIP

<p align="center">
  <img src="/assets/image%207.png" alt="image" width="400">
</p>

然后你就下载了一个压缩包.zip文件

<p align="center">
  <img src="/assets/image%208.png" alt="image" width="400">
</p>

解压这个文件，得到

<p align="center">
  <img src="/assets/image%209.png" alt="image" width="400">
</p>

ok，这一步就先到这里

- [ ]  **这里麻烦大家帮我点一个Star！这对我很重要！谢谢！**

<p align="center">
  <img src="/assets/image%2010.png" alt="image" width="800">
</p>

**如果你没有梯子，也可以选择国内镜像**

https://gitee.com/ziyangChen21/UCAS-Course-Evaluate-SillyTool

也是一样，下载.zip文件并解压

## 2、GreasyFork（油叉）

墙内：油叉镜像

https://home.greasyfork.org.cn/zh-hans

<p align="center">
  <img src="/assets/image%2011.png" alt="image" width="600">
</p>

搜索：**UCAS课程自动评估脚本**

第一个作者为LilanChen的就是~

<p align="center">
  <img src="/assets/image%2012.png" alt="image" width="600">
</p>

点击，安装此脚本，即可跳转至油猴（TamperMonkey）安装页面

<p align="center">
  <img src="/assets/image%2013.png" alt="image" width="600">
</p>

点击安装即可（因为我装过了所以是重新安装）

<p align="center">
  <img src="/assets/image%2014.png" alt="image" width="600">
</p>

---

# 步骤四

接下来我们将脚本导入油猴

这里在步骤三选用方法2的朋友应该就不用再执行步骤四了

点击扩展 - 篡改猴 - 管理面板

<p align="center">
  <img src="/assets/image%2015.png" alt="image" width="400">
</p>

<p align="center">
  <img src="/assets/image%2016.png" alt="image" width="400">
</p>

点击 实用工具 - 导入（选择文件）- 选择解压后文件夹中的.js脚本 - 安装

<p align="center">
  <img src="/assets/image%2017.png" alt="image" width="600">
</p>

<p align="center">
  <img src="/assets/image%2018.png" alt="image" width="400">
</p>

这样我们所有的准备工作就全部完成了，下面让我们打开SEP网站开始实操！

# 步骤五

打开国科大SEP网站，找到课评板块。点击课程/教师评估，进入评估页面

<p align="center">
  <img src="/assets/2ge_image_1.jpg" alt="image" width="600">
</p>

设置评价内容中，你可以看到我的代码中预设好的评价，我强烈建议你**稍微改改**，别果壳所有人都用一个（我对传播广度还是太自信了hhhh，之后的教师评价也一样。

修改完记得**保存设置，**如果卡bug了请点击**重置默认**

如果发现页面右上角没有这些按钮，请回到步骤二，看看有没有打开油猴的**开发人员模式**！！！

<p align="center">
  <img src="/assets/2ge_image_2.jpg" alt="image" width="600">
</p>
<p align="center">
  <img src="/assets/2ge_image_3.jpg" alt="image" width="600">
</p>

好的，如果一切顺利脚本会自动填写，稍微等一下就能显示填写成功。失败也不要怕，刷新一下就行，

<p align="center">
  <img src="/assets/2ge_image_4.jpg" alt="image" width="400">
</p>

# 步骤六

**(1.0版本)**
点击识别验证码，大概3~5秒即可自动识别并填写，如正确提交即可！
由于识别验证码部分没有调用模型识别，仅为图像处理，因此准确率不高，你可以选择**刷新验证码重新点击识别 或 自己输入（笑）**
<p align="center">
  <img src="/assets/image%2022.png" alt="image" width="400">
</p>

**(2.0版本)**
**更新后不再有验证码本地识别功能，请自行输入！**
<p align="center">
  <img src="/assets/2ge_image_5.jpg" alt="image" width="400">
</p>
点击保存，这样就大功告成了！

最后还是：

# **麻烦大家帮我点一个Star！这对我很重要！谢谢！**

<p align="center">
  <img src="/assets/image%2010.png" alt="image" width="1000">
</p>

---
# **感谢大家的Star，最近在构思给各位Star的朋友抽3份我自己做的文创，大家可以期待一下~**
**ps:目前的想法是我会给第100位star的朋友&随机在star列表中抽3位送出小礼物，提前祝大家新年快乐！**

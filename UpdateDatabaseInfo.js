const express = require('express');
const mongoose = require('mongoose');

const app = express();
const PORT = 8080;

// 将USERNAME和PASSWORD替换为MongoDB数据库账号和密码，如果是阿里云副本集，需要保留末尾的 ?replicaSet=xxx 参数
const MONGO_URI = 'mongodb://USERNAME:PASSWORD@YOUR_MONGODB_HOST:PORT/DATABASE_NAME?replicaSet=REPLICA_SET_NAME';

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB 连接成功'))
  .catch(err => console.error('❌ MongoDB 连接失败:', err));

const applicationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  appSecret: { type: String },
  accessToken: { type: String },
  accessTime: { type: Date }
}, { collection: 'YourCollection' });

const YourCollection = mongoose.model('YourCollection', applicationSchema);

// 这是一个白名单，为了防止误更新，只要appName不在白名单，请求会被打回
// ALLOWED_APPS表示哪些应用需要更新，NEEDS_SECRET表示哪些应用需要appSecret和accessToken都更新才有用
const ALLOWED_APPS = ['DataApp1', 'DataApp2', 'DataApp3'];
const NEEDS_SECRET = ['DataApp2', 'DataApp3'];

app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <title>每日参数更新工具</title>
        <style>
            body { font-family: sans-serif; padding: 30px; max-width: 800px; margin: 0 auto; background: #f4f6f9; }
            .box { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            select, textarea, input[type=text] { width: 100%; padding: 10px; margin-top: 10px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 14px;}
            textarea { height: 100px; resize: vertical;}
            button { background: #007bff; color: white; border: none; padding: 12px 20px; margin-top: 20px; border-radius: 4px; cursor: pointer; font-size: 16px; width: 100%; }
            button:hover { background: #0056b3; }
            .label-tip { color: #888; font-size: 12px; margin-left: 5px; }
            .status-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px dashed #eef0f3; font-size: 14px; }
            .status-item:last-child { border-bottom: none; }
            .status-dot { display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
            .dot-ok { background-color: #28a745; box-shadow: 0 0 0 3px rgba(40,167,69,0.15); }
            .dot-expired { background-color: #dc3545; box-shadow: 0 0 0 3px rgba(220,53,69,0.15); }
            .status-time { color: #999; font-size: 12px; }
            hr { border: none; border-top: 1px solid #eef0f3; margin: 18px 0; }
        </style>
    </head>
    <body>
        <div class="box">
            <h2>🔧 更新 YourCollection 数据</h2>
            <h3>需更新的应用当前状态</h3>
            <div id="statusList" style="margin-top:10px; font-size:14px;">加载中...</div>
            <hr>
            <p class="warnning">⚠️注意：当前操作会直接更新数据库，请确认所填信息无误后再提交。</p>
            <form action="/update" method="POST">
                <label>选择要更新的应用：</label>
                <select name="appName">
                    <option value="DataApp1">DataApp1</option>
                    <option value="DataApp2">DataApp2</option>
                    <option value="DataApp3">DataApp3</option>
                </select>
                
                <label style="margin-top:15px; display:block;">最新的 accessToken / Cookie：<span class="label-tip">(选填，不填不会修改)</span></label>
                <textarea name="newCookie" placeholder="粘贴 F12 抓包得到的完整 Cookie 字符串..."></textarea>
                
                <label style="margin-top:15px; display:block;">最新的 appSecret：<span class="label-tip">(选填，不填不会修改)</span></label>
                <input type="text" name="newAppSecret" placeholder="如果需要更新 appSecret，请粘贴到这里...">
                
                <button type="submit">更新至数据库</button>
            </form>
        </div>
        <script>
            async function loadStatus() {
                try {
                    const resp = await fetch('/appToken/status');
                    const result = await resp.json();
                    const container = document.getElementById('statusList');

                    if (result.code !== 0 || !result.data || result.data.length === 0) {
                        container.innerHTML = '<p style="color:#888;">暂无数据</p>';
                        return;
                    }

                    let html = '';
                    result.data.forEach(function (item) {
                        var dotClass = item.status === 'ok' ? 'dot-ok' : 'dot-expired';
                        var text = item.status === 'ok' ? '有效' : '失效';
                        var timeText = item.accessTime ? new Date(item.accessTime).toLocaleString('zh-CN') : '从未更新';

                        html += '<div class="status-item">'
                            +   '<div><b>' + item.name + '</b></div>'
                            +   '<div><span class="status-dot ' + dotClass + '"></span>' + text + '</div>'
                            +   '<div class="status-time">' + timeText + '</div>'
                            +   '</div>';
                    });
                    container.innerHTML = html;
                } catch (err) {
                    document.getElementById('statusList').innerHTML = '<p style="color:red;">状态加载失败</p>';
                }
            }

            loadStatus();
            setInterval(loadStatus, 60000);
        </script>
    </body>
    </html>
  `);
});

// 状态接口
app.get('/appToken/status', async (req, res) => {
  try {
    const list = [];

    for (const appName of ALLOWED_APPS) {
      const doc = await YourCollection.findOne(
        { name: appName },
        'name accessToken appSecret accessTime'
      );

      let valid = false;
      let accessTime = null;

      if (doc) {
        const tokenValid = !!(doc.accessToken && doc.accessToken.trim());
        let secretValid = true;

        if (NEEDS_SECRET.includes(appName)) {
          secretValid = !!(doc.appSecret && doc.appSecret.trim());
        }

        valid = tokenValid && secretValid;
        accessTime = doc.accessTime;
      }

      list.push({
        name: appName,
        status: valid ? 'ok' : 'expired',
        accessTime: accessTime
      });
    }

    res.json({ code: 0, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: 'status error' });
  }
});

// 更新接口
app.post('/update', async (req, res) => {
  const { appName, newCookie, newAppSecret } = req.body;
  
  if (!ALLOWED_APPS.includes(appName)) {
    return res.send(`
      <body style="font-family:sans-serif; padding:50px; text-align:center; background:#f4f6f9;">
        <h2 style="color:red;">无法更新：该应用未添加至白名单！</h2>
        <div style="margin-top:30px;">
          <a href="/" style="display:inline-block; padding:10px 24px; background-color:#007bff; color:white; text-decoration:none; border-radius:5px; font-size:16px;">⬅ 返回继续更新</a>
        </div>
      </body>
    `)
  }

  if (!appName || (!newCookie && !newAppSecret)) {
    return res.send(`
      <body style="font-family:sans-serif; padding:50px; text-align:center; background:#f4f6f9;">
        <h2 style="color:red;">至少需填写一项要更新的内容！</h2>
        <div style="margin-top:30px;">
          <a href="/" style="display:inline-block; padding:10px 24px; background-color:#007bff; color:white; text-decoration:none; border-radius:5px; font-size:16px;">⬅ 返回继续更新</a>
        </div>
      </body>
    `);
  }

  try {
    // 动态构建要更新的字段
    const updateFields = {
      accessTime: new Date() // 记录操作时间
    };
    
    if (newCookie && newCookie.trim()) {
      updateFields.accessToken = newCookie.trim();
    }
    if (newAppSecret && newAppSecret.trim()) {
      updateFields.appSecret = newAppSecret.trim();
    }

    // 执行更新
    const result = await YourCollection.updateOne(
      { name: appName },
      { $set: updateFields }
    );

    let statusHtml = '';
    if (result.modifiedCount > 0) {
      statusHtml = `<h2 style="color:green;text-align:center;">✅ 更新成功！已更新【${appName}】的数据。</h2>`;
    } else if (result.matchedCount > 0) {
      statusHtml = `<h2 style="color:orange;text-align:center;">⚠️ 匹配到了数据，但内容和原来一样，未发生修改。</h2>`;
    } else {
      statusHtml = `<h2 style="color:red;text-align:center;">❌ 失败！未找到名称为【${appName}】的数据。</h2>`;
    }

    // 查询最新状态并展示
    const doc = await YourCollection.findOne({ name: appName }, 'name accessToken appSecret accessTime');
    const tokenPreview = doc && doc.accessToken ? doc.accessToken.substring(0, 30) + '...' : '无';
    const secretPreview = doc && doc.appSecret ? doc.appSecret.substring(0, 15) + '...' : '无';

    res.send(`
      <body style="font-family:sans-serif; padding:50px; text-align:center; background:#f4f6f9;">
          ${statusHtml}
          <div style="background:#fff; padding:20px; border-radius:8px; text-align:left; display:inline-block; box-shadow:0 2px 5px rgba(0,0,0,0.1); max-width:600px; width:100%;">
              <b>更新时间：</b> ${doc ? doc.accessTime : '无'}<br><br>
              <b>accessToken 前30位：</b><br>
              <code style="word-break:break-all; background:#eee; padding:5px; display:block; margin-top:5px;">${tokenPreview}</code>
              <b style="display:block; margin-top:15px;">appSecret 前15位：</b><br>
              <code style="word-break:break-all; background:#eee; padding:5px; display:block; margin-top:5px;">${secretPreview}</code>
          </div>
          <br><br>
          <div style="text-align:center; margin-top:30px;">
              <a href="/" style="display:inline-block; padding:10px 24px; background-color:#007bff; color:white; text-decoration:none; border-radius:5px; font-size:16px;">⬅ 返回继续更新</a>
          </div>
      </body>
    `);

  } catch (error) {
    console.error(error);
    res.status(500).send('<h2 style="color:red;text-align:center;">服务器内部错误，请查看后台终端日志。</h2><br><a href="/">返回</a>');
  }
});

// 启动!!!
app.listen(PORT, () => {
  console.log(`✅工具已启动，浏览器访问链接: http://localhost:${PORT}`);
});
# 第三方平台凭证手动更新工具 (TokenUpdater)

一个基于 **Node.js + Express + Mongoose** 的极简 Web 工具，用于安全、便捷地手动更新 MongoDB 中的第三方平台 `accessToken` 和 `appSecret`。

## 背景

在一些系统管理后台中，后台程序需要每天调用第三方平台（如小红书、腾讯广告）的 API 来拉取数据。为了保证数据安全，第三方平台下发的 `accessToken`（或抓包得到的 Cookie）都有严格的有效期，有的1天，有的7到30天左右。

**如果不及时更新这些凭证，会发生什么故障？**
1. **接口报错**：后台系统调用第三方 API 时被拒；
2. **数据断流**：数据无法拉取，数据看板出现空窗；
3. **业务受损**：比如广告费用在消耗，但线索进不到系统，销售无法跟进，直接白白烧钱；
4. **自动化失效**：依赖数据驱动的自动脚本全部瘫痪等故障。

由于安全规定或第三方 API 限制，很多时候无法实现全自动刷新 Token。因此，需要一个工具来**手动、安全地更新数据库中的凭证字段，维持数据链路的畅通。**

## 核心功能

- **极简 Web 界面**：无需 Postman 或直接操作数据库，浏览器打开即可操作。
- **白名单安全校验**：只允许更新指定的几个应用，防止恶意请求或误操作篡改其他业务数据。
- **按需更新**：`accessToken` 和 `appSecret` 两个输入框均为选填，留空则不修改原值。
- **即时验证反馈**：提交更新后，页面立刻从数据库查出最新数据的前 30 位展示，确认是否更新成功。
- **支持 MongoDB 副本集**：内置了连接阿里云 MongoDB 集群（带 `replicaSet` 参数）的写法示例。

## 技术栈

- Node.js
- Express
- Mongoose (MongoDB ODM)

## 一些必要操作步骤

### 克隆项目并安装依赖以及配置数据库连接和一些英文占位符
```bash
git clone https://github.com/你的用户名/你的仓库名.git
cd 你的仓库名
npm install express mongoose

打开 `UpdateDatabaseInfo.js`，找到 `MONGO_URI` 变量，将里面的英文占位符替换为你自己的 MongoDB 连接信息：
| 占位符 | 含义 | 举例 |
- USERNAME：数据库用户名|admin
- PASSWORD：数据库密码|abc123456
- YOUR_MONGODB_HOST：数据库地址|dds-xxxx.mongodb.rds.aliyuncs.com
- PORT：端口号|8080
- DATABASE_NAME：数据库名|my_database
- REPLICA_SET_NAME：副本集名称|mgset-xxxxx
- DataApp：需要更新的应用|tengxunyingxiao
- YourCollection：数据库表|Application

**示例（替换后）：**
```javascript
const MONGO_URI = 'mongodb://admin:abc123456@dds-xxxx.mongodb.rds.aliyuncs.com:3717/my_database?replicaSet=mgset-xxxxx';
# 移动端模拟器运行指南 (Windows)

本文档旨在帮助你快速在 Android 模拟器上运行本项目，并理解开发过程中的常用命令。

## 1. 准备工作

请确保你已经完成了以下基础配置：
*   **模拟器已就绪**: Android Studio 已安装，并且你已经创建并可以启动一个 Android 模拟器 (AVD)。
*   **环境已配置**: Node.js, Git, Java JDK 17 已安装。

## 2. 只有两步：如何启动项目

每次开发前，请遵循以下步骤。注意：你需要打开**两个**终端窗口。

### 第一步：启动后端服务 (Backend)

App 需要连接后台才能正常工作 (登录、获取数据等)。

1.  打开一个新的终端窗口。
2.  进入 `backend` 目录并在那里启动服务：

```powershell
cd backend
npm start
```

**保持这个终端窗口打开，不要关闭它。**

### 第二步：启动模拟器
打开 Android Studio -> Virtual Device Manager -> 点击播放按钮启动你的模拟器。
**必须确保模拟器已经完全启动并显示桌面，再进行下一步。**

### 第三步：启动 App

回到 VS Code 的终端 (或者再开一个新终端)，确保目录在 `mobile` 下。

这里有两种情况：

**情况 A: 第一次运行 或 安装了新插件 (Native Code Changed)**
如果你是第一次跑，或者刚装了带有原生代码的库（如 camera, map 等），运行：
```powershell
npm run android
```
*这会编译整个 App 并安装到模拟器上，比较慢。*

**情况 B: 日常开发 (Daily Development)**
如果模拟器上已经有了 "AI记账本" App，你不需要每次都重新编译。直接运行：
```powershell
npx expo start --dev-client
```
*这会启动开发服务器。然后在模拟器上点击打开 "AI记账本" App，它会自动连接。速度极快。*

---

## 3. 核心概念辨析：常用命令的区别

因为本项目使用了原生权限 (如截屏检测)，它不再是一个纯粹的 Expo Go 项目，而是一个 **Development Build (开发版)**。

### `npm run android`
*   **含义**: 编译原生代码 + 安装 App + 启动服务。
*   **什么时候用**:
    *   第一次运行项目时。
    *   `package.json` 里的依赖变了，特别是原生依赖。
    *   App 彻底崩溃打不开了，需要重装。
*   **缺点**: 慢，电脑风扇会转。

### `npx expo start --dev-client` (推荐日常使用)
*   **含义**: 仅启动 Metro 打包服务，处于等待连接状态。
*   **什么时候用**:
    *   App 已经在模拟器里装好了。
    *   你只是改改 JS/TS 代码，写写页面。
    *   你想快速重启服务。
*   **优点**: 快，秒开。

### `npx expo start` (不推荐)
*   **含义**: 默认尝试启动 Expo Go。
*   **为什么报错**: 因为你的 App 需要原生代码支持，Expo Go 的标准壳子不支持这些自定义原生代码，所以会报错或崩溃。**请使用 `--dev-client` 参数。**

---

## 4. 开发工作流：代码更新了怎么办？

**场景 A：我修改了代码 (比如改了页面文字、颜色)**
*   **不需要** 重启任何命令。
*   **只需要**: 按 `Ctrl + S` 保存文件。
*   **效果**: 模拟器会触发 **Fast Refresh (快速刷新)**，你会瞬间看到修改生效。

**场景 B：我安装了纯 JS 插件 (`npm install lodash`)**
*   **需要**: 重启开发服务器。
*   **操作**: 
    1. `Ctrl + C` 停止 `npx expo start ...`。
    2. 重新运行 `npx expo start --dev-client`。

**场景 C：我安装了原生插件 (`npm install expo-camera`)**
*   **需要**: 重新编译。
*   **操作**: 运行 `npm run android`。

**场景 D：App 卡死或报错红屏**
*   **尝试 1**: 摇晃模拟器 (或按 `Ctrl + M` / `Cmd + M`) 调出菜单，点击 "Reload"。
*   **尝试 2**: 在终端按 `r` 键。
*   **尝试 3**: 关掉终端，运行 `npx expo start --dev-client`，然后手动在模拟器上重新点开 App。

## 总结
*   **首次运行/修好了原生Bug**: `npm run android`
*   **日常开发**: `npx expo start --dev-client`
*   **改代码**: 保存即生效。

#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
一键启动「学习笔记」网站（前后端分离）

用法：
    python start.py                # 安装依赖(如需) + 启动前后端 + 自动打开浏览器
    python start.py --no-browser   # 不自动打开浏览器
    python start.py --no-install   # 跳过依赖安装检查

说明：


    - 端口被占用时会直接结束占用进程，无需确认
    - 后端 backend：Node/Express API，端口 3000
    - 前端 frontend：Vite 开发服务器，端口 5173
    - 按 Ctrl+C 可同时关闭前后端
"""
import os
import sys
import time
import socket
import shutil
import signal
import threading
import subprocess
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(ROOT, "backend")
FRONTEND_DIR = os.path.join(ROOT, "frontend")

BACKEND_PORT = 3000
FRONTEND_PORT = 5173
FRONTEND_URL = "http://localhost:{}".format(FRONTEND_PORT)

IS_WINDOWS = os.name == "nt"
processes = []


def log(tag, message):
    print("[{}] {}".format(tag, message), flush=True)


def find_npm():
    """定位 npm 可执行文件"""
    for name in ("npm.cmd", "npm"):
        path = shutil.which(name)
        if path:
            return path
    return None


def check_node():
    if not shutil.which("node"):
        log("error", "未检测到 Node.js，请先安装：https://nodejs.org/")
        sys.exit(1)
    npm = find_npm()
    if not npm:
        log("error", "未检测到 npm，请确认 Node.js 已正确安装并加入 PATH。")
        sys.exit(1)
    return npm


def _listening_pids(port):
    """返回监听指定端口的 PID 列表（同时覆盖 IPv4 与 IPv6）"""
    pids = []
    try:
        if IS_WINDOWS:
            out = subprocess.run(
                ["netstat", "-ano"],
                capture_output=True, text=True, errors="replace"
            ).stdout
            for line in out.splitlines():
                parts = line.split()
                if len(parts) >= 5 and parts[0].upper() == "TCP" and parts[3].upper() == "LISTENING":
                    if parts[1].rstrip().endswith(":{}".format(port)):
                        try:
                            pids.append(int(parts[4]))
                        except ValueError:
                            pass
        else:
            out = subprocess.run(
                ["lsof", "-ti", "tcp:{}".format(port)],
                capture_output=True, text=True, errors="replace"
            ).stdout
            pids = [int(x) for x in out.strip().splitlines() if x.strip().isdigit()]
    except Exception:
        pass
    return pids


def port_in_use(port):
    """检测端口是否已被占用（IPv4 / IPv6 双栈）"""
    if _listening_pids(port):
        return True
    # 兜底：尝试实际连接
    for family, host in ((socket.AF_INET, "127.0.0.1"), (socket.AF_INET6, "::1")):
        try:
            with socket.socket(family, socket.SOCK_STREAM) as s:
                s.settimeout(0.3)
                if s.connect_ex((host, port)) == 0:
                    return True
        except Exception:
            pass
    return False


def get_port_pid(port):
    """获取占用指定端口的进程 PID（取不到则返回 None）"""
    pids = _listening_pids(port)
    return pids[0] if pids else None


def kill_pid(pid):
    """结束指定进程（含子进程树）"""
    try:
        if IS_WINDOWS:
            subprocess.run(
                ["taskkill", "/F", "/T", "/PID", str(pid)],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
            )
        else:
            os.kill(pid, signal.SIGTERM)
    except Exception:
        pass


def free_port(name, port):
    """端口被占用时直接结束占用进程；返回 True 表示端口可用"""
    if not port_in_use(port):
        return True

    pid = get_port_pid(port)
    log("warn", "{} 端口 {} 已被占用（PID: {}），正在结束…".format(name, port, pid if pid else "未知"))

    if pid:
        kill_pid(pid)
        time.sleep(1.0)
        if not port_in_use(port):
            log("ok", "端口 {} 已释放".format(port))
            return True

    log("error", "无法自动释放端口 {}，请手动关闭占用进程后重试。".format(port))
    return False


def ensure_deps(npm, if_install=True):
    """缺少 node_modules 时自动安装依赖"""
    targets = [("后端", BACKEND_DIR), ("前端", FRONTEND_DIR)]
    for name, path in targets:
        if not os.path.isdir(os.path.join(path, "node_modules")):
            if not if_install:
                log("warn", "{} 依赖缺失，请先运行 npm install".format(name))
                continue
            log("setup", "正在为{}安装依赖（首次较慢，请稍候）…".format(name))
            subprocess.run([npm, "install"], cwd=path, check=True)


def stream_output(proc, tag):
    """实时转发子进程输出"""
    try:
        for line in iter(proc.stdout.readline, ""):
            if not line:
                break
            sys.stdout.write("[{}] {}".format(tag, line.rstrip()) + "\n")
            sys.stdout.flush()
    except Exception:
        pass


def start_service(tag, cwd, npm):
    """启动一个服务（npm run dev）"""
    cmd = '"{}" run dev'.format(npm)
    proc = subprocess.Popen(
        cmd,
        cwd=cwd,
        shell=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        universal_newlines=True,
        bufsize=1,
    )
    processes.append(proc)
    threading.Thread(target=stream_output, args=(proc, tag), daemon=True).start()
    return proc


def wait_for_port(port, timeout=30):
    """等待端口就绪"""
    start = time.time()
    while time.time() - start < timeout:
        if port_in_use(port):
            return True
        time.sleep(0.4)
    return False


def stop_all():
    """停止所有子进程（含其子进程树）"""
    print()
    log("stop", "正在关闭服务…")
    for proc in processes:
        if proc.poll() is not None:
            continue
        try:
            if IS_WINDOWS:
                subprocess.run(
                    ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            else:
                proc.terminate()
        except Exception:
            pass
    log("stop", "已关闭。")


def main():
    args = sys.argv[1:]
    open_browser = "--no-browser" not in args
    do_install = "--no-install" not in args

    # 让中文输出在 Windows 控制台也尽量正常
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    print("=" * 52)
    print("  学习笔记 · 一键启动（前后端分离）")
    print("=" * 52)

    npm = check_node()

    # 端口占用检查（占用时直接结束占用进程）
    for name, port in (("后端", BACKEND_PORT), ("前端", FRONTEND_PORT)):
        if not free_port(name, port):
            log("error", "端口 {} 未释放，启动中止。".format(port))
            sys.exit(1)

    ensure_deps(npm, do_install)

    log("start", "启动后端 (Express, http://localhost:{}) …".format(BACKEND_PORT))
    start_service("backend", BACKEND_DIR, npm)

    log("start", "启动前端 (Vite, {}) …".format(FRONTEND_URL))
    start_service("frontend", FRONTEND_DIR, npm)

    if wait_for_port(BACKEND_PORT, 30):
        log("ok", "后端已就绪")
    else:
        log("warn", "后端启动较慢或失败，请查看上方日志")

    if wait_for_port(FRONTEND_PORT, 40):
        log("ok", "前端已就绪")
        print()
        log("done", "网站已启动 → {}".format(FRONTEND_URL))
        if open_browser:
            try:
                webbrowser.open(FRONTEND_URL)
            except Exception:
                pass
    else:
        log("warn", "前端启动较慢或失败，请查看上方日志")

    print()
    print("-" * 52)
    print("按 Ctrl+C 停止全部服务")
    print("-" * 52)

    # 任一进程退出则整体结束
    try:
        while True:
            if all(p.poll() is not None for p in processes):
                log("warn", "所有服务已退出")
                break
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        stop_all()


if __name__ == "__main__":
    # 兼容 Ctrl+C 时也能触发清理
    signal.signal(signal.SIGINT, lambda *_: sys.exit(0))
    try:
        main()
    except SystemExit:
        raise
    except Exception as exc:
        log("error", str(exc))
        sys.exit(1)
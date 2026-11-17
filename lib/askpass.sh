#!/bin/sh
# git 通过 GIT_ASKPASS 调用本脚本取用户名/密码。
# 只从环境变量读，令牌不会出现在命令行参数里（argv 对其他进程可见）。
case "$1" in
  *[Uu]sername*) printf '%s\n' "${DSH_KB_GIT_USER:-x-access-token}" ;;
  *) printf '%s\n' "${DSH_KB_GIT_TOKEN:-}" ;;
esac

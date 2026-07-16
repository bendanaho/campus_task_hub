@echo off
chcp 65001 >nul
cd /d "%~dp0Keshe_backend"
title Campus Task Hub Backend
echo ========================================
echo   Campus Task Hub 后端启动
echo   Profile: prod
echo   数据库: MySQL campus_task_hub
echo ========================================
echo.
echo  服务地址: http://localhost:8080
echo  演示账号: xiaoming xiaohong xiaowang admin
echo  密码: 123456
echo.
echo  停止服务: 关闭窗口或按 Ctrl+C
echo ========================================
echo.
call "%~dp0Keshe_backend\mvnw.cmd" spring-boot:run -Dspring-boot.run.profiles=prod
echo.
echo 服务已停止。
pause

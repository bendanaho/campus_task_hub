@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 重置数据库 + 导入演示数据
echo ========================================
echo   重置 campus_task_hub 数据库
echo ========================================
echo.
echo  MySQL 账号: root
echo.

set /p MYSQL_PWD="请输入 MySQL root 密码: "
if "%MYSQL_PWD%"=="" (
    echo 密码不能为空,已取消.
    pause
    exit /b 1
)

echo.
echo [1/3] 删除旧数据库 ...
mysql -uroot -p%MYSQL_PWD% --default-character-set=utf8mb4 -e "DROP DATABASE IF EXISTS campus_task_hub;" 2>nul

echo [2/3] 重建表结构 ...
mysql -uroot -p%MYSQL_PWD% --default-character-set=utf8mb4 < db\schema.sql 2>nul
if errorlevel 1 (
    echo [错误] 表结构重建失败,请检查密码或 MySQL 是否运行.
    pause
    exit /b 1
)

echo [3/3] 导入演示数据 ...
mysql -uroot -p%MYSQL_PWD% --default-character-set=utf8mb4 campus_task_hub < db\test-data.sql 2>nul
if errorlevel 1 (
    echo [错误] 演示数据导入失败.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   完成! 各表数据量:
echo ========================================
mysql -uroot -p%MYSQL_PWD% --default-character-set=utf8mb4 campus_task_hub -e "SELECT 'users' t, COUNT(*) c FROM users UNION ALL SELECT 'tasks', COUNT(*) FROM tasks UNION ALL SELECT 'orders', COUNT(*) FROM orders UNION ALL SELECT 'reviews', COUNT(*) FROM reviews UNION ALL SELECT 'conversations', COUNT(*) FROM conversations UNION ALL SELECT 'chat_messages', COUNT(*) FROM chat_messages UNION ALL SELECT 'transactions', COUNT(*) FROM transactions UNION ALL SELECT 'reports', COUNT(*) FROM reports;" 2>nul

echo.
pause

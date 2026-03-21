@echo off
cd /d "C:\Vibe Apps\Agentic RAG"

:WAIT_DOCKER
docker info >nul 2>&1
if errorlevel 1 (
    timeout /t 5 >nul
    goto WAIT_DOCKER
)

supabase start
exit

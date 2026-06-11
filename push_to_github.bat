@echo off
echo ==============================================
echo   Subiendo TriajeTEA a GitHub y GitHub Pages
echo ==============================================
echo.

:: Verificar si git está instalado
git --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git no esta en la ruta del sistema ^(PATH^).
    echo Por favor, instale Git o agreguelo al PATH e intentelo de nuevo.
    echo Mas informacion en: https://git-scm.com/
    echo.
    pause
    exit /b
)

:: Inicializar git si no existe
if not exist .git (
    echo Inicializando repositorio Git local...
    git init
    git branch -M main
)

:: Configurar el repositorio remoto
echo Configurando remoto de GitHub...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/drsamuelsilva/TriajeTEA.git

:: Agregar archivos e indexar
echo Preparando archivos...
git add .

:: Confirmar cambios
echo Confirmando cambios...
git commit -m "feat: implementar vistas duales, fallback API Gemini y despliegue a GitHub Pages"

:: Subir a la rama main
echo.
echo Subiendo los cambios a GitHub ^(rama main^)...
echo.
git push -u origin5 main >nul 2>&1 || git push -u origin main

echo.
echo ==============================================
echo ¡Listo! Los archivos se han subido a GitHub.
echo.
echo Visite: https://github.com/drsamuelsilva/TriajeTEA/settings/pages
echo para asegurarse de que la fuente de GitHub Pages este establecida
echo en "GitHub Actions" ^(ya que configuramos el workflow automatico^).
echo ==============================================
echo.
pause

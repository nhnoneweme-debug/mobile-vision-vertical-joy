<#
  deploy-lovable.ps1 — sobe o app para o Lovable (via GitHub) a partir do PowerShell.
  Fluxo: commit na develop -> (tsc --noEmit) -> push develop -> merge na main -> push main.
  O Lovable sincroniza a partir da main e faz o build/deploy (Linux) sozinho.

  Uso (no PowerShell, dentro da pasta do projeto):
    .\deploy-lovable.ps1 "mensagem do commit"
    .\deploy-lovable.ps1 "mensagem" -SkipBuild        # pula a checagem de tipos

  Se o PowerShell bloquear por politica de execucao, rode:
    powershell -ExecutionPolicy Bypass -File .\deploy-lovable.ps1 "mensagem"
#>
param(
  [string]$Message = "",
  [switch]$SkipBuild
)

Set-Location -Path $PSScriptRoot

$SourceBranch = if ($env:SOURCE_BRANCH) { $env:SOURCE_BRANCH } else { "develop" }
$TargetBranch = if ($env:TARGET_BRANCH) { $env:TARGET_BRANCH } else { "main" }
if ([string]::IsNullOrWhiteSpace($Message)) {
  $Message = "Deploy " + (Get-Date -Format "yyyy-MM-dd HH:mm")
}

function Die($msg) { Write-Host "X  $msg" -ForegroundColor Red; exit 1 }

# --- Sanidade ---
git rev-parse --is-inside-work-tree 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Die "Isto nao e um repositorio git. Rode dentro da pasta do projeto." }

Write-Host ">> Origem: $SourceBranch  ->  destino: $TargetBranch"
Write-Host ">> Mensagem de commit: $Message"

git checkout $SourceBranch
if ($LASTEXITCODE -ne 0) { Die "checkout $SourceBranch falhou" }

# --- Stage ---
git add -A

# --- Guarda de segredos: nenhum .env (exceto .env.example) pode subir ---
$staged = git diff --cached --name-only
$leak = $staged | Where-Object { $_ -match '(^|/)\.env' -and $_ -notmatch '\.env\.example$' }
if ($leak) {
  Write-Host "X  ABORTADO: arquivos de env prestes a ser commitados (risco de vazar segredo):" -ForegroundColor Red
  $leak | ForEach-Object { Write-Host "     $_" }
  git reset -- $leak | Out-Null
  Die "Removi do stage. Confira seu .gitignore antes de continuar."
}

# --- Commit (so se houver mudanca) ---
git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  git commit -m $Message
  if ($LASTEXITCODE -ne 0) { Die "commit falhou" }
  Write-Host "OK  commit criado em $SourceBranch."
} else {
  Write-Host "--  Nada novo para commitar em $SourceBranch."
}

# --- Checagem de tipos (Windows-safe; o build de producao roda no Lovable/Linux) ---
if (-not $SkipBuild) {
  Write-Host ">> Checagem de tipos (npx tsc --noEmit)... use -SkipBuild para pular."
  npx tsc --noEmit
  if ($LASTEXITCODE -ne 0) { Die "Erros de TypeScript. NADA foi enviado. Corrija e rode de novo (ou -SkipBuild)." }
  Write-Host "OK  tipos."
}

# --- Push da develop ---
git push origin $SourceBranch
if ($LASTEXITCODE -ne 0) { Die "push $SourceBranch falhou" }
Write-Host "OK  $SourceBranch enviada."

# --- Merge na main + push ---
git checkout $TargetBranch
if ($LASTEXITCODE -ne 0) { Die "checkout $TargetBranch falhou" }
git pull origin $TargetBranch --no-edit
git merge $SourceBranch --no-edit
if ($LASTEXITCODE -ne 0) {
  Write-Host "X  Conflito ao mesclar em $TargetBranch. Resolva manualmente:" -ForegroundColor Red
  Write-Host "     1) git status  -> edite os arquivos em conflito"
  Write-Host "     2) git add -A ; git commit ; git push origin $TargetBranch"
  Write-Host "     (para desistir: git merge --abort ; git checkout $SourceBranch)"
  exit 1
}
git push origin $TargetBranch
if ($LASTEXITCODE -ne 0) { Die "push $TargetBranch falhou" }
Write-Host "OK  $TargetBranch atualizada e enviada."

# --- Volta pra develop ---
git checkout $SourceBranch | Out-Null

Write-Host ""
Write-Host "PRONTO! O Lovable vai sincronizar a $TargetBranch e fazer o build/deploy." -ForegroundColor Green
Write-Host "Se o build falhar la, o site continua na versao anterior."
Write-Host ""
Write-Host "Proximos passos:"
Write-Host "  1) No Lovable, adicione o secret OPENAI_API_KEY (e opcional AI_CHAT_MODEL)."
Write-Host "  2) Me diga 'subiu' que eu disparo a validacao dos fluxos pelo agente do Lovable."

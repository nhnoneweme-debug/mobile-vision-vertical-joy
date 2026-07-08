#!/usr/bin/env bash
#
# deploy-lovable.sh — sobe o app para o Lovable (via GitHub) com checagens.
# Fluxo: commit na develop -> (build) -> push develop -> merge na main -> push main.
# O Lovable sincroniza a partir da main e faz o deploy sozinho.
#
# Uso (no Git Bash, dentro da pasta do projeto):
#   bash deploy-lovable.sh "mensagem do commit"      # com build (recomendado)
#   bash deploy-lovable.sh --skip-build "mensagem"   # pula o build
#
# Variáveis opcionais:
#   SOURCE_BRANCH (default: develop)   TARGET_BRANCH (default: main)

set -euo pipefail

# Vai para a pasta do script (raiz do projeto), independente de onde foi chamado.
cd "$(dirname "$0")"

SOURCE_BRANCH="${SOURCE_BRANCH:-develop}"
TARGET_BRANCH="${TARGET_BRANCH:-main}"
DO_BUILD=1
MSG=""

for arg in "$@"; do
  case "$arg" in
    --skip-build) DO_BUILD=0 ;;
    *) MSG="$arg" ;;
  esac
done
[ -z "$MSG" ] && MSG="Deploy $(date '+%Y-%m-%d %H:%M')"

# --- Sanidade -------------------------------------------------------------
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "❌ Isto não é um repositório git. Rode dentro da pasta do projeto."; exit 1;
}

echo "▶ Origem: $SOURCE_BRANCH  →  destino: $TARGET_BRANCH"
echo "▶ Mensagem de commit: \"$MSG\""

git checkout "$SOURCE_BRANCH"

# --- Stage ----------------------------------------------------------------
git add -A

# --- GUARDA DE SEGREDOS: nenhum .env (exceto .env.example) pode ir ao commit
LEAK="$(git diff --cached --name-only | grep -E '(^|/)\.env' | grep -v '\.env\.example$' || true)"
if [ -n "$LEAK" ]; then
  echo "❌ ABORTADO: arquivos de env prestes a ser commitados (risco de vazar segredo):"
  echo "$LEAK"
  echo "Tirei do stage. Confira seu .gitignore antes de continuar."
  # shellcheck disable=SC2086
  git reset -- $LEAK >/dev/null 2>&1 || true
  exit 1
fi

# --- Commit (só se houver mudança) ---------------------------------------
if git diff --cached --quiet; then
  echo "ℹ Nada novo para commitar em $SOURCE_BRANCH."
else
  git commit -m "$MSG"
  echo "✔ Commit criado em $SOURCE_BRANCH."
fi

# --- Checagem de tipos (Windows-safe; não sobe nada se falhar) ------------
# No Windows o `vite build` esbarra no plugin do Lovable (bug de caminho). O
# build de produção real roda no Lovable/Linux; aqui validamos os TIPOS com tsc,
# que pega erros de código de verdade sem depender do Vite.
if [ "$DO_BUILD" = "1" ]; then
  echo "▶ Checagem de tipos (npx tsc --noEmit)… use --skip-build para pular."
  if ! npx tsc --noEmit; then
    echo "❌ Erros de TypeScript. NADA foi enviado. Corrija e rode de novo (ou --skip-build)."
    exit 1
  fi
  echo "✔ Tipos OK."
fi

# --- Push da develop ------------------------------------------------------
git push origin "$SOURCE_BRANCH"
echo "✔ $SOURCE_BRANCH enviada."

# --- Merge na main + push -------------------------------------------------
git checkout "$TARGET_BRANCH"
git pull origin "$TARGET_BRANCH" --no-edit || true
if ! git merge "$SOURCE_BRANCH" --no-edit; then
  echo "❌ Conflito ao mesclar em $TARGET_BRANCH. Resolva manualmente:"
  echo "   1) git status  → edite os arquivos em conflito"
  echo "   2) git add -A && git commit && git push origin $TARGET_BRANCH"
  echo "   (para desistir: git merge --abort && git checkout $SOURCE_BRANCH)"
  exit 1
fi
git push origin "$TARGET_BRANCH"
echo "✔ $TARGET_BRANCH atualizada e enviada."

# --- Volta pra develop ----------------------------------------------------
git checkout "$SOURCE_BRANCH"

echo ""
echo "✅ Pronto! O Lovable vai sincronizar a $TARGET_BRANCH e fazer o build/deploy."
echo "   Se o build falhar lá, o site continua na versão anterior."
echo ""
echo "Próximos passos:"
echo "  1) No Lovable, adicione o secret OPENAI_API_KEY (e opcional AI_CHAT_MODEL)."
echo "  2) Me diga 'subiu' que eu disparo a validação dos fluxos pelo agente do Lovable."

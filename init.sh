#!/usr/bin/env bash

# This script renames the default project name, description and
# public key with the provided values. Simply update the values
# below, run "./init.sh" in your terminal and you're good to go!

NAME="mpl-project-name"
DESCRIPTION="My project description"
PUBLIC_KEY="MyProgram1111111111111111111111111111111111"

# ------------------------------------
# --- Do not edit below this line. ---
# ------------------------------------

# Initial variables
ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
OLD_NAME="mpl-project-name"
OLD_DESCRIPTION="My project description"
OLD_PUBLIC_KEY="MyProgram1111111111111111111111111111111111"

# snake_case
SNAKE_NAME=$(echo "$NAME" | perl -pe 's/-/_/g')
SNAKE_OLD_NAME=$(echo "$OLD_NAME" | perl -pe 's/-/_/g')

# CAPITALIZED_SNAKE_CASE
CAPITALIZED_SNAKE_NAME=$(echo "$SNAKE_NAME" | tr '[:lower:]' '[:upper:]')
CAPITALIZED_SNAKE_OLD_NAME=$(echo "$SNAKE_OLD_NAME" | tr '[:lower:]' '[:upper:]')

# camelCase
CAMEL_NAME=$(echo "$NAME" | perl -pe 's/-(\w)/\U$1/g')
CAMEL_OLD_NAME=$(echo "$OLD_NAME" | perl -pe 's/-(\w)/\U$1/g')

# PascalCase
PASCAL_NAME=$(echo "$NAME" | perl -pe 's/(^|-)(\w)/\U$2/g')
PASCAL_OLD_NAME=$(echo "$OLD_NAME" | perl -pe 's/(^|-)(\w)/\U$2/g')

# Title Case
TITLE_NAME=$(echo "$PASCAL_NAME" | perl -pe 's/(\B[A-Z])/ $1/g')
TITLE_OLD_NAME=$(echo "$PASCAL_OLD_NAME" | perl -pe 's/(\B[A-Z])/ $1/g')

# Find and replace
find $ROOT_DIR \
  \( -type d -name .git -prune \) -o \
  \( -type d -name node_modules -prune \) -o \
  \( -type d -name dist -prune \) -o \
  \( -type d -name .crates -prune \) -o \
  ! -name 'README.md' \
  ! -name '*.sh' \
  -type f -print0 |
  xargs -0 perl -pi -e "s/$OLD_NAME/$NAME/g; \
  s/$SNAKE_OLD_NAME/$SNAKE_NAME/g; \
  s/$CAPITALIZED_SNAKE_OLD_NAME/$CAPITALIZED_SNAKE_NAME/g; \
  s/$CAMEL_OLD_NAME/$CAMEL_NAME/g; \
  s/$PASCAL_OLD_NAME/$PASCAL_NAME/g; \
  s/$TITLE_OLD_NAME/$TITLE_NAME/g; \
  s/$OLD_DESCRIPTION/$DESCRIPTION/g; \
  s/$OLD_PUBLIC_KEY/$PUBLIC_KEY/g"

# Update folder and file names
mv "$ROOT_DIR/programs/$OLD_NAME" "$ROOT_DIR/programs/$NAME"
mv "$ROOT_DIR/idls/$SNAKE_OLD_NAME.json" "$ROOT_DIR/idls/$SNAKE_NAME.json"
mv "$ROOT_DIR/clients/js/src/generated/errors/$CAMEL_OLD_NAME.ts" "$ROOT_DIR/clients/js/src/generated/errors/$CAMEL_NAME.ts"
mv "$ROOT_DIR/clients/js/src/generated/programs/$CAMEL_OLD_NAME.ts" "$ROOT_DIR/clients/js/src/generated/programs/$CAMEL_NAME.ts"

# Update README
rm "$ROOT_DIR/README.md"
mv "$ROOT_DIR/PROJECT_README.md" "$ROOT_DIR/README.md"

echo "You're all set, build something cool! ✨"
echo "This script will now self-destruct."

# Self-destruct
rm "$ROOT_DIR/init.sh"

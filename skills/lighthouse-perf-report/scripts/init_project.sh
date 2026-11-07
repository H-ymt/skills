#!/usr/bin/env bash
set -euo pipefail

# Usage: init_project.sh <project-dir> <url1> [url2] [url3] ...
# Example: init_project.sh ./mysite-report https://example.com/ https://example.com/about/

if [ $# -lt 2 ]; then
  echo "Usage: $0 <project-dir> <url1> [url2] ..."
  exit 1
fi

PROJECT_DIR="$1"
shift
URLS=("$@")

mkdir -p "$PROJECT_DIR"/{docs,lhci/{before/{mobile,desktop},after/{mobile,desktop}}}

# Build JSON array of URLs
URL_JSON="["
for i in "${!URLS[@]}"; do
  [ "$i" -gt 0 ] && URL_JSON+=","
  URL_JSON+=$'\n'"        \"${URLS[$i]}\""
done
URL_JSON+=$'\n'"      ]"

# package.json
cat > "$PROJECT_DIR/package.json" <<PKGJSON
{
  "name": "$(basename "$PROJECT_DIR")",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "lhci:mobile": "lhci autorun --config=./lighthouserc.mobile.cjs",
    "lhci:desktop": "lhci autorun --config=./lighthouserc.desktop.cjs",
    "lhci:all": "npm run lhci:mobile && npm run lhci:desktop"
  },
  "devDependencies": {
    "@lhci/cli": "^0.15.0"
  }
}
PKGJSON

# lighthouserc.mobile.cjs
cat > "$PROJECT_DIR/lighthouserc.mobile.cjs" <<MOBILE
const phase = process.env.LHCI_PHASE || "after";
module.exports = {
  ci: {
    collect: {
      url: $URL_JSON,
      numberOfRuns: 3,
    },
    upload: {
      target: "filesystem",
      outputDir: \`./lhci/\${phase}/mobile\`,
    },
  },
};
MOBILE

# lighthouserc.desktop.cjs
cat > "$PROJECT_DIR/lighthouserc.desktop.cjs" <<DESKTOP
const phase = process.env.LHCI_PHASE || "after";
module.exports = {
  ci: {
    collect: {
      url: $URL_JSON,
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
      },
    },
    upload: {
      target: "filesystem",
      outputDir: \`./lhci/\${phase}/desktop\`,
    },
  },
};
DESKTOP

# .gitignore
cat > "$PROJECT_DIR/.gitignore" <<'GITIGNORE'
node_modules/
GITIGNORE

echo "Project initialized at $PROJECT_DIR"
echo "Next steps:"
echo "  cd $PROJECT_DIR && npm install"
echo "  LHCI_PHASE=before npm run lhci:all   # before measurement"
echo "  npm run lhci:all                      # after measurement (default)"

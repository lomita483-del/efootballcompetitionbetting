#!/usr/bin/env bash
set -euo pipefail
VERSION="$(grep -o "versionName '[^']*'" android-shell/app/build.gradle | head -1 | cut -d"'" -f2)"
PREV_TAG="$(git tag --list 'android-v*-build*' --sort=-version:refname | grep -v "^android-v\${VERSION}-" | head -1 || true)"
if [ -n "$PREV_TAG" ]; then CHANGED="$(git diff --name-only "$PREV_TAG"..HEAD)"; else CHANGED="$(git diff --name-only HEAD~1..HEAD 2>/dev/null || git diff --name-only HEAD)"; fi
notes=()
add_note(){ local n="$1"; for e in "\${notes[@]:-}"; do [ "$e" = "$n" ] && return; done; notes+=("$n"); }

if printf '%s\n' "$CHANGED" | grep -Eq 'android-shell/app/src/main/res/layout/dialog_update\.xml|android-shell/app/src/main/java/.*/UpdateChecker\.java'; then
  add_note "The Android update prompt was redesigned with a full-screen layout, larger text, and larger controls for easier reading."
fi
if printf '%s\n' "$CHANGED" | grep -Eq 'src/components/Layout\.tsx'; then
  add_note "The app footer now displays the current release version and reads the live release metadata so the version stays synchronized with the latest app release."
fi
if printf '%s\n' "$CHANGED" | grep -Eq 'android-shell/app/build\.gradle'; then
  add_note "The Android package version/build was incremented for this release."
fi
if printf '%s\n' "$CHANGED" | grep -Eq 'android-shell/app/src/main/java/.*/MainActivity\.java'; then
  add_note "Android now uses the website\u0027s normal responsive mobile viewport so the homepage fills the phone screen without being offset or cropped on the right."
fi
if printf '%s\n' "$CHANGED" | grep -Eq 'src/routes/__root\.tsx'; then
  add_note "The mobile website viewport now uses the real device width instead of forcing a wide desktop canvas inside the Android app."
fi
if printf '%s\n' "$CHANGED" | grep -Eq 'src/styles\.css'; then
  add_note "Global layout width constraints prevent pages and admin content from expanding past the phone screen and being pushed off to the right."
fi
if printf '%s\n' "$CHANGED" | grep -Eq 'src/components/HomeQuickMenu\.tsx'; then
  add_note "The homepage Menu control and drawer were upgraded with stronger contrast, cinematic glass surfaces, gold detailing, depth, glow, active states, and clearer icon treatment."
fi
if printf '%s\n' "$CHANGED" | grep -Eq 'src/routes/admin\.tsx'; then
  add_note "Admin App Updater now includes Refresh version, which reads the Android version, build number, and What's New directly from the release files and stages them without enabling the update."
fi
if printf '%s\n' "$CHANGED" | grep -Eq 'public/app-release\.json|android-shell/update-notes\.json'; then
  add_note "The release metadata and What's New list are synchronized to the staged Android release and include the complete user-facing changes in this version."
fi
if printf '%s\n' "$CHANGED" | grep -Eq 'android-shell/update-notes\.json|scripts/generate-release-notes\.sh|build-efootball-android-test\.yml'; then
  add_note "Release What's New is generated from the files changed since the previous Android release instead of copying unrelated older release notes."
fi
if [ "\${#notes[@]}" -eq 0 ]; then
  while IFS= read -r s; do [ -n "$s" ] && add_note "$s"; done < <(git log --format='%s' -n 10 --no-merges)
fi
if [ "\${#notes[@]}" -eq 0 ]; then add_note "Maintenance and improvements included in this release."; fi

python3 - "\${notes[@]}" <<'PY'
import json,sys
with open("android-shell/update-notes.json","w",encoding="utf-8") as f:
    json.dump({"whatsNew":sys.argv[1:]},f,indent=2,ensure_ascii=False)
    f.write("\n")
PY

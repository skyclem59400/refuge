# Skills projet (vendored)

Ces skills sont **versionnés dans le dépôt** afin d'être disponibles aussi bien
en session locale qu'en **session distante** (Claude Code on the web), où le
conteneur clone le repo à neuf et n'a pas accès au `~/.claude/skills` local.

## Provenance

Importés depuis le projet open-source **superpowers** de Jesse Vincent :

- Source : https://github.com/obra/superpowers (dossier `skills/`)
- Version : `5.1.0`
- Commit : `6fd4507659784c351abbd2bc264c7162cfd386dc` (2026-05-29)
- Licence : MIT (© 2025 Jesse Vincent)

## Mise à jour

```bash
git clone --depth 1 https://github.com/obra/superpowers.git /tmp/superpowers
rm -rf .claude/skills/*/        # garde ce README
cp -r /tmp/superpowers/skills/* .claude/skills/
```

Pense à mettre à jour la version/commit ci-dessus après import.

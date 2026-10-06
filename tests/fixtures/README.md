# Fixtures de teste

Dados de exemplo reutilizáveis entre testes.

- `opencode/`: agentes e skills de exemplo.
  - `agents/valid-primary.md`, `agents/valid-subagent.md`, `agents/unknown-fields.md`
  - `skills/git-release/SKILL.md` (+ asset preservado na remoção)
  - `invalid/`: YAML inválido, chaves duplicadas, `name` divergente, sem frontmatter, não fechado.

Os testes de filesystem criam sandboxes temporários próprios e **nunca** tocam a configuração real
do usuário.

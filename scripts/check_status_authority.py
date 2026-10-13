"""Check the sole portfolio status reference and preserve product ownership."""
from pathlib import Path
root = Path(__file__).resolve().parents[1]
status_url = 'https://github.com/AndrewLamSingapore/orqevia/blob/main/STATUS.md'
source_url = 'https://github.com/AndrewLamSingapore/orqevia/blob/main/governance/operational-manifest.json'
assert not (root / 'SSOT.json').exists(), 'retired pointer must stay removed'
assert not (root / 'SSOT.md').exists(), 'retired status file must stay removed'
for name in ('AGENTS.md', 'README.md'):
    text = (root / name).read_text(encoding='utf-8')
    assert status_url in text, f'{name} must name STATUS.md as the portfolio status reference'
    assert source_url in text, f'{name} must name the component reference'
    assert 'Each product owns' in text, f'{name} must preserve product domain ownership'
for path in root.rglob('*.md'):
    if '.git' in path.parts or 'node_modules' in path.parts:
        continue
    text = path.read_text(encoding='utf-8')
    assert 'https://github.com/AndrewLamSingapore/prime/blob/main/STATUS.md' not in text, f'{path.relative_to(root)} links the retired status location'
    assert 'one current JARVIS SSOT' not in text, f'{path.relative_to(root)} reinstates a retired portfolio authority banner'
    assert 'single current status source of truth' not in text, f'{path.relative_to(root)} overstates STATUS.md authority'
print('Portfolio STATUS reference and product ownership: PASS; runtime freshness is independently assessed')

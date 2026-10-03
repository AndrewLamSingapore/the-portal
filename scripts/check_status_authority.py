"""Validate direct STATUS authority without a parallel status pointer."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
status_url='https://github.com/AndrewLamSingapore/prime/blob/main/STATUS.md'
source_url='https://github.com/AndrewLamSingapore/prime/blob/main/governance/operational-manifest.json'
assert not (root/'SSOT.json').exists(), 'retired pointer must stay removed'
assert not (root/'SSOT.md').exists(), 'retired status file must stay removed'
for name in ('AGENTS.md','README.md'):
    text=(root/name).read_text(encoding='utf-8')
    assert status_url in text, f'{name} must name STATUS.md as status authority'
    assert source_url in text, f'{name} must name the component reference'
print('STATUS authority: PASS; runtime freshness is independently assessed')

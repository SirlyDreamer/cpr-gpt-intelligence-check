"""Reject a plugin built for the wrong architecture or bundled Python runtime."""
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'scripts'))
from runtime_target import TARGETS, validate_elf


class NativeArtifact(unittest.TestCase):
    def test_architecture_checks(self):
        for target, spec in TARGETS.items():
            header=bytearray(20);header[:6]=b'\x7fELF\x02\x01';header[18:20]=spec['elf_machine'].to_bytes(2,'little')
            validate_elf(header,target)
            other=next(t for t in TARGETS if t != target)
            with self.assertRaisesRegex(ValueError,'architecture'):validate_elf(header,other)
        for header in (b'not ELF', b'\x7fELF\x01\x01'+bytes(14), b'\x7fELF\x02\x02'+bytes(14)):
            with self.assertRaisesRegex(ValueError,'64-bit little-endian'):validate_elf(header,target)

    def test_manifest_has_only_web_and_notices(self):
        resources=json.loads((ROOT/'plugin.json').read_text())['resources']
        self.assertEqual(set(resources),{'web/index.html','web/app.js','web/app.css','legal/NOTICE.md','legal/THIRD_PARTY.txt'})


if __name__=='__main__':unittest.main()

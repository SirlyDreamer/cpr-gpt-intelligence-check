"""Supported native plugin targets and ELF architecture validation."""
TARGETS = {
    'x86_64-unknown-linux-gnu': {'elf_machine':62},
    'aarch64-unknown-linux-gnu': {'elf_machine':183},
}


def validate_elf(header, target):
    if len(header) < 20 or header[:6] != b'\x7fELF\x02\x01':
        raise ValueError('Expected a 64-bit little-endian ELF file')
    if int.from_bytes(header[18:20], 'little') != TARGETS[target]['elf_machine']:
        raise ValueError(f'ELF architecture does not match {target}')

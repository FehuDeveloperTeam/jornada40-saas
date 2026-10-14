#!/usr/bin/env python3
"""Genera los borradores legales en Word, con el estilo del documento técnico.

Uso (desde la raíz del repositorio):
    python3 docs/legal/construir.py

Escribe un .docx por documento (01-…md a 07-…md) en docs/legal/salida/, que no se versiona.
Necesita pandoc 3.
"""
import datetime
import re
import subprocess
import sys
import tempfile
from pathlib import Path

LEGAL = Path(__file__).resolve().parent
HERRAMIENTAS = LEGAL.parent / 'tecnico' / 'herramientas'
sys.path.insert(0, str(HERRAMIENTAS))
import referencia  # noqa: E402


def main():
    salida = LEGAL / 'salida'
    salida.mkdir(exist_ok=True)
    fecha = datetime.date.today().strftime('%d-%m-%Y')
    for fuente in sorted(LEGAL.glob('0*.md')):
        titulo = re.match(r'#\s+(.+)', fuente.read_text(encoding='utf-8')).group(1).strip()
        destino = salida / f'{fuente.stem}.docx'
        with tempfile.TemporaryDirectory() as tmp:
            plantilla = Path(tmp) / 'referencia.docx'
            referencia.generar(plantilla, titulo, 'borrador', fecha, 'Borrador para revisión legal')
            subprocess.run(['pandoc', str(fuente), '-o', str(destino), '--reference-doc', str(plantilla),
                            '--lua-filter', str(HERRAMIENTAS / 'documento.lua')], check=True, cwd=LEGAL)
        print(destino.relative_to(LEGAL.parent.parent))


if __name__ == '__main__':
    main()

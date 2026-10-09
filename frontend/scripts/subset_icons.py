"""Genera src/assets/fonts/material-symbols-subset.woff2 con solo los iconos de icons.txt."""
import sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

src, names_file, out = sys.argv[1:4]
names = [l.strip() for l in open(names_file) if l.strip()]
font = TTFont(src)


def ligature_targets(f, wanted):
    """Resuelve cada nombre de icono (ligadura) a su glifo; hay alias (location_on -> place)."""
    cmap = f.getBestCmap()

    def to_glyphs(name):
        return [cmap[ord(c)] for c in name]

    wanted_seq = {tuple(to_glyphs(n)): n for n in wanted}
    found = {}
    for lookup in f['GSUB'].table.LookupList.Lookup:
        for st in lookup.SubTable:
            st = getattr(st, 'ExtSubTable', st)
            for first, ligs in getattr(st, 'ligatures', {}).items():
                for lig in ligs:
                    name = wanted_seq.get(tuple([first] + list(lig.Component)))
                    if name:
                        found[name] = lig.LigGlyph
    return found

targets = ligature_targets(font, set(names))
missing = [n for n in names if n not in targets]
if missing:
    sys.exit(f'Iconos inexistentes en la fuente: {missing}')
glyphs = sorted(set(targets.values()))
opts = subset.Options()
opts.layout_features = ['liga', 'rlig', 'calt']
opts.layout_closure = False  # no arrastrar las ~3000 ligaduras restantes
opts.flavor = 'woff2'
opts.notdef_outline = True
sub = subset.Subsetter(opts)
letters = [ord(c) for c in 'abcdefghijklmnopqrstuvwxyz0123456789_']
sub.populate(unicodes=letters, glyphs=glyphs)
sub.subset(font)
# Fija GRAD/opsz/wght; conserva FILL (0 = contorno, 1 = relleno).
font = instancer.instantiateVariableFont(font, {'GRAD': 0, 'opsz': 24, 'wght': 400})
font.flavor = 'woff2'
font.save(out)
print(f'{out}: {len(names)} iconos')

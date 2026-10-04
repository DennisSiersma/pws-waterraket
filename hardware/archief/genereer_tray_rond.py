#!/usr/bin/env python3
"""
Compacte elektronicatray: bord, accu en sensor PLAT naast elkaar in een rond
bakje dat in de boring van de recovery-romp valt.

Vervangt de rechtopstaande houder. Die vroeg 92 mm hoogte in de romp; dit bakje
is 13 mm hoog. Het scherm kijkt omhoog: neus eraf en je ziet het.

Maten (mm):
  bord     41,13 x 33,13 x 6,6 (Waveshare, officiele maatschets)
  accu     21 x 26 x 10
  sensor   17 x 23 x 7,5 (ruim: past voor BMP390L en BME680)

Alle vakken liggen binnen straal 42, dus met ruim 2 mm wand tot de rand.
Het bakje ligt los op de vloer van de elektronicaruimte; het schotje erboven
houdt het op zijn plek. Onder in elk vak zit een vingergat om het eruit te
kunnen tillen.

Draaien:  ../../.venv/bin/python genereer_tray.py
Print plat, geen supports.
"""
import numpy as np
import trimesh

BORING_D = 89.5
SPEL     = 0.5
BASIS    = 2.0
HOOGTE   = 13.0
WAND     = 2.0
SEG      = 96

# vakken: (naam, breedte x, diepte y, hoogte, middelpunt x, middelpunt y)
VAKKEN = [
    ("bord",   41.13 + 0.6, 33.13 + 0.6,  7.5,   0.0,  14.5),
    ("accu",   26.0 + 1.2,  21.0 + 1.2,  10.5, -18.5, -15.0),
    ("sensor", 23.0 + 1.0,  17.0 + 1.0,   8.0,  17.5, -15.0),
]

def balk(sx, sy, sz, cx, cy, z0):
    m = trimesh.creation.box(extents=(sx, sy, sz))
    m.apply_translation((cx, cy, z0 + sz / 2))
    return m

r = BORING_D / 2 - SPEL / 2
tray = trimesh.creation.cylinder(radius=r, height=HOOGTE, sections=SEG)
tray.apply_translation((0, 0, HOOGTE / 2))

gaten = []
for naam, bx, by, bz, cx, cy in VAKKEN:
    gaten.append(balk(bx, by, bz + 1.0, cx, cy, HOOGTE - bz))          # het vak
    g = trimesh.creation.cylinder(radius=5.0, height=BASIS + 2, sections=32)
    g.apply_translation((cx, cy, BASIS / 2))                            # vingergat
    gaten.append(g)
    # controle: hoeken van het vak binnen de rand?
    hoek_r = max(np.hypot(cx + sx, cy + sy) for sx in (-bx/2, bx/2) for sy in (-by/2, by/2))
    print("%-7s vak %.1f x %.1f, hoek op straal %.1f (max %.1f): %s"
          % (naam, bx, by, hoek_r, r - WAND, "ok" if hoek_r <= r - WAND else "TE DICHT BIJ DE RAND"))

# kabelgoot van accu en sensor naar het bord
gaten.append(balk(6.0, 10.0, HOOGTE, -5.0, -1.5, HOOGTE - 6.0))
gaten.append(balk(6.0, 10.0, HOOGTE,  5.0, -1.5, HOOGTE - 6.0))

tray = trimesh.boolean.difference([tray] + gaten, engine='manifold')
tray.merge_vertices(); tray.update_faces(tray.nondegenerate_faces())
tray.update_faces(tray.unique_faces()); tray.remove_unreferenced_vertices()
trimesh.repair.fix_normals(tray)
tray.export('PWS_Waterraket_Tray.stl')
t = trimesh.load('PWS_Waterraket_Tray.stl')
e = t.bounding_box.extents
print("\ntray %.1f x %.1f x %.1f mm, %.1f cm3 (~%.0f g), waterdicht %s, delen %d"
      % (e[0], e[1], e[2], t.volume / 1000, t.volume / 1000 * 1.27 * 0.6, t.is_watertight, t.body_count))

#!/usr/bin/env python3
"""
Neuskegel met payloadruimte voor de waterraket-vluchtcomputer.

Twee delen:
  1. PWS_Waterraket_Neuskegel_Bay.stl  - romp die over de flesbodem schuift,
     met binnenrails voor de payloadhouder en statische poorten
  2. PWS_Waterraket_Neuskegel_Tip.stl  - ogief-punt, klikt in de bay

De fles staat neck-down, dus de kegel zit op de BODEM van de fles.
De payloadhouder staat RECHTOP in de romp (plat vlak evenwijdig aan de as),
zodat alleen de breedte van 71,4 mm in de doorsnede hoeft te passen.

Meet je fles en pas FLES_D aan. Draaien:
    ../../.venv/bin/python genereer_neuskegel.py
Print beide delen staand, zonder supports.
"""
import numpy as np, trimesh

# ---------------- maten in mm ----------------
FLES_D     = 88.5     # Fernandes Cherry Bouquet 1,5 L: omtrek 278 mm / pi, volledig cilindrisch
FLES_SPEL  = 1.0      # speling zodat de romp erover schuift
WAND       = 1.6      # wanddikte romp (dun = licht; 2 perimeters volstaat)
SKIRT_H    = 32.0     # hoe ver de romp over de fles valt
BAY_H      = 92.0     # vrije payloadruimte boven de flesbodem
TIP_H      = 105.0    # hoogte van de ogief-punt
SPIGOT_H   = 14.0     # insteekrand tussen punt en romp
SPIGOT_SPEL= 0.35     # passingsspeling van de insteekrand

HOUDER_B   = 71.4     # breedte payloadhouder
HOUDER_T   = 12.0     # dikte payloadhouder
RAIL_SPEL  = 0.8      # speling in de rails

POORT_D    = 3.0      # statische poort voor de barometer
POORT_N    = 4        # aantal poorten rondom
POORT_H    = 55.0     # hoogte van de poorten boven de flesbodem

KOORD_D    = 4.0      # gat voor schokkoord/parachutelijn
SEG        = 96

ID   = FLES_D + FLES_SPEL          # binnendiameter romp
OD   = ID + 2 * WAND               # buitendiameter romp
VLOER = 2.4                        # dikte tussenschot boven de fles


def cil(d, h, z0, sec=SEG):
    m = trimesh.creation.cylinder(radius=d / 2, height=h, sections=sec)
    m.apply_translation((0, 0, z0 + h / 2))
    return m

def balk(sx, sy, sz, x, y, z):
    m = trimesh.creation.box(extents=(sx, sy, sz))
    m.apply_translation((x + sx / 2, y + sy / 2, z + sz / 2))
    return m

def pijp(d_out, d_in, h, z0):
    return trimesh.boolean.difference(
        [cil(d_out, h, z0), cil(d_in, h + 2, z0 - 1)], engine='manifold')

# ============ DEEL 1: ROMP MET PAYLOADRUIMTE ============
delen, gaten = [], []

totale_h = SKIRT_H + VLOER + BAY_H
delen.append(pijp(OD, ID, totale_h, 0))                    # buitenwand
delen.append(cil(ID + 0.2, VLOER, SKIRT_H))                # tussenschot

# rails: korte ribben die de houder rechtop klemmen (licht, niet massief)
rail_b, rail_d, rail_h = 3.0, 9.0, BAY_H - 10
gleuf = HOUDER_T + RAIL_SPEL
for kant in (-1, 1):
    x = kant * (gleuf / 2 + rail_b / 2)
    for y in (-HOUDER_B * 0.42, HOUDER_B * 0.42 - rail_d):   # ribbenpaar per zijde
        delen.append(balk(rail_b, rail_d, rail_h,
                          x - rail_b / 2, y, SKIRT_H + VLOER))
# dwarssteun onderin zodat de houder niet kantelt
delen.append(balk(gleuf + 2 * rail_b, 3.0, 6.0,
                  -(gleuf + 2 * rail_b) / 2, -1.5, SKIRT_H + VLOER))

# insteekrand voor de punt
delen.append(pijp(ID - SPIGOT_SPEL, ID - SPIGOT_SPEL - 2 * WAND, SPIGOT_H, totale_h))

# statische poorten
for i in range(POORT_N):
    a = 2 * np.pi * i / POORT_N
    g = trimesh.creation.cylinder(radius=POORT_D / 2, height=OD + 4, sections=32)
    g.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [0, 1, 0]))
    g.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1]))
    g.apply_translation((0, 0, SKIRT_H + VLOER + POORT_H))
    gaten.append(g)

# koordgaten door het tussenschot
for kant in (-1, 1):
    g = cil(KOORD_D, VLOER + 4, SKIRT_H - 2, sec=24)
    g.apply_translation((kant * (ID / 2 - 8), 0, 0))
    gaten.append(g)

bay = trimesh.boolean.union(delen, engine='manifold')
bay = trimesh.boolean.difference([bay] + gaten, engine='manifold')
bay.export('PWS_Waterraket_Neuskegel_Bay.stl')

# ============ DEEL 2: OGIEF-PUNT ============
# Von Karman-achtig ogief: straal loopt vloeiend naar nul.
R = ID / 2
n = 60
zs = np.linspace(0, TIP_H, n)
prof = [max(R * np.sqrt(max(0.0, 1.0 - (z / TIP_H) ** 2)) ** 0.75, 0.8) for z in zs]

def omwenteling(radii, hoogtes):
    """Gesloten omwentelingslichaam: profiel begint en eindigt op de as."""
    pts = [[0.0, hoogtes[0]]]
    pts += [[r, z] for r, z in zip(radii, hoogtes)]
    pts += [[0.0, hoogtes[-1]]]
    return trimesh.creation.revolve(np.array(pts), sections=SEG)

punt = omwenteling(prof, zs)

# holle binnenkant scheelt gewicht en print sneller
binnen = [max(r - WAND, 0.1) for r in prof]
holte = omwenteling(binnen, zs - 0.5)

spigot = pijp(ID - SPIGOT_SPEL - 0.2, ID - SPIGOT_SPEL - 2 * WAND - 0.2, SPIGOT_H, -SPIGOT_H)
punt = trimesh.boolean.union([punt, spigot], engine='manifold')
punt = trimesh.boolean.difference([punt, holte], engine='manifold')
punt.export('PWS_Waterraket_Neuskegel_Tip.stl')

for naam, m in (("romp", bay), ("punt", punt)):
    e = m.bounding_box.extents
    print("%-5s waterdicht: %-5s  %.1f x %.1f x %.1f mm  %.1f cm3 (~%.0f g PLA)"
          % (naam, m.is_watertight, e[0], e[1], e[2],
             m.volume / 1000, m.volume / 1000 * 1.24 * 0.35))

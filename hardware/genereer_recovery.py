#!/usr/bin/env python3
"""
Eigen recovery-systeem (nabouw van het Phoenix 3D-principe, maar parametrisch).

Opbouw van onder naar boven, alles in een romp:
  - schuifrand over de Fernandes-fles (bewezen ontwerp uit de neuskegel)
  - elektronicaruimte met rails, dwarssteun en statische poorten
  - parachutekamer met vlakke ZIJDEUR (scharnier onderaan, servogrendel bovenaan)
  - insteekrand waar de bestaande ogief-punt (Neuskegel_Tip) op past

De deur ligt vlak in de wand (zoals Phoenix: geen randen die de uitworp hinderen)
en scharniert op een stuk 1,75 mm filament. Een SG90-servo op een plankje boven
de deur is de grendel: de hoorn valt in een lip op de deur. Bij het apogeum
draait de vluchtcomputer de servo weg en duwt een elastiekje de deur open.

Draaien:  ../../.venv/bin/python genereer_recovery.py
Print: romp staand zonder supports; deur plat op de rug.
"""
import numpy as np, trimesh

# ---------------- basis ----------------
FLES_D, FLES_SPEL, WAND = 88.5, 1.0, 1.6
SKIRT_H, VLOER = 32.0, 2.4
BAY_H = 92.0
HOUDER_B, HOUDER_T, RAIL_SPEL = 71.4, 12.0, 0.8
POORT_D, POORT_N, POORT_H = 3.0, 4, 55.0
KOORD_D = 4.0
SEG = 96

# ---------------- parachutekamer ----------------
KAMER_H   = 110.0
DEUR_B    = 58.0     # koorde van de deuropening
DEUR_H    = 78.0
DEUR_DIK  = 2.4
DEUR_SPEL = 0.45     # rondom in het kozijn
LIJST     = 2.5      # kozijnrand (ledge) waar de deur op rust
SCHARNIER_PIN = 2.0  # gat voor 1,75 mm filament

# SG90-servo (breedte x dikte x hoogte body, flens)
SERVO_B, SERVO_D, SERVO_H = 23.2, 12.6, 24.0
SERVO_FLENS = 32.5

# insteekrand voor de bestaande ogief-punt (zelfde maten als genereer_neuskegel)
SPIGOT_H, SPIGOT_SPEL = 14.0, 0.35

ID = FLES_D + FLES_SPEL
OD = ID + 2 * WAND
R_UIT, R_IN = OD / 2, ID / 2

z_vloer  = SKIRT_H
z_bay    = SKIRT_H + VLOER
z_kvloer = z_bay + BAY_H            # kamervloer
z_kamer  = z_kvloer + VLOER
z_top    = z_kamer + KAMER_H

def omw(punten):
    pts = [[0.0, punten[0][1]]] + [[r, z] for r, z in punten] + [[0.0, punten[-1][1]]]
    return trimesh.creation.revolve(np.array(pts), sections=SEG)

def balk(sx, sy, sz, x, y, z):
    m = trimesh.creation.box(extents=(sx, sy, sz))
    m.apply_translation((x + sx/2, y + sy/2, z + sz/2))
    return m

def cil_x(d, l, y, z):
    m = trimesh.creation.cylinder(radius=d/2, height=l, sections=32)
    m.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0,1,0]))
    m.apply_translation((0, y, z))
    return m

def pijp(d_out, d_in, h, z0):
    a = trimesh.creation.cylinder(radius=d_out/2, height=h, sections=SEG)
    a.apply_translation((0,0,z0+h/2))
    b = trimesh.creation.cylinder(radius=d_in/2, height=h+2, sections=SEG)
    b.apply_translation((0,0,z0+h/2))
    return trimesh.boolean.difference([a,b], engine='manifold')

# ================= ROMP =================
delen, gaten = [], []
delen.append(pijp(OD, ID, z_top, 0))                       # doorlopende buis
delen.append(omw([(R_IN+0.1, z_vloer), (R_IN+0.1, z_vloer+VLOER)]))    # vloer bay
delen.append(omw([(R_IN+0.1, z_kvloer), (R_IN+0.1, z_kvloer+VLOER)]))  # vloer kamer
delen.append(pijp(ID - SPIGOT_SPEL, ID - SPIGOT_SPEL - 2*WAND, SPIGOT_H, z_top))

# rails + dwarssteun (identiek aan de neuskegel)
rail_b, rail_d, rail_h = 3.0, 9.0, BAY_H - 10
gleuf = HOUDER_T + RAIL_SPEL
for kant in (-1, 1):
    x = kant * (gleuf/2 + rail_b/2)
    for y in (-HOUDER_B*0.42, HOUDER_B*0.42 - rail_d):
        delen.append(balk(rail_b, rail_d, rail_h, x - rail_b/2, y, z_bay))
delen.append(balk(gleuf + 2*rail_b, 3.0, 6.0, -(gleuf + 2*rail_b)/2, -1.5, z_bay))

# deuropening (+X-zijde), met kozijnrand net binnen de wand
z_d0 = z_kamer + 12.0
opening = balk(60, DEUR_B, DEUR_H, R_IN - 20, -DEUR_B/2, z_d0)
lijstblok = balk(60, DEUR_B - 2*LIJST, DEUR_H - 2*LIJST,
                 R_IN - 30, -(DEUR_B - 2*LIJST)/2, z_d0 + LIJST)
# de wand eruit: buitenste laag over het volle deurvlak, binnenste laag alleen
# binnen de lijst, zodat een rand van 2,5 mm overblijft waar de deur op rust
buitensnede = trimesh.boolean.intersection(
    [opening, pijp(OD+2, OD - 0.2 - 2*0.8 - 0.1, DEUR_H+4, z_d0-2)], engine='manifold')
binnensnede = trimesh.boolean.intersection(
    [lijstblok, pijp(OD+2, ID-8, DEUR_H+4, z_d0-2)], engine='manifold')
gaten += [buitensnede, binnensnede]

# scharnierogen aan de romp: twee blokjes onder de opening met dwarsgat
for y in (-DEUR_B/2 + 6, DEUR_B/2 - 12):
    delen.append(balk(6, 6, 8, R_IN - 7.5, y, z_d0 - 9))
gaten.append(cil_x(SCHARNIER_PIN, 200, 0, z_d0 - 5))       # doorlopend pengat

# servoplank boven de opening (hoorn wijst omlaag door een sleuf)
plank_z = z_d0 + DEUR_H + 6
delen.append(balk(SERVO_B + 8, SERVO_D + 6, 4, R_IN - SERVO_B - 10, -(SERVO_D+6)/2, plank_z))
gaten.append(balk(SERVO_B, SERVO_D, 30, R_IN - SERVO_B - 6, -SERVO_D/2, plank_z - 1))
gaten.append(balk(14, 8, 10, R_IN - 8, -4, z_d0 + DEUR_H - 1))   # sleuf voor de grendellip

# statische poorten, koordgaten, servodraadgat
for i in range(POORT_N):
    a = 2*np.pi*i/POORT_N + np.pi/4          # gedraaid: niet door de deur
    g = trimesh.creation.cylinder(radius=POORT_D/2, height=OD+4, sections=32)
    g.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0,1,0]))
    g.apply_transform(trimesh.transformations.rotation_matrix(a, [0,0,1]))
    g.apply_translation((0,0, z_bay + POORT_H))
    gaten.append(g)
for kant in (-1, 1):
    g = trimesh.creation.cylinder(radius=KOORD_D/2, height=VLOER+4, sections=24)
    g.apply_translation((kant*(R_IN-8), 0, z_kvloer + VLOER/2))
    gaten.append(g)
g = trimesh.creation.cylinder(radius=4.5, height=VLOER+4, sections=24)
g.apply_translation((-(R_IN-12), 0, z_kvloer + VLOER/2))
gaten.append(g)

romp = trimesh.boolean.union(delen, engine='manifold')
romp = trimesh.boolean.difference([romp] + gaten, engine='manifold')
romp.export('PWS_Waterraket_Recovery_Romp.stl')

# ================= DEUR =================
# vlak paneel met dezelfde kromming, DEUR_SPEL kleiner dan de opening
deur_b = DEUR_B - 2*DEUR_SPEL
deur_h = DEUR_H - 2*DEUR_SPEL
# getrapt: dunne flens (0,8) die op de kozijnrand rust, dikke kern (2,4) die
# door het binnengat valt
RAND = 0.8
schil_dun = pijp(OD - 0.2, OD - 0.2 - 2*RAND, deur_h, 0)
vak = balk(60, deur_b, deur_h + 2, R_IN - 25, -deur_b/2, -1)
flens = trimesh.boolean.intersection([schil_dun, vak], engine='manifold')
kb = DEUR_B - 2*(LIJST + DEUR_SPEL)
kh = DEUR_H - 2*(LIJST + DEUR_SPEL)
schil_dik = pijp(OD - 0.2, OD - 0.2 - 2*DEUR_DIK, kh, LIJST)
vak_k = balk(60, kb, kh + 2, R_IN - 25, -kb/2, LIJST - 1)
kern = trimesh.boolean.intersection([schil_dik, vak_k], engine='manifold')
deur = trimesh.boolean.union([flens, kern], engine='manifold')
# scharnieroog midden-onder + grendellip midden-boven (naar binnen)
deur = trimesh.boolean.union([deur,
    balk(6, 10, 6, R_IN - 7.5, -5, -7),
    balk(10, 6, 8, R_IN - 12, -3, deur_h - 2)], engine='manifold')
deur = trimesh.boolean.difference([deur,
    cil_x(SCHARNIER_PIN, 40, 0, -5 - DEUR_SPEL),   # na verplaatsing exact op romphoogte
    cil_x(2.2, 40, 0, deur_h + 2)], engine='manifold')   # gat in de lip voor de servohoorn
deur.apply_translation((0, 0, z_d0 + DEUR_SPEL))
deur.export('PWS_Waterraket_Recovery_Deur.stl')

for naam, m in (("romp", romp), ("deur", deur)):
    e = m.bounding_box.extents
    print("%-5s waterdicht: %-5s  %5.1f x %5.1f x %5.1f mm  %6.1f cm3 (~%.0f g)"
          % (naam, m.is_watertight, e[0], e[1], e[2], m.volume/1000, m.volume/1000*1.24*0.5))
print("kamer binnenin: %.0f mm hoog, %.1f mm diameter" % (KAMER_H, ID))
print("deuropening: %.0f x %.0f mm, kozijnrand %.1f mm, deurspeling %.2f mm" % (DEUR_B, DEUR_H, LIJST, DEUR_SPEL))

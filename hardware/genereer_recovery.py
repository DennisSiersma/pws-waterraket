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
SKIRT_H, VLOER = 50.0, 2.4   # 50 mm: de fles schuift diep genoeg voor een stijve, lijmbare verbinding
BAY_H = 92.0
HOUDER_B, HOUDER_T, RAIL_SPEL = 71.4, 12.0, 0.8
POORT_D, POORT_N, POORT_H = 3.0, 4, 55.0
KOORD_D = 4.0
SEG = 96

# ---------------- parachutekamer ----------------
# Klemrand: de fles is bij de bodem smaller dan de brede band, dus een vaste
# maat houdt niet. Vier lippen plus een tiewrap vangen ruim 6 mm verschil op.
SLEUF_N, SLEUF_B, SLEUF_H = 4, 5.0, 36.0
TIE_Z, TIE_H, TIE_D = 13.0, 5.0, 1.3

KAMER_H   = 85.0     # 110 gaf een romp van 271 mm; die past niet op een X1 (256 mm)
DEUR_B    = 58.0     # koorde van de deuropening
DEUR_H    = 56.0     # past binnen de kamer van 85 mm, met ruimte voor servoplank en draad
DEUR_DIK  = 2.4
DEUR_SPEL = 0.45     # rondom in het kozijn
LIJST     = 2.5      # kozijnrand (ledge) waar de deur op rust
SCHARNIER_PIN = 2.0  # gat voor 1,75 mm filament

# SG90-servo (breedte x dikte x hoogte body, flens)
SERVO_B, SERVO_D, SERVO_H = 23.2, 12.6, 24.0
SERVO_FLENS = 32.5

# insteekrand voor de bestaande ogief-punt (zelfde maten als genereer_neuskegel)
SPIGOT_H, SPIGOT_SPEL = 14.0, 0.35

# --- schroefverbinding voor de VERWISSELBARE neus ---
NEUS_SPOED  = 5.0     # grove draad: snel vast te draaien
NEUS_GANGEN = 3       # drie gangen, dus na een kwartslag al bijna vast
NEUS_SLAG   = 12.0    # hoogte waarover de draad loopt
NEUS_DIEPTE = 1.5     # hoe ver de draad naar binnen steekt

# --- los schotje tussen elektronica en parachutekamer ---
# Zonder dit deel zou de elektronicaruimte tussen twee dichte vloeren zitten
# en krijg je de houder er niet in.
SCHOT_RICHEL = 3.0    # breedte van de richel waar het schotje op rust
SCHOT_DIK    = 3.0
SCHOT_SPEL   = 0.4

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
delen.append(omw([(R_IN+0.1, z_kvloer), (R_IN+0.1, z_kvloer+VLOER)]))  # richel
# midden eruit: het schotje is een LOS deel, anders is de elektronicaruimte
# tussen twee dichte vloeren opgesloten en krijg je de houder er niet in
gaten.append(omw([(R_IN - SCHOT_RICHEL, z_kvloer - 1),
                  (R_IN - SCHOT_RICHEL, z_kvloer + VLOER + 1)]))
# ---- binnendraad bovenin: hier schroef je de verwisselbare neus in ----
def draadgang(r_bore, r_crest, hoogte, z0, spoed, gangen, buiten=False):
    """Meergangs draad, punt voor punt opgebouwd. buiten=True voor een asdraad."""
    kruin, flank = spoed * 0.14, spoed * 0.26
    basis = r_bore - 0.4 if buiten else r_bore + 0.4
    prof = [(basis, -(kruin + flank)), (r_crest, -kruin),
            (r_crest, kruin), (basis, kruin + flank)]
    n_ = len(prof)
    stukken = []
    for g in range(gangen):
        start = 2 * np.pi * g / gangen
        omwn = hoogte / (spoed * gangen)
        stappen = max(int(omwn * 160), 40)
        t = np.linspace(0.0, omwn * 2 * np.pi, stappen)
        V, F = [], []
        for hoek in t:
            c, sn = np.cos(hoek + start), np.sin(hoek + start)
            zc = z0 + hoek / (2 * np.pi) * spoed * gangen
            for (pr, pz) in prof:
                V.append((pr * c, pr * sn, zc + pz))
        for i in range(stappen - 1):
            for k in range(n_):
                a_ = i * n_ + k; b_ = i * n_ + (k + 1) % n_
                c_ = (i + 1) * n_ + (k + 1) % n_; d_ = (i + 1) * n_ + k
                F.append((a_, b_, c_)); F.append((a_, c_, d_))
        for (idx, keer) in ((0, False), (stappen - 1, True)):
            bs = idx * n_
            for k in range(1, n_ - 1):
                tri = (bs, bs + k, bs + k + 1)
                F.append(tri[::-1] if keer else tri)
        m_ = trimesh.Trimesh(vertices=np.array(V), faces=np.array(F), process=True)
        trimesh.repair.fix_normals(m_)
        stukken.append(m_)
    return stukken

z_draad = z_top - NEUS_SLAG - 4.0   # zo valt hij samen met de draad op de neus
delen += draadgang(R_IN, R_IN - NEUS_DIEPTE, NEUS_SLAG, z_draad,
                   NEUS_SPOED, NEUS_GANGEN)

# rails + dwarssteun (identiek aan de neuskegel)
rail_b, rail_d, rail_h = 3.0, 9.0, BAY_H - 10
gleuf = HOUDER_T + RAIL_SPEL
for kant in (-1, 1):
    x = kant * (gleuf/2 + rail_b/2)
    for y in (-HOUDER_B*0.42, HOUDER_B*0.42 - rail_d):
        delen.append(balk(rail_b, rail_d, rail_h, x - rail_b/2, y, z_bay))
delen.append(balk(gleuf + 2*rail_b, 3.0, 6.0, -(gleuf + 2*rail_b)/2, -1.5, z_bay))

# deuropening (+X-zijde), met kozijnrand net binnen de wand
z_d0 = z_kamer + 8.0
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

# ---- KLEMRAND: verdikte band, tiewrap-groef en zaagsneden ----
# De wand is hier maar 1,6 mm; zonder verdikking blijft er onder de groef
# nauwelijks materiaal over en scheurt hij bij het aantrekken.
delen.append(pijp(OD + 3.0, ID, TIE_H + 4, TIE_Z - 2))
bu = trimesh.creation.cylinder(radius=OD/2 + 3, height=TIE_H, sections=SEG)
bi = trimesh.creation.cylinder(radius=OD/2 + 1.5 - TIE_D, height=TIE_H + 2, sections=SEG)
bu.apply_translation((0,0,TIE_Z)); bi.apply_translation((0,0,TIE_Z))
gaten.append(trimesh.boolean.difference([bu, bi], engine='manifold'))
for i in range(SLEUF_N):
    a = 2*np.pi*i/SLEUF_N + np.pi/4      # niet in lijn met de deur
    sl = trimesh.creation.box(extents=(OD, SLEUF_B, SLEUF_H + 2))
    sl.apply_translation((OD/2, 0, (SLEUF_H + 2)/2 - 1))
    sl.apply_transform(trimesh.transformations.rotation_matrix(a, [0,0,1]))
    gaten.append(sl)

romp = trimesh.boolean.union(delen, engine='manifold')
romp = trimesh.boolean.difference([romp] + gaten, engine='manifold')

romp.export('PWS_Waterraket_Recovery_Romp.stl')

# ---- los schotje tussen elektronica en parachutekamer ----
schot = trimesh.creation.cylinder(radius=R_IN - SCHOT_SPEL/2,
                                  height=SCHOT_DIK, sections=SEG)
schot.apply_translation((0, 0, SCHOT_DIK/2))
gaatjes = []
for kant in (-1, 1):                       # koordgaten voor de parachutelijn
    g = trimesh.creation.cylinder(radius=KOORD_D/2, height=SCHOT_DIK+2, sections=24)
    g.apply_translation((kant*(R_IN-14), 0, SCHOT_DIK/2))
    gaatjes.append(g)
g = trimesh.creation.cylinder(radius=4.5, height=SCHOT_DIK+2, sections=24)
g.apply_translation((0, R_IN-16, SCHOT_DIK/2))     # doorvoer servodraad
gaatjes.append(g)
schot = trimesh.boolean.difference([schot] + gaatjes, engine='manifold')
schot.merge_vertices(); schot.update_faces(schot.nondegenerate_faces())
schot.update_faces(schot.unique_faces()); schot.remove_unreferenced_vertices()
trimesh.repair.fix_normals(schot)
schot.export('PWS_Waterraket_Recovery_Schot.stl')
print("schot: %.1f mm doorsnede, %.1f mm dik" % (schot.bounding_box.extents[0], SCHOT_DIK))

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

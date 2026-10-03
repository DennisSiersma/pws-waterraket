#!/usr/bin/env python3
"""
Eigen recovery-systeem (nabouw van het Phoenix 3D-principe, maar parametrisch).

Opbouw van onder naar boven, alles in een romp:
  - schuifrand over de Fernandes-fles (bewezen ontwerp uit de neuskegel)
  - elektronicaruimte met rails, dwarssteun en statische poorten
  - parachutekamer met vlakke ZIJDEUR (scharnier onderaan, servogrendel bovenaan)
  - binnendraad waar de verwisselbare neus in geschroefd wordt

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
BAY_H = 26.0           # tray van 13 mm ligt plat; was 92 met de staande houder
HOUDER_B, HOUDER_T, RAIL_SPEL = 71.4, 12.0, 0.8
POORT_D, POORT_N, POORT_H = 3.0, 4, 8.0   # op sensorhoogte in de tray
KOORD_D = 4.0
SEG = 96

# ---------------- parachutekamer ----------------
# Klemrand: de fles is bij de bodem smaller dan de brede band, dus een vaste
# maat houdt niet. Vier lippen plus een tiewrap vangen ruim 6 mm verschil op.
SLEUF_N, SLEUF_B, SLEUF_H = 4, 5.0, 36.0
TIE_Z, TIE_H, TIE_D = 13.0, 5.0, 1.3

KAMER_H   = 86.0     # deur begint 14 mm boven de vloer zodat scharnier en schotje elkaar niet raken
DEUR_B    = 54.0     # koorde van de deuropening
DEUR_H    = 50.0
DEUR_DIK  = 2.4
DEUR_SPEL = 0.45     # rondom in het kozijn
LIJST     = 2.5      # kozijnrand (ledge) waar de deur op rust
SCHARNIER_PIN = 2.0  # gat voor 1,75 mm filament

# SG90-servo (breedte x dikte x hoogte body, flens)
SERVO_B, SERVO_D, SERVO_H = 23.2, 12.6, 24.0
SERVO_FLENS = 32.5

# (rest van de oude insteekrand; de neus gaat nu op schroefdraad)
SPIGOT_H, SPIGOT_SPEL = 14.0, 0.35

# --- schroefverbinding voor de VERWISSELBARE neus ---
NEUS_SPOED  = 5.0     # grove draad: snel vast te draaien
NEUS_GANGEN = 3       # drie gangen, dus na een kwartslag al bijna vast
NEUS_SLAG   = 12.0    # hoogte waarover de draad loopt
NEUS_DIEPTE = 2.2     # dieper, zodat er ruimte is voor meer speling

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

def cil_y(d, l, x, z):
    m = trimesh.creation.cylinder(radius=d / 2, height=l, sections=32)
    m.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    m.apply_translation((x, 0, z))
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
# aanloop: de bovenste 1,5 mm van de boring iets wijder
gaten.append(omw([(R_IN + 0.9, z_top - 1.5), (R_IN + 0.9, z_top + 1)]))
delen += draadgang(R_IN, R_IN - NEUS_DIEPTE, NEUS_SLAG, z_draad,
                   NEUS_SPOED, NEUS_GANGEN)

# rails + dwarssteun (identiek aan de neuskegel)
# geen rails meer: de elektronica ligt plat in een tray op de vloer

# deuropening (+X-zijde), met kozijnrand net binnen de wand
z_d0 = z_kamer + 14.0   # scharnierblokjes (z_d0-9) blijven boven het schotje (vloer+3)
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

# Scharnier. De as loopt TANGENTIEEL (langs y) door twee blokjes naast het
# deuroog, op x=36. De blokjes worden met de boring afgesneden zodat ze in de
# wand versmelten maar er niet buiten uitsteken (de oude blokjes op y=21 staken
# 1,8 mm buiten de romp en hadden een radiaal pengat: dat scharnier kon niet).
PEN_X = 36.0
for yk in (-24.0, 18.0):
    blok = balk(10.0, 6.0, 8.0, 31.0, yk, z_d0 - 9)
    blok = trimesh.boolean.intersection([blok, pijp(ID + 1.2, 0.1, 20, z_d0 - 15)], engine='manifold')
    delen.append(blok)
# pengat langs y door de blokjes, het deuroog en de wand aan beide kanten (daar
# steek je het stukje filament in)
gaten.append(cil_y(SCHARNIER_PIN, 100, PEN_X, z_d0 - 5))

# Servo NAAST de deur, op dezelfde hoogte als de deur: dat scheelt de hele
# stapel boven de deur. Hij ligt tangentieel op een plankje tegen de wand,
# as wijst naar de deur; de hoorn draait in het radiaal-verticale vlak vlak
# naast de deurrand en pakt een lip aan de binnenkant van de deur.
S_HOEK = np.radians(53.0)              # middelpunt van de servo, rond de omtrek
S_R    = 43.0                          # buitenvlak van het servovak (binnen de boring)
z_mid  = z_d0 + DEUR_H / 2
def rot_z(m, a):
    m.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1])); return m
plank = balk(27.0, 28.0, 3.0, R_IN + 1.5 - 27.0, -14.0, z_mid - SERVO_D / 2 - 3.5)
plank = trimesh.boolean.intersection([plank, pijp(ID + 1.0, 0.1, 40, z_mid - 20)], engine='manifold')
delen.append(rot_z(plank, S_HOEK))
# 45-gradenwig onder het plankje: zonder steun is het een vrij zwevend plateau
# van 27 mm en dat print niet zonder support
import shapely.geometry as _sg
wig2d = _sg.Polygon([(R_IN + 1.5, 0.0), (R_IN + 1.5, -26.0), (R_IN + 1.5 - 26.0, 0.0)])
wig = trimesh.creation.extrude_polygon(wig2d, height=28.0)         # extrudeert langs z
wig.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))  # z -> -y
wig.apply_translation((0, 14.0, z_mid - SERVO_D / 2 - 3.5))
wig = trimesh.boolean.intersection([wig, pijp(ID + 1.0, 0.1, 60, z_mid - 50)], engine='manifold')
delen.append(rot_z(wig, S_HOEK))
vak = balk(24.0, 23.6, SERVO_D + 1.0, S_R - 24.0, -11.8, z_mid - SERVO_D / 2 - 0.5)
gaten.append(rot_z(vak, S_HOEK))
for ys in (-9.0, 7.0):                                        # tiewrapsleuven
    sl = balk(3.0, 2.0, 8.0, S_R - 13.0, ys, z_mid - SERVO_D / 2 - 5.0)
    gaten.append(rot_z(sl, S_HOEK))
LIP_Y = 23.0                           # lip aan de deurzijde die naar de servo wijst

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

# opschonen voor de export: STL rondt af naar float32 en piepkleine driehoekjes
# (bijvoorbeeld rond het pengat) vallen dan samen, waardoor het model lek wordt
romp.merge_vertices(); romp.update_faces(romp.nondegenerate_faces())
romp.update_faces(romp.unique_faces()); romp.remove_unreferenced_vertices()
trimesh.repair.fill_holes(romp); trimesh.repair.fix_normals(romp)
romp.export('PWS_Waterraket_Recovery_Romp.stl')
_t = trimesh.load('PWS_Waterraket_Recovery_Romp.stl')
print("romp NA export: waterdicht %s, delen %d" % (_t.is_watertight, _t.body_count))

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
# oog en lip lopen door tot IN het deurpaneel (dat begint op straal 44,0);
# anders zweven ze los en worden ze als aparte stukjes geprint
# Oog en lip moeten het paneel in TWEE richtingen raken: radiaal tot in de
# buitenflens (straal 45,45 tot 46,25) en in de hoogte overlappend met het
# paneel. Anders zijn het losse stukjes. Het oog begint daarom op z=-7 en loopt
# door tot z=+1; de lip steekt tot straal 46,05.
# Het oog blijft BINNEN de boring (straal < 44,75), want onder de deuropening
# is de rompwand massief. Het pakt de dikke kern van het paneel (vanaf straal
# 43,85, vanaf z=2,5) van binnenuit: tot straal 44,55 en tot z=5.
# De lip zit boven de opening, waar een sleuf in de wand zit, en mag wel tot
# in de buitenflens.
deur = trimesh.boolean.union([deur,
    balk((R_IN - 0.2) - 31.0, 10, 12, 31.0, -5, -7),
    balk((R_IN + 0.6) - (R_IN - 11), 3, 10, R_IN - 11, LIP_Y - 1.5, deur_h / 2 - 5)], engine='manifold')
# gat in de lip loopt TANGENTIEEL (langs y), evenwijdig aan de servo-as
lipgat = trimesh.creation.cylinder(radius=1.1, height=20, sections=24)
lipgat.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1, 0, 0]))
lipgat.apply_translation((R_IN - 6.5, LIP_Y, deur_h / 2))
deur = trimesh.boolean.difference([deur,
    cil_y(SCHARNIER_PIN, 40, 36.0, -5 - DEUR_SPEL),   # as langs y, zelfde x als de blokjes
    lipgat], engine='manifold')
deur.apply_translation((0, 0, z_d0 + DEUR_SPEL))
deur.export('PWS_Waterraket_Recovery_Deur.stl')

for naam, m in (("romp", romp), ("deur", deur)):
    e = m.bounding_box.extents
    print("%-5s waterdicht: %-5s  %5.1f x %5.1f x %5.1f mm  %6.1f cm3 (~%.0f g)"
          % (naam, m.is_watertight, e[0], e[1], e[2], m.volume/1000, m.volume/1000*1.24*0.5))
print("kamer binnenin: %.0f mm hoog, %.1f mm diameter" % (KAMER_H, ID))
print("deuropening: %.0f x %.0f mm, kozijnrand %.1f mm, deurspeling %.2f mm" % (DEUR_B, DEUR_H, LIJST, DEUR_SPEL))

#!/usr/bin/env python3
"""
Eenvoudige testneus voor de waterraket - een deel, geen parachute, geen payload.

Bedoeld voor de eerste testvluchten: kijken of de lancering werkt, of de raket
recht vliegt en of de vinnen kloppen. Print in TPU (hard, 95A of 98A): die
overleeft een landing zonder parachute, en juist dat is bij deze vluchten de
bedoeling.

Vorm: schuifrand over de flesbodem + hol ogief. Onderin zit een ballastkamer
waar je zo nodig gewicht in kwijt kunt (moeren, zand in een zakje) om het
zwaartepunt naar voren te halen.

Draaien:  ../../.venv/bin/python genereer_testneus.py
"""
import numpy as np, trimesh

# ---------------- maten in mm ----------------
FLES_D    = 88.5     # Fernandes 1,5 L bij de bodem
FLES_SPEL = 1.4      # RUIMER dan bij PLA/PETG: TPU grijpt sterk en zet iets uit
WAND      = 2.0      # 2,0 mm = 4 banen van 0,5: stevig genoeg in TPU, scheelt gewicht
SKIRT_H   = 45.0     # lange rand: de wrijving van TPU doet het klemwerk
VLOER     = 3.0      # tussenschot boven de fles
OGIEF_H   = 110.0    # hoogte van de punt
TIP_R     = 3.0      # afgeronde neus: een scherpe punt scheurt in TPU
BALLAST_H = 35.0     # kamer boven het tussenschot voor eventueel gewicht
VENT_D    = 3.0      # ontluchting: anders zit de lucht opgesloten bij montage
SEG       = 96

ID = FLES_D + FLES_SPEL
OD = ID + 2 * WAND
z_vloer = SKIRT_H
z_binnen = SKIRT_H + VLOER


def omw(punten):
    """Gesloten omwentelingslichaam uit (r, z)-punten."""
    pts = [[0.0, punten[0][1]]] + [[float(r), float(z)] for r, z in punten] + [[0.0, punten[-1][1]]]
    return trimesh.creation.revolve(np.array(pts), sections=SEG)


# ---- buitenvorm: cilinder (schuifrand) + ogief ----
buiten = [(OD/2, 0.0), (OD/2, z_binnen)]
n = 48
for i in range(n + 1):
    x = i / n
    z = z_binnen + x * OGIEF_H
    # ogief: rakend aan de cilinder onderaan, afgerond aan de top
    r = (OD/2 - TIP_R) * np.sqrt(max(0.0, 1.0 - x**2)) ** 0.72 + TIP_R * (1 - x)
    buiten.append((max(r, 0.4), z))
romp = omw(buiten)

# ---- holtes: flesruimte onderaan, ballast/lichtgewicht daarboven ----
flesholte = omw([(ID/2, -1.0), (ID/2, z_vloer)])

# De holte stopt zodra de wand te dun zou worden: de punt blijft massief.
# Zonder die stop ontstaat er een naald en is het model niet meer waterdicht.
binnen = [(ID/2 - 0.2, z_binnen)]
for i in range(n + 1):
    x = i / n
    z = z_binnen + x * OGIEF_H
    r = (OD/2 - TIP_R) * np.sqrt(max(0.0, 1.0 - x**2)) ** 0.72 + TIP_R * (1 - x) - WAND
    if r < 2.5:
        break
    binnen.append((r, z))
binnenholte = omw(binnen)

neus = trimesh.boolean.difference([romp, flesholte, binnenholte], engine='manifold')

# ---- gaten: ontluchting in de schuifrand en in het tussenschot ----
gaten = []
for i in range(3):
    a = 2*np.pi*i/3
    g = trimesh.creation.cylinder(radius=VENT_D/2, height=OD+4, sections=24)
    g.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0,1,0]))
    g.apply_transform(trimesh.transformations.rotation_matrix(a, [0,0,1]))
    g.apply_translation((0, 0, SKIRT_H/2))
    gaten.append(g)
g = trimesh.creation.cylinder(radius=VENT_D/2, height=VLOER+4, sections=24)
g.apply_translation((ID/2 - 9, 0, z_vloer + VLOER/2))
gaten.append(g)

neus = trimesh.boolean.difference([neus] + gaten, engine='manifold')

# Opruimen voor de export. STL slaat op in 32-bits floats; piepkleine driehoekjes
# rond de punt vallen daardoor samen en maken het model lek. Samenvoegen en
# ontaarde vlakken verwijderen lost dat op.
neus.merge_vertices()
neus.update_faces(neus.nondegenerate_faces())
neus.update_faces(neus.unique_faces())
neus.remove_unreferenced_vertices()
trimesh.repair.fill_holes(neus)
trimesh.repair.fix_normals(neus)
neus.export('PWS_Waterraket_Testneus.stl')

# controle NA het schrijven: dit is wat de slicer straks inleest
terug = trimesh.load('PWS_Waterraket_Testneus.stl')
print("na export waterdicht: %s | losse delen: %d" % (terug.is_watertight, terug.body_count))

e = neus.bounding_box.extents
print("waterdicht: %s | driehoeken: %d" % (neus.is_watertight, len(neus.faces)))
print("afmetingen: %.1f x %.1f x %.1f mm" % tuple(e))
print("materiaal:  %.1f cm3  ->  ~%.0f g TPU bij 20%% infill" % (neus.volume/1000, neus.volume/1000*1.21*0.55))
print("schuifrand: %.0f mm over de fles, boring %.1f mm (speling %.1f)" % (SKIRT_H, ID, FLES_SPEL))
print("ballastkamer: %.0f mm hoog boven het tussenschot" % BALLAST_H)

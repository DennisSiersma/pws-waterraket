#!/usr/bin/env python3
"""
Nozzles met GARDENA-steel en een dop die RECHT op de fles staat.

Achtergrond
-----------
De nozzles van Raketfued passen in de Gardena-koppeling (die is bij ons ook het
vergrendelmechanisme), maar ze staan scheef op de fles. Gemeten: de dop raakt de
flesrand NIET. Hij hangt dus volledig aan de geprinte schroefdraad, en de vier
losse draadsegmenten van een PCO1881-hals zijn gemaakt om aan te trekken, niet om
iets haaks te positioneren. Dat is met beter printen niet op te lossen.

Wat hier anders is
------------------
1. GELEIDINGSBOSSING van 12 mm die in de flesmond steekt (boring 21,74 mm).
   Die lange geleiding dwingt de nozzle recht, los van de draad.
2. VLAKKE ZITTING die WEL op de flesrand landt, met een O-ringgroef.
   Zo staat hij haaks en dicht hij af op een vlak in plaats van op de draad.
3. DRAADVRIJLOOP boven de draad, zodat hij niet op de draad kan bottomen
   voordat hij op de rand zit.

De Gardena-steel is overgenomen door hem op te meten uit
Nozzle_8mm.stl van Raketfued (per 0,4 mm hoogte de buitendiameter):
O-ringgroef op 11,4 mm, greepkraag 17,0 mm, steel 13,5 mm, voet 15,5 mm.

Maximale doorlaat is 9 mm: bij de O-ringgroef is de steel maar 11,4 mm dik,
dus daarboven wordt de wand te dun. Dat is meteen de bovengrens van het
onderzoeksbereik met een Gardena-launcher.

Draaien:  ../../.venv/bin/python genereer_nozzles_gardena.py
Printen:  staand, Gardena-kant op het bed, 0,15 mm laagjes, geen supports,
          olifantenpoot-compensatie aan. PETG.
"""
import numpy as np
import trimesh

# ---------------- Gardena-steel (opgemeten uit Raketfued Nozzle_8mm.stl) ------
# (hoogte, buitendiameter) van onder naar boven
STEEL = [
    (0.0, 15.1), (0.6, 15.5), (2.6, 15.5),
    (3.0, 11.8), (3.4, 11.4), (5.4, 11.4), (5.8, 11.8),   # O-ringgroef
    (6.2, 15.5), (7.8, 15.6),
    (8.2, 17.0), (10.6, 17.0),                            # greepkraag
    (11.0, 15.7), (11.4, 14.0), (11.8, 13.5), (15.4, 13.5),
    (16.2, 13.7), (17.0, 14.0), (17.8, 14.7), (18.6, 15.9),
    (19.4, 17.7), (20.2, 20.3), (22.6, 20.3),
]

# ---------------- halsmaten PCO1881 ----------------
DRAAD_D    = 27.43
KERN_D     = 24.94
HALS_D     = 21.74
SPOED      = 2.7
DRAAD_SPEL = 0.45

# ---------------- dopmaten ----------------
WAND        = 3.0
DOP_H       = 15.0     # hoogte van het dopdeel boven de steel
DRAAD_START = 3.2
DRAAD_SLAG  = 9.0
GELEIDING_H = 12.0
GELEIDING_SPEL = 0.5
ZITTING_T   = 3.5      # dikte van de zitting tussen steel en flesrand
ORING_D     = 2.0
GREEP_N     = 10
INTREDE_R   = 3.0
SEG         = 96

MATEN = [4.0, 5.0, 6.0, 7.0, 8.0, 9.0]


def omw(punten, sec=SEG):
    pts = ([[0.0, punten[0][1]]]
           + [[float(r), float(z)] for r, z in punten]
           + [[0.0, punten[-1][1]]])
    return trimesh.creation.revolve(np.array(pts), sections=sec)


def draadhelix(r_bore, r_crest, hoogte, z0, spoed):
    """Binnendraad, punt voor punt opgebouwd zodat de draadrug naar binnen wijst."""
    r_bore = r_bore + 0.4
    kruin_h, flank_h = 0.45, 0.85
    prof = [
        (r_bore,  -(kruin_h + flank_h)),
        (r_crest, -kruin_h),
        (r_crest,  kruin_h),
        (r_bore,   kruin_h + flank_h),
    ]
    np_ = len(prof)
    omw_n = hoogte / spoed
    stappen = max(int(omw_n * 90), 24)
    t = np.linspace(0.0, omw_n * 2 * np.pi, stappen)
    V, F = [], []
    for hoek in t:
        c, s_ = np.cos(hoek), np.sin(hoek)
        zc = z0 + hoek / (2 * np.pi) * spoed
        for (pr, pz) in prof:
            V.append((pr * c, pr * s_, zc + pz))
    for i in range(stappen - 1):
        for k in range(np_):
            a = i * np_ + k
            b = i * np_ + (k + 1) % np_
            c2 = (i + 1) * np_ + (k + 1) % np_
            d2 = (i + 1) * np_ + k
            F.append((a, b, c2)); F.append((a, c2, d2))
    for (idx, keer) in ((0, False), (stappen - 1, True)):
        basis = idx * np_
        for k in range(1, np_ - 1):
            tri = (basis, basis + k, basis + k + 1)
            F.append(tri[::-1] if keer else tri)
    m = trimesh.Trimesh(vertices=np.array(V), faces=np.array(F), process=True)
    trimesh.repair.fix_normals(m)
    return m


def bouw(d_gat):
    r_buiten = DRAAD_D / 2 + DRAAD_SPEL + WAND
    r_boring = DRAAD_D / 2 + DRAAD_SPEL
    r_kern   = KERN_D / 2 + DRAAD_SPEL
    r_gel    = HALS_D / 2 - GELEIDING_SPEL / 2

    z_steel = STEEL[-1][0]                 # bovenkant Gardena-steel
    z_zit   = z_steel + ZITTING_T          # hoogte van de flesrand-zitting
    z_dop   = z_zit + DOP_H                # bovenkant van de dopwand
    z_top   = z_zit + GELEIDING_H          # top van de geleidingsbossing

    # buitenprofiel: Gardena-steel, dan de dop
    prof = [(d / 2, z) for z, d in STEEL]
    prof += [
        (r_buiten, z_steel + 0.8),         # schuine overgang naar de dop
        (r_buiten, z_dop),
        (r_boring, z_dop),
        (r_boring, z_zit),                 # binnenwand tot aan de zitting
        (r_gel,    z_zit),                 # de zitting zelf: landt op de flesrand
        (r_gel,    z_top),                 # geleidingsbossing in de flesmond
    ]
    delen = [omw(prof)]
    delen.append(draadhelix(r_boring, r_kern, DRAAD_SLAG, z_zit + DRAAD_START, SPOED))

    for i in range(GREEP_N):
        a = 2 * np.pi * i / GREEP_N
        rib = trimesh.creation.cylinder(radius=1.6, height=DOP_H - 1, sections=16)
        rib.apply_translation((r_buiten, 0, z_zit + DOP_H / 2))
        rib.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1]))
        delen.append(rib)

    n = trimesh.boolean.union(delen, engine='manifold')

    # doorlaat over de hele lengte, met afgeronde intrede bovenin
    r = d_gat / 2
    p = []
    m_ = 20
    for i in range(m_ + 1):
        hoek = (i / m_) * np.pi / 2
        p.append((r + INTREDE_R * np.cos(hoek),
                  z_top + 0.5 - INTREDE_R * (1 - np.sin(hoek))))
    kanaal = [(r, -1.0)] + p[::-1] + [(r + INTREDE_R, z_top + 1.0)]

    # O-ringgroef in de zitting (als ring, niet via een omwenteling met asafsluiting)
    r_mid = (r_gel + r_boring) / 2
    gh = ORING_D * 0.55
    bu = trimesh.creation.cylinder(radius=r_mid + ORING_D / 2, height=gh, sections=SEG)
    bi = trimesh.creation.cylinder(radius=r_mid - ORING_D / 2, height=gh + 2, sections=SEG)
    bu.apply_translation((0, 0, z_zit - gh / 2))
    bi.apply_translation((0, 0, z_zit - gh / 2))
    groef = trimesh.boolean.difference([bu, bi], engine='manifold')

    n = trimesh.boolean.difference([n, omw(kanaal), groef], engine='manifold')
    n.merge_vertices()
    n.update_faces(n.nondegenerate_faces())
    n.update_faces(n.unique_faces())
    n.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(n)

    naam = 'PWS_Waterraket_NozzleGardena_%02dmm.stl' % round(d_gat)
    n.export(naam)
    t = trimesh.load(naam)
    e = t.bounding_box.extents
    print("%-40s gat %4.1f   %.1f x %.1f x %.1f mm   waterdicht: %s"
          % (naam, d_gat, e[0], e[1], e[2], t.is_watertight))
    return t


print("Gardena-steel %.1f mm hoog, dop erop; doorlaat 4 t/m 9 mm\n" % STEEL[-1][0])
for d in MATEN:
    bouw(d)
